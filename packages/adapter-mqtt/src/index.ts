import { z } from 'zod';
import mqtt, { type MqttClient } from 'mqtt';
import {
  AdapterError,
  capabilityIdSchema,
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
import { withTimeout } from '@physical-os/adapter-sdk';
import { parseObserved } from '@physical-os/device-sdk';

const topicSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,180}$/);

export const mqttDeviceMappingSchema = z.object({
  localId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().min(1).max(80),
  roomId: z.string().uuid(),
  capabilities: z.array(capabilityIdSchema).min(1).max(8),
  stateTopic: topicSchema,
  commandTopic: topicSchema.optional(),
  stateFormat: z.enum(['capability_map', 'on_off_json', 'on_off_raw']).default('on_off_json'),
});
export type MqttDeviceMapping = z.infer<typeof mqttDeviceMappingSchema>;

export const mqttConnectionSchema = z
  .object({
    url: z.string().url(),
    username: z.string().min(1).max(120).optional(),
    password: z.string().min(1).max(200).optional(),
    clientId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('physical-os'),
    rejectUnauthorized: z.boolean().default(true),
    connectTimeoutMs: z.number().int().min(500).max(30_000).default(5_000),
    allowAnonymous: z.boolean().default(false),
    allowInsecurePlaintext: z.boolean().default(false),
    devices: z.array(mqttDeviceMappingSchema).max(200),
  })
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value.url);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid MQTT URL', path: ['url'] });
      return;
    }
    if (!['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(url.protocol)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported MQTT protocol', path: ['url'] });
    }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    if ((url.protocol === 'mqtt:' || url.protocol === 'ws:') && !local && !value.allowInsecurePlaintext) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plaintext MQTT off localhost requires allowInsecurePlaintext.',
        path: ['url'],
      });
    }
    if (!value.allowAnonymous && (!value.username || !value.password)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MQTT username and password are required.',
        path: ['username'],
      });
    }
    const topics = new Set<string>();
    for (const device of value.devices) {
      if (topics.has(device.stateTopic)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate state topic', path: ['devices'] });
      }
      topics.add(device.stateTopic);
    }
  });

export type MqttConnectionConfig = z.infer<typeof mqttConnectionSchema>;

export function parseMqttState(
  format: MqttDeviceMapping['stateFormat'],
  payload: string,
  capabilities: CapabilityId[],
): CapabilityStateMap {
  if (format === 'on_off_raw') {
    const token = payload.trim().toLowerCase();
    if (token !== 'on' && token !== 'off') {
      throw new AdapterError('invalid_payload', 'Raw on/off payload was rejected.', 'mqtt');
    }
    return { on_off: parseObserved('on_off', { on: token === 'on' }) };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    throw new AdapterError('invalid_payload', 'MQTT payload is not JSON.', 'mqtt');
  }
  if (format === 'on_off_json') {
    const on = json && typeof json === 'object' && !Array.isArray(json) ? (json as { on?: unknown }).on : undefined;
    if (typeof on !== 'boolean') {
      throw new AdapterError('invalid_payload', 'on_off JSON must include a boolean on field.', 'mqtt');
    }
    return { on_off: parseObserved('on_off', { on }) };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new AdapterError('invalid_payload', 'Capability map payload is not an object.', 'mqtt');
  }
  const observed: CapabilityStateMap = {};
  for (const capability of capabilities) {
    const value = (json as Record<string, unknown>)[capability];
    if (value !== undefined) observed[capability] = parseObserved(capability, value);
  }
  if (Object.keys(observed).length === 0) {
    throw new AdapterError('invalid_payload', 'Capability map did not contain a declared capability.', 'mqtt');
  }
  return observed;
}

export function buildMqttCommand(
  mapping: MqttDeviceMapping,
  command: AdapterCommand,
): { topic: string; payload: string } {
  if (!mapping.commandTopic) {
    throw new AdapterError('unsupported', 'This MQTT device has no command topic.', command.correlationId);
  }
  if (mapping.stateFormat === 'on_off_raw' && command.capability === 'on_off' && command.action === 'set') {
    const on = command.params.on === true;
    return { topic: mapping.commandTopic, payload: on ? 'on' : 'off' };
  }
  if (mapping.stateFormat === 'on_off_json' && command.capability === 'on_off') {
    return {
      topic: mapping.commandTopic,
      payload: JSON.stringify({ on: command.params.on === true, correlationId: command.correlationId }),
    };
  }
  return {
    topic: mapping.commandTopic,
    payload: JSON.stringify({
      capability: command.capability,
      action: command.action,
      params: command.params,
      correlationId: command.correlationId,
    }),
  };
}

interface CachedDevice {
  mapping: MqttDeviceMapping;
  observed: CapabilityStateMap;
  online: boolean;
}

export class MqttAdapter implements DeviceAdapter {
  readonly manifest: AdapterManifest = {
    id: 'mqtt',
    name: 'MQTT',
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
    simulated: false,
  };

  private client: MqttClient | null = null;
  private config: MqttConnectionConfig | null = null;
  private readonly cache = new Map<string, CachedDevice>();
  private readonly listeners = new Set<(event: AdapterEvent) => void>();
  private status: IntegrationHealth['status'] = 'disabled';
  private statusMessage = 'MQTT is not configured.';

  async connect(config?: unknown): Promise<void> {
    const parsed = mqttConnectionSchema.parse(config);
    await this.disconnect();
    this.config = parsed;
    this.cache.clear();
    for (const mapping of parsed.devices) {
      this.cache.set(mapping.localId, { mapping, observed: {}, online: false });
    }
    this.status = 'degraded';
    this.statusMessage = 'Connecting to the MQTT broker.';
    const client = mqtt.connect(parsed.url, {
      username: parsed.username,
      password: parsed.password,
      clientId: parsed.clientId,
      rejectUnauthorized: parsed.rejectUnauthorized,
      reconnectPeriod: 2_000,
      connectTimeout: parsed.connectTimeoutMs,
      protocolVersion: 4,
    });
    this.client = client;
    client.on('connect', () => {
      this.status = 'healthy';
      this.statusMessage = `Connected. ${parsed.devices.length} mapped devices.`;
      for (const mapping of parsed.devices) {
        client.subscribe(mapping.stateTopic, { qos: 1 }, () => undefined);
      }
      this.emit({ deviceRef: '*', kind: 'connected', at: new Date().toISOString() });
    });
    client.on('reconnect', () => {
      this.status = 'degraded';
      this.statusMessage = 'Reconnecting to the MQTT broker.';
    });
    client.on('error', () => {
      this.status = 'degraded';
      this.statusMessage = 'MQTT client reported a transport error.';
    });
    client.on('close', () => {
      if (this.status === 'healthy') {
        this.status = 'offline';
        this.statusMessage = 'MQTT connection closed.';
      }
    });
    client.on('message', (topic, payload) => {
      this.onMessage(topic, payload.toString('utf8'));
    });
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const fail = () => reject(new AdapterError('transport', 'MQTT connection failed.', 'mqtt', true));
        client.once('connect', () => resolve());
        client.once('error', fail);
      }),
      parsed.connectTimeoutMs,
      'mqtt-connect',
    );
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.config = null;
    this.cache.clear();
    this.status = 'disabled';
    this.statusMessage = 'MQTT is disconnected.';
    if (!client) return;
    await new Promise<void>((resolve) => client.end(true, {}, () => resolve()));
  }

  async discover(): Promise<AdapterDevice[]> {
    return this.listDevices();
  }

  async listDevices(): Promise<AdapterDevice[]> {
    return [...this.cache.values()].map((entry) => toAdapterDevice(entry));
  }

  async getCapabilities(deviceRef: string): Promise<CapabilityId[]> {
    return this.require(deviceRef).mapping.capabilities;
  }

  async readState(deviceRef: string): Promise<CapabilityStateMap> {
    const entry = this.require(deviceRef);
    if (!entry.online && Object.keys(entry.observed).length === 0) {
      throw new AdapterError('disconnected', 'No MQTT state has been observed for this device.', deviceRef, true);
    }
    return structuredClone(entry.observed);
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterCommandResult> {
    const entry = this.require(command.deviceRef);
    const client = this.client;
    if (!client || this.status !== 'healthy') {
      throw new AdapterError('disconnected', 'MQTT broker is not connected.', command.correlationId, true);
    }
    if (!entry.mapping.capabilities.includes(command.capability)) {
      throw new AdapterError('unsupported', 'Capability is not declared for this MQTT device.', command.correlationId);
    }
    const built = buildMqttCommand(entry.mapping, command);
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        client.publish(built.topic, built.payload, { qos: 1, retain: false }, (error) => {
          if (error) reject(new AdapterError('transport', 'MQTT publish failed.', command.correlationId, true));
          else resolve();
        });
      }),
      command.timeoutMs,
      command.correlationId,
    );
    return {
      correlationId: command.correlationId,
      accepted: true,
      delivered: true,
      message: 'Command published to the configured topic. Device state is not verified until a state message arrives.',
    };
  }

  subscribeToEvents(handler: (event: AdapterEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  async healthCheck(): Promise<IntegrationHealth> {
    return {
      adapterId: 'mqtt',
      status: this.status,
      message: this.statusMessage,
      checkedAt: new Date().toISOString(),
      details: {
        configured: Boolean(this.config),
        devices: this.cache.size,
        authenticated: Boolean(this.config?.username),
        tls: this.config ? new URL(this.config.url).protocol === 'mqtts:' || new URL(this.config.url).protocol === 'wss:' : false,
      },
    };
  }

  private onMessage(topic: string, payload: string): void {
    const entry = [...this.cache.values()].find((item) => item.mapping.stateTopic === topic);
    if (!entry) return;
    try {
      const observed = parseMqttState(entry.mapping.stateFormat, payload, entry.mapping.capabilities);
      entry.observed = { ...entry.observed, ...observed };
      entry.online = true;
      const capability = Object.keys(observed)[0] as CapabilityId | undefined;
      this.emit({
        deviceRef: entry.mapping.localId,
        kind: 'state',
        capability,
        observed: structuredClone(entry.observed),
        at: new Date().toISOString(),
      });
    } catch (error) {
      this.emit({
        deviceRef: entry.mapping.localId,
        kind: 'rejected',
        message: error instanceof Error ? error.message : 'Rejected MQTT payload',
        at: new Date().toISOString(),
      });
    }
  }

  private require(deviceRef: string): CachedDevice {
    const entry = this.cache.get(deviceRef);
    if (!entry) throw new AdapterError('unsupported', 'Unknown MQTT device.', deviceRef);
    return entry;
  }

  private emit(event: AdapterEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function toAdapterDevice(entry: CachedDevice): AdapterDevice {
  return {
    ref: entry.mapping.localId,
    name: entry.mapping.name,
    manufacturer: null,
    capabilities: entry.mapping.capabilities,
    observed: structuredClone(entry.observed),
    metadata: {
      simulated: false,
      stateTopic: entry.mapping.stateTopic,
      commandTopic: entry.mapping.commandTopic ?? '',
    },
  };
}
