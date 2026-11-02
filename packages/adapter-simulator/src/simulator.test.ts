import { describe, expect, it } from 'vitest';
import { SimulatorAdapter } from './index.js';

describe('simulator adapter', () => {
  it('toggles a light and can inject motion', async () => {
    const adapter = new SimulatorAdapter();
    await adapter.connect();
    const light = adapter.addDevice({
      name: 'Ceiling',
      capabilities: ['on_off', 'brightness'],
      metadata: { kind: 'light' },
    });
    const result = await adapter.executeCommand({
      deviceRef: light.ref,
      capability: 'on_off',
      action: 'set',
      params: { on: true },
      correlationId: '11111111-1111-4111-8111-111111111111',
      timeoutMs: 500,
    });
    expect(result.delivered).toBe(true);
    expect(await adapter.readState(light.ref)).toMatchObject({ on_off: { on: true } });

    const motion = adapter.addDevice({
      name: 'Motion',
      capabilities: ['motion_sensor'],
      metadata: { kind: 'motion_sensor' },
    });
    adapter.writeCapability(motion.ref, 'motion_sensor', { detected: true });
    expect(await adapter.readState(motion.ref)).toMatchObject({ motion_sensor: { detected: true } });
  });

  it('does not apply a command when the device is disconnected or too slow', async () => {
    const adapter = new SimulatorAdapter();
    const light = adapter.addDevice({ name: 'Lamp', capabilities: ['on_off'], metadata: { kind: 'light' } });
    adapter.setFault(light.ref, { disconnected: true });
    await expect(
      adapter.executeCommand({
        deviceRef: light.ref,
        capability: 'on_off',
        action: 'set',
        params: { on: true },
        correlationId: '11111111-1111-4111-8111-111111111111',
        timeoutMs: 200,
      }),
    ).rejects.toMatchObject({ code: 'disconnected' });

    adapter.setFault(light.ref, { latencyMs: 400 });
    await expect(
      adapter.executeCommand({
        deviceRef: light.ref,
        capability: 'on_off',
        action: 'set',
        params: { on: true },
        correlationId: '22222222-2222-4222-8222-222222222222',
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
    expect(await adapter.readState(light.ref)).toMatchObject({ on_off: { on: false } });
  });
});
