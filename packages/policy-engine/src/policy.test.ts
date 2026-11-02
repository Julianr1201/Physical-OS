import { describe, expect, it } from 'vitest';
import { evaluatePolicy, type PolicyInput } from './index.js';

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    actor: { id: 'admin', role: 'admin' },
    capability: 'on_off',
    action: 'set',
    device: {
      id: 'device',
      connectivity: 'online',
      simulated: true,
      isolatedSimulator: true,
    },
    estopLatched: false,
    approval: 'none',
    settings: {
      requireMediumConfirmation: true,
      allowIsolatedSimulatedHighRisk: false,
    },
    ...overrides,
  };
}

describe('policy engine', () => {
  it('denies viewers, unknown actions, disconnected devices and estop actuation', () => {
    expect(evaluatePolicy(input({ actor: { id: 'v', role: 'viewer' } })).reasons).toContain(
      'unauthorized',
    );
    expect(evaluatePolicy(input({ action: 'explode' })).reasons).toContain('unknown_action');
    expect(
      evaluatePolicy(input({ device: { ...input().device, connectivity: 'offline' } })).reasons,
    ).toContain('disconnected');
    expect(evaluatePolicy(input({ estopLatched: true })).reasons).toContain('estop_latched');
  });

  it('requires confirmation for medium risk and blocks high risk by default', () => {
    expect(evaluatePolicy(input()).effect).toBe('require_approval');
    expect(evaluatePolicy(input({ approval: 'explicit_ui' })).effect).toBe('allow');
    const high = evaluatePolicy(
      input({ capability: 'temperature_setpoint', approval: 'explicit_ui' }),
    );
    expect(high.effect).toBe('deny');
    expect(high.reasons).toContain('high_risk_disabled');
  });

  it('allows isolated simulated high risk only with the flag and an approval', () => {
    const settings = {
      requireMediumConfirmation: true,
      allowIsolatedSimulatedHighRisk: true,
    };
    expect(
      evaluatePolicy(input({ capability: 'temperature_setpoint', settings })).effect,
    ).toBe('require_approval');
    expect(
      evaluatePolicy(
        input({ capability: 'temperature_setpoint', settings, approval: 'plan_approval' }),
      ).effect,
    ).toBe('allow');
    expect(
      evaluatePolicy(
        input({
          capability: 'temperature_setpoint',
          settings,
          approval: 'automation_rule',
          actor: { id: 'auto', role: 'automation' },
        }),
      ).effect,
    ).toBe('deny');
  });

  it('lets an enabled automation perform medium risk actions and not unknown ones', () => {
    expect(
      evaluatePolicy(
        input({
          actor: { id: 'auto', role: 'automation' },
          approval: 'automation_rule',
        }),
      ).effect,
    ).toBe('allow');
  });
});
