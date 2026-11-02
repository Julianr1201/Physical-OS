import { describe, expect, it } from 'vitest';
import { automationDefinitionSchema, type Automation, type Device } from '@physical-os/shared';
import { evaluateCondition } from './index.js';

const env = '11111111-1111-4111-8111-111111111111';
const motion = '22222222-2222-4222-8222-222222222222';
const light = '33333333-3333-4333-8333-333333333333';

function automation(conditions: Automation['conditions']): Automation {
  return automationDefinitionSchema.parse({
    schemaVersion: 1,
    id: '44444444-4444-4444-8444-444444444444',
    environmentId: env,
    name: 'Motion lights',
    enabled: true,
    trigger: {
      type: 'event',
      event: 'device.state.changed',
      deviceId: motion,
      capability: 'motion_sensor',
      match: { detected: true },
    },
    conditions,
    actions: [
      {
        type: 'device_command',
        deviceId: light,
        capability: 'on_off',
        action: 'set',
        params: { on: true },
      },
    ],
  });
}

function device(id: string, capability: 'motion_sensor' | 'on_off', observed: unknown): Device {
  return {
    id,
    environmentId: env,
    roomId: '55555555-5555-4555-8555-555555555555',
    name: id,
    manufacturer: null,
    adapterId: 'simulator',
    adapterDeviceRef: id,
    capabilities: [capability],
    connectivity: 'online',
    observed: { [capability]: observed },
    desired: {},
    observedAt: null,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

describe('automation conditions', () => {
  it('requires the sunset signal and a matching sensor state', () => {
    const rule = automation({
      type: 'all',
      items: [
        { type: 'signal', signal: 'after_sunset', equals: true },
        { type: 'state', deviceId: motion, capability: 'motion_sensor', match: { detected: true } },
      ],
    });
    const devices = new Map<string, Device>([
      [motion, device(motion, 'motion_sensor', { detected: true })],
    ]);
    const ctx = {
      now: () => new Date('2026-11-01T02:00:00.000Z'),
      device: (id: string) => devices.get(id) ?? null,
      signal: (_environmentId: string, name: string) => (name === 'after_sunset' ? false : undefined),
    };
    expect(evaluateCondition(rule.conditions, rule, ctx)).toBe(false);
    const afterSunset = {
      ...ctx,
      signal: () => true as const,
    };
    expect(evaluateCondition(rule.conditions, rule, afterSunset)).toBe(true);
  });

  it('composes boolean conditions', () => {
    const rule = automation({
      type: 'not',
      item: { type: 'signal', signal: 'after_sunset', equals: true },
    });
    const ctx = {
      now: () => new Date(),
      device: () => null,
      signal: () => false as const,
    };
    expect(evaluateCondition(rule.conditions, rule, ctx)).toBe(true);
  });
});
