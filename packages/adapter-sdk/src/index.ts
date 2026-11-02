import type {
  AdapterManifest,
  CapabilityId,
  CapabilityStateMap,
  IntegrationHealth,
} from '@physical-os/shared';
import { AdapterError } from '@physical-os/shared';

export interface AdapterDevice {
  ref: string;
  name: string;
  manufacturer: string | null;
  capabilities: CapabilityId[];
  observed: CapabilityStateMap;
  metadata: Record<string, string | number | boolean | null>;
}

export interface AdapterCommand {
  deviceRef: string;
  capability: CapabilityId;
  action: string;
  params: Record<string, unknown>;
  correlationId: string;
  timeoutMs: number;
}

export interface AdapterCommandResult {
  correlationId: string;
  accepted: boolean;
  delivered: boolean;
  message: string;
}

export interface AdapterEvent {
  deviceRef: string;
  kind: 'state' | 'connected' | 'disconnected' | 'rejected';
  capability?: CapabilityId;
  observed?: CapabilityStateMap;
  message?: string;
  at: string;
}

export interface DeviceAdapter {
  readonly manifest: AdapterManifest;
  discover(): Promise<AdapterDevice[]>;
  connect(config?: unknown): Promise<void>;
  disconnect(): Promise<void>;
  listDevices(): Promise<AdapterDevice[]>;
  getCapabilities(deviceRef: string): Promise<CapabilityId[]>;
  readState(deviceRef: string): Promise<CapabilityStateMap>;
  executeCommand(command: AdapterCommand): Promise<AdapterCommandResult>;
  subscribeToEvents(handler: (event: AdapterEvent) => void): () => void;
  healthCheck(): Promise<IntegrationHealth>;
}

export async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  correlationId: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AdapterError('timeout', `Operation timed out after ${timeoutMs}ms`, correlationId, true));
    }, timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function assertOperation(adapter: DeviceAdapter, operation: AdapterManifest['operations'][number]): void {
  if (!adapter.manifest.operations.includes(operation)) {
    throw new AdapterError('unsupported', `${adapter.manifest.id} does not support ${operation}`, 'none');
  }
}
