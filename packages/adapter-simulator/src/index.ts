import { randomUUID } from 'node:crypto';
import {
  AdapterError,
  type AdapterManifest,
  type CapabilityId,
  type CapabilityStateMap,
  type IntegrationHealth,
} from '@physical-os/shared';
import type {
  AdapterCommand,
  AdapterCommandResult,
  AdapterDevice,
  AdapterEvent,
  DeviceAdapter,
} from '@physical-os/adapter-sdk';
import { emptyState, expectedState, parseAction, parseObserved } from '@physical-os/device-sdk';

export interface SimulatorFault {
  latencyMs?: number;
  disconnected?: boolean;
  failNext?: boolean;
}

interface SimDevice extends AdapterDevice {
  connectivity: 'online' | 'offline';
}

export class SimulatorAdapter implements DeviceAdapter {
  readonly manifest: AdapterManifest = {
    id: 'simulator',
    name: 'Simulator',
    version: '1.0.0',
    contractVersion: '1',
    vendor: 'Physical OS',
    operations: [
      'discover',
      'connect',
      'disconnect',
      'listDevices',
      'getCapabilities',
      'readState',
      'executeCommand',
      'subscribeToEvents',
      'healthCheck',
    ],
    simulated: true,
  };

  private readonly devices = new Map<string, SimDevice>();
  private readonly faults = new Map<string, SimulatorFault>();
  private readonly listeners = new Set<(event: AdapterEvent) => void>();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async discover(): Promise<AdapterDevice[]> {
    return this.listDevices();
  }

  async listDevices(): Promise<AdapterDevice[]> {
    return [...this.devices.values()].map(strip);
  }

  async getCapabilities(deviceRef: string): Promise<CapabilityId[]> {
    return this.require(deviceRef).capabilities;
  }

  async readState(deviceRef: string): Promise<CapabilityStateMap> {
    const device = this.require(deviceRef);
    if (device.connectivity === 'offline') {
      throw new AdapterError('disconnected', 'Simulated device is disconnected.', 'read', true);
    }
    return structuredClone(device.observed);
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterCommandResult> {
    const device = this.require(command.deviceRef);
    const fault = this.faults.get(command.deviceRef) ?? {};
    if (fault.disconnected || device.connectivity === 'offline') {
      throw new AdapterError('disconnected', 'Simulated device is disconnected.', command.correlationId, true);
    }
    if (fault.failNext) {
      fault.failNext = false;
      throw new AdapterError('rejected', 'Injected simulator failure.', command.correlationId, true);
    }
    const latency = fault.latencyMs ?? 0;
    if (latency > 0) {
      await delay(Math.min(latency, command.timeoutMs));
    }
    if (latency >= command.timeoutMs) {
      throw new AdapterError('timeout', 'Injected simulator latency exceeded the timeout.', command.correlationId, true);
    }
    if (!device.capabilities.includes(command.capability)) {
      throw new AdapterError('unsupported', 'Capability is not on this simulated device.', command.correlationId);
    }
    const current = device.observed[command.capability];
    const parsed = parseAction(command.capability, command.action, command.params, current);
    if (parsed.expectedState) {
      device.observed = {
        ...device.observed,
        [command.capability]: parseObserved(command.capability, parsed.expectedState),
      };
    }
    return {
      correlationId: command.correlationId,
      accepted: true,
      delivered: true,
      message: 'Simulated command applied.',
    };
  }

  subscribeToEvents(handler: (event: AdapterEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  async healthCheck(): Promise<IntegrationHealth> {
    return {
      adapterId: this.manifest.id,
      status: this.connected ? 'healthy' : 'offline',
      message: this.connected
        ? `${this.devices.size} simulated devices`
        : 'Simulator is stopped.',
      checkedAt: new Date().toISOString(),
      details: { devices: this.devices.size, simulated: true },
    };
  }

  addDevice(input: {
    ref?: string;
    name: string;
    manufacturer?: string | null;
    capabilities: CapabilityId[];
    metadata?: SimDevice['metadata'];
    observed?: CapabilityStateMap;
  }): AdapterDevice {
    const ref = input.ref ?? randomUUID();
    const capabilities = input.capabilities;
    const observed = emptyState(capabilities);
    if (input.observed) {
      for (const capability of capabilities) {
        const value = input.observed[capability];
        if (value !== undefined) observed[capability] = parseObserved(capability, value);
      }
    }
    const device: SimDevice = {
      ref,
      name: input.name,
      manufacturer: input.manufacturer ?? 'Physical OS Simulator',
      capabilities,
      observed,
      metadata: { simulated: true, isolatedSimulator: true, ...input.metadata },
      connectivity: 'online',
    };
    this.devices.set(ref, device);
    return strip(device);
  }

  writeCapability(deviceRef: string, capability: CapabilityId, value: unknown): CapabilityStateMap {
    const device = this.require(deviceRef);
    if (!device.capabilities.includes(capability)) {
      throw new AdapterError('unsupported', 'Capability is not on this simulated device.', 'inject');
    }
    device.observed = {
      ...device.observed,
      [capability]: parseObserved(capability, value),
    };
    this.emit({
      deviceRef,
      kind: 'state',
      capability,
      observed: structuredClone(device.observed),
      at: new Date().toISOString(),
    });
    return structuredClone(device.observed);
  }

  setFault(deviceRef: string, fault: SimulatorFault): void {
    this.require(deviceRef);
    this.faults.set(deviceRef, { ...fault });
    const device = this.require(deviceRef);
    device.connectivity = fault.disconnected ? 'offline' : 'online';
    this.emit({
      deviceRef,
      kind: fault.disconnected ? 'disconnected' : 'connected',
      at: new Date().toISOString(),
    });
  }

  private require(deviceRef: string): SimDevice {
    const device = this.devices.get(deviceRef);
    if (!device) throw new AdapterError('unsupported', 'Unknown simulated device.', 'none');
    return device;
  }

  private emit(event: AdapterEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function strip(device: SimDevice): AdapterDevice {
  return {
    ref: device.ref,
    name: device.name,
    manufacturer: device.manufacturer,
    capabilities: device.capabilities,
    observed: structuredClone(device.observed),
    metadata: { ...device.metadata },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function previewExpected(
  capability: CapabilityId,
  action: string,
  params: Record<string, unknown>,
  current: unknown,
): Record<string, unknown> | null {
  return expectedState(capability, action, params, current);
}
