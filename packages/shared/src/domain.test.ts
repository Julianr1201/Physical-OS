import { describe, expect, it } from 'vitest';
import { capabilityCatalog, getCapability } from './capabilities.js';
import { automationDefinitionSchema, deviceSchema, valuesMatch } from './domain.js';
import { DomainError } from './errors.js';

describe('capability catalog', () => {
  it('validates composable capability state and rejects unknown fields', () => {
    const parsed = capabilityCatalog.on_off.stateSchema.safeParse({ on: true });
    expect(parsed.success).toBe(true);
    const extra = capabilityCatalog.on_off.stateSchema.safeParse({ on: true, shell: 'rm' });
    expect(extra.success).toBe(false);
    expect(getCapability('not_a_capability')).toBeUndefined();
  });

  it('classifies heater setpoints as high risk and sensing as low risk', () => {
    expect(capabilityCatalog.temperature_setpoint.risk).toBe('high');
    expect(capabilityCatalog.temperature_sensor.risk).toBe('low');
    expect(capabilityCatalog.temperature_sensor.readOnly).toBe(true);
    expect(capabilityCatalog.position.actions).toEqual({});
  });
});

describe('domain schemas', () => {
  it('rejects a device without capabilities', () => {
    const result = deviceSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      environmentId: '11111111-1111-4111-8111-111111111111',
      roomId: '11111111-1111-4111-8111-111111111111',
      name: 'Lamp',
      manufacturer: null,
      adapterId: 'simulator',
      adapterDeviceRef: 'sim',
      capabilities: [],
      connectivity: 'online',
      observed: {},
      desired: {},
      observedAt: null,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('requires interval automations to declare everyMs', () => {
    const result = automationDefinitionSchema.safeParse({
      schemaVersion: 1,
      id: '11111111-1111-4111-8111-111111111111',
      environmentId: '22222222-2222-4222-8222-222222222222',
      name: 'Pulse',
      enabled: true,
      trigger: { type: 'time', mode: 'interval' },
      conditions: { type: 'all', items: [] },
      actions: [
        {
          type: 'device_command',
          deviceId: '33333333-3333-4333-8333-333333333333',
          capability: 'on_off',
          action: 'set',
          params: { on: true },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('matches nested state without treating extra observed fields as failure', () => {
    expect(valuesMatch({ on: true }, { on: true, extra: false })).toBe(true);
    expect(valuesMatch({ on: true }, { on: false })).toBe(false);
  });
});

describe('DomainError', () => {
  it('keeps a stable code', () => {
    const error = new DomainError('unknown_device', 'Missing', 404);
    expect(error.code).toBe('unknown_device');
    expect(error.httpStatus).toBe(404);
  });
});
