import { createServer, type Server } from 'node:net';
import { describe, expect, it, afterEach } from 'vitest';
import aedes from 'aedes';
import mqtt from 'mqtt';
import { MqttAdapter, parseMqttState } from './index.js';

describe('MQTT payload policy', () => {
  it('rejects untrusted fields and non JSON command lookalikes', () => {
    expect(parseMqttState('on_off_json', JSON.stringify({ on: true, cmd: 'reboot' }), ['on_off'])).toEqual({
      on_off: { on: true },
    });
    expect(() => parseMqttState('on_off_raw', 'reboot', ['on_off'])).toThrow(/rejected/i);
    expect(() => parseMqttState('capability_map', JSON.stringify({ shell: 'rm' }), ['on_off'])).toThrow(
      /declared capability/i,
    );
  });
});

describe('MQTT adapter against a local broker', () => {
  const open: Array<{ server: Server; close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (open.length > 0) {
      const item = open.pop();
      if (item) await item.close();
    }
  });

  it('authenticates, ingests state, publishes a command, and ignores a bad payload', async () => {
    const createBroker = aedes as unknown as () => {
      handle: (socket: unknown) => void;
      close: (callback: () => void) => void;
      authenticate: (
        client: unknown,
        username: unknown,
        password: Buffer | undefined,
        done: (error: Error | null, success?: boolean) => void,
      ) => void;
    };
    const broker = createBroker();
    broker.authenticate = (_client, username, password, done) => {
      const presented = typeof password === 'string' || Buffer.isBuffer(password) ? password.toString() : '';
      const ok = username === 'physical' && presented === 'secret';
      done(null, ok);
    };
    const server = createServer(broker.handle);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No port');
    open.push({
      server,
      close: () =>
        new Promise((resolve) => {
          broker.close(() => server.close(() => resolve()));
        }),
    });

    const adapter = new MqttAdapter();
    const rejected: string[] = [];
    const states: string[] = [];
    adapter.subscribeToEvents((event) => {
      if (event.kind === 'rejected') rejected.push(event.message ?? '');
      if (event.kind === 'state') states.push(event.deviceRef);
    });
    const roomId = '11111111-1111-4111-8111-111111111111';
    await adapter.connect({
      url: `mqtt://127.0.0.1:${address.port}`,
      username: 'physical',
      password: 'secret',
      clientId: 'physical-os-test',
      rejectUnauthorized: true,
      connectTimeoutMs: 4_000,
      allowAnonymous: false,
      allowInsecurePlaintext: false,
      devices: [
        {
          localId: 'porch-light',
          name: 'Porch light',
          roomId,
          capabilities: ['on_off'],
          stateTopic: 'home/porch/light/state',
          commandTopic: 'home/porch/light/set',
          stateFormat: 'on_off_json',
        },
      ],
    });

    const probe = mqtt.connect(`mqtt://127.0.0.1:${address.port}`, {
      username: 'physical',
      password: 'secret',
      clientId: 'probe',
      reconnectPeriod: 0,
    });
    await new Promise<void>((resolve, reject) => {
      probe.once('connect', () => resolve());
      probe.once('error', reject);
    });
    const received: string[] = [];
    await new Promise<void>((resolve, reject) => {
      probe.subscribe('home/porch/light/set', { qos: 1 }, (error) => (error ? reject(error) : resolve()));
    });
    probe.on('message', (_topic, payload) => received.push(payload.toString()));

    probe.publish('home/porch/light/state', JSON.stringify({ on: false }), { qos: 1 });
    probe.publish('home/porch/light/state', 'not-json', { qos: 1 });
    await waitFor(() => states.length >= 1 && rejected.length >= 1);
    expect(await adapter.readState('porch-light')).toEqual({ on_off: { on: false } });

    await adapter.executeCommand({
      deviceRef: 'porch-light',
      capability: 'on_off',
      action: 'set',
      params: { on: true },
      correlationId: '22222222-2222-4222-8222-222222222222',
      timeoutMs: 2_000,
    });
    await waitFor(() => received.some((payload) => payload.includes('"on":true')));
    expect(received.some((payload) => payload.includes('rm ') || payload.includes('exec'))).toBe(false);

    probe.end(true);
    await adapter.disconnect();
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 5_000) throw new Error('Timed out waiting for MQTT');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
