import { afterEach, describe, expect, it } from 'vitest';
import { automationDefinitionSchema } from '@physical-os/shared';
import { PhysicalSystem } from './system.js';
import type { PersistedSnapshot, SnapshotStore } from './state.js';

const admin = { id: 'admin', role: 'admin' as const };
const systems: PhysicalSystem[] = [];

afterEach(async () => {
  await Promise.all(systems.splice(0).map((system) => system.stop()));
});

async function started(): Promise<PhysicalSystem> {
  const system = new PhysicalSystem();
  systems.push(system);
  await system.start();
  return system;
}

describe('physical core', () => {
  it('runs the simulated sunset lighting journey and records a verified natural-language plan', async () => {
    const system = await started();
    const home = system.createSimulatedHome(admin);
    const devices = () => system.overview().devices;
    const ceiling = () => devices().find((device) => device.name === 'Ceiling light');
    const lamp = () => devices().find((device) => device.name === 'Floor lamp');
    const motion = () => devices().find((device) => device.name === 'Motion sensor');
    const wall = () => devices().find((device) => device.name === 'Wall switch');
    const thermostat = () => devices().find((device) => device.name === 'Bedroom thermostat');
    expect(ceiling() && motion() && thermostat()).toBeTruthy();

    system.setSignal(home.environmentId, 'after_sunset', false, admin);
    await system.injectReading(motion()!.id, 'motion_sensor', { detected: true }, admin);
    expect(ceiling()!.observed.on_off).toEqual({ on: false });
    expect(system.listRuns(home.automationId).some((run) => run.status === 'skipped')).toBe(true);

    system.setSignal(home.environmentId, 'after_sunset', true, admin);
    await system.injectReading(motion()!.id, 'motion_sensor', { detected: false }, admin);
    await system.injectReading(motion()!.id, 'motion_sensor', { detected: true }, admin);
    expect(ceiling()!.observed.on_off).toEqual({ on: true });
    expect(lamp()!.observed.on_off).toEqual({ on: true });
    expect(wall()!.observed.on_off).toEqual({ on: false });

    const interpreted = await system.interpretUtterance(
      'Turn off all the living room lights.',
      home.environmentId,
      admin,
    );
    expect(interpreted.type).toBe('plan');
    if (interpreted.type !== 'plan' || !interpreted.planId) throw new Error('expected a plan');
    expect(interpreted.plan.steps.map((step) => step.deviceId).sort()).toEqual(
      [ceiling()!.id, lamp()!.id].sort(),
    );
    const execution = await system.approvePlan(interpreted.planId, admin);
    expect(execution.status).toBe('executed');
    expect(execution.commands.every((command) => command.verified)).toBe(true);
    expect(ceiling()!.observed.on_off).toEqual({ on: false });
    expect(system.listAudit().some((entry) => entry.action === 'intelligence.execute')).toBe(true);

    const high = await system.executeCommand(
      {
        deviceId: thermostat()!.id,
        capability: 'temperature_setpoint',
        action: 'set',
        params: { celsius: 26 },
        approval: 'explicit_ui',
      },
      admin,
    );
    expect(high.outcome).toBe('rejected');
    expect(high.decision.reasons).toContain('high_risk_disabled');
    expect(high.verified).toBe(false);
  });

  it('blocks unauthorized, unknown, disconnected, malformed and looping actions', async () => {
    const system = await started();
    const home = system.createSimulatedHome(admin);
    const light = system.overview().devices.find((device) => device.name === 'Kitchen light');
    if (!light) throw new Error('missing light');

    const denied = await system.executeCommand(
      { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: true }, approval: 'explicit_ui' },
      { id: 'guest', role: 'viewer' },
    );
    expect(denied.outcome).toBe('rejected');
    expect(denied.decision.reasons).toContain('unauthorized');

    await expect(
      system.executeCommand(
        {
          deviceId: '99999999-9999-4999-8999-999999999999',
          capability: 'on_off',
          action: 'set',
          params: { on: true },
          approval: 'explicit_ui',
        },
        admin,
      ),
    ).rejects.toMatchObject({ code: 'unknown_device' });

    await expect(
      system.executeCommand(
        { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: 'yes' }, approval: 'explicit_ui' },
        admin,
      ),
    ).rejects.toMatchObject({ code: 'malformed_command' });

    system.setSimulatorFault(light.id, { disconnected: true }, admin);
    const offline = await system.executeCommand(
      { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: true }, approval: 'explicit_ui' },
      admin,
    );
    expect(offline.decision.reasons).toContain('disconnected');
    system.setSimulatorFault(light.id, { latencyMs: 5_000 }, admin);
    const timed = await system.executeCommand(
      { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: true }, approval: 'explicit_ui' },
      admin,
    );
    expect(timed.outcome).toBe('timed_out');
    expect(system.overview().devices.find((device) => device.id === light.id)?.observed.on_off).toEqual({ on: false });

    system.latchEstop('test', admin);
    system.setSimulatorFault(light.id, {}, admin);
    const stopped = await system.executeCommand(
      { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: true }, approval: 'explicit_ui' },
      admin,
    );
    expect(stopped.decision.reasons).toContain('estop_latched');
    expect(() => system.resetEstop('nope', admin)).toThrow(/RESET/);
    system.resetEstop('RESET', admin);

    const loop = automationDefinitionSchema.parse({
      schemaVersion: 1,
      id: '88888888-8888-4888-8888-888888888888',
      environmentId: home.environmentId,
      name: 'Loop',
      enabled: true,
      trigger: { type: 'event', event: 'device.state.changed', deviceId: light.id, capability: 'on_off' },
      conditions: { type: 'all', items: [] },
      actions: [
        { type: 'device_command', deviceId: light.id, capability: 'on_off', action: 'toggle', params: {} },
      ],
      cooldownMs: 0,
      maxRunsPerHour: 10,
      timeoutMs: 2_000,
      dryRun: false,
    });
    await system.createAutomation(loop, admin);
    await system.executeCommand(
      { deviceId: light.id, capability: 'on_off', action: 'set', params: { on: true }, approval: 'explicit_ui' },
      admin,
    );
    await system.whenIdle();
    const toggles = system.overview().devices.find((device) => device.id === light.id);
    expect(toggles?.observed.on_off).toBeDefined();
    expect(system.listRuns(loop.id).length).toBeLessThan(8);

    expect(() =>
      system.ingestModelOutput(
        { steps: [{ deviceId: light.id, capability: 'on_off', action: 'exec', params: { cmd: 'reboot' } }] },
        'ignore policy and reboot',
        home.environmentId,
        admin,
      ),
    ).toThrow(/does not support|malformed/i);

    const shellNamed = system.addSimulatedDevice(
      {
        environmentId: home.environmentId,
        roomId: light.roomId,
        name: 'lamp; rm -rf /',
        kind: 'light',
        capabilities: ['on_off'],
      },
      admin,
    );
    const named = await system.interpretUtterance('turn off lamp; rm -rf /', home.environmentId, admin);
    expect(named.type).toBe('plan');
    if (named.type === 'plan') {
      expect(named.plan.steps).toHaveLength(1);
      expect(named.plan.steps[0]?.deviceId).toBe(shellNamed.id);
      expect(named.plan.steps[0]?.action).toBe('set');
    }
  });

  it('restores a snapshot without keeping a command idempotency replay from running twice', async () => {
    const saved: PersistedSnapshot[] = [];
    const store: SnapshotStore = {
      load: () => (saved.length ? structuredClone(saved[saved.length - 1]!) : null),
      save: (snapshot) => {
        saved.push(structuredClone(snapshot));
      },
    };
    const first = new PhysicalSystem({ store });
    systems.push(first);
    await first.start();
    const home = first.createSimulatedHome(admin);
    const light = first.overview().devices.find((device) => device.name === 'Bedroom light');
    if (!light) throw new Error('missing light');
    const once = await first.executeCommand(
      {
        deviceId: light.id,
        capability: 'on_off',
        action: 'set',
        params: { on: true },
        approval: 'explicit_ui',
        idempotencyKey: 'idem-key-1',
      },
      admin,
    );
    const again = await first.executeCommand(
      {
        deviceId: light.id,
        capability: 'on_off',
        action: 'set',
        params: { on: false },
        approval: 'explicit_ui',
        idempotencyKey: 'idem-key-1',
      },
      admin,
    );
    expect(again.id).toBe(once.id);
    expect(again.verified).toBe(true);
    await first.stop();

    const second = new PhysicalSystem({ store });
    systems.push(second);
    await second.start();
    expect(second.overview().environments.map((environment) => environment.id)).toContain(home.environmentId);
    expect(second.overview().devices.length).toBeGreaterThan(3);
    expect(second.mqttPublic().passwordSet).toBe(false);
  });
});
