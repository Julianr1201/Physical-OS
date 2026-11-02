import { randomUUID } from 'node:crypto';
import {
  AdapterError,
  DomainError,
  automationDefinitionSchema,
  capabilityCatalog,
  deviceSchema,
  environmentSchema,
  readDeviceKind,
  roomSchema,
  valuesMatch,
  type Actor,
  type AuditEntry,
  type Automation,
  type CapabilityId,
  type CapabilityStateMap,
  type Causation,
  type CommandRecord,
  type CommandRequest,
  type Device,
  type DomainEvent,
  type ExecutionPlan,
  type IntegrationHealth,
  type PhysicalEnvironment,
  type Room,
  type SignalValue,
} from '@physical-os/shared';
import { EventBus } from '@physical-os/event-bus';
import { parseAction, stateVerified } from '@physical-os/device-sdk';
import { evaluatePolicy } from '@physical-os/policy-engine';
import { SimulatorAdapter, type SimulatorFault } from '@physical-os/adapter-simulator';
import {
  MqttAdapter,
  mqttConnectionSchema,
  type MqttConnectionConfig,
} from '@physical-os/adapter-mqtt';
import type { AdapterEvent } from '@physical-os/adapter-sdk';
import { AutomationEngine, automationActor, type AutomationHost } from '@physical-os/automation-engine';
import {
  interpret,
  validateExternalPlan,
  type Interpretation,
  type LlmPlanProvider,
} from '@physical-os/intelligence';
import { DomainState, type SnapshotStore, type StoredPlan } from './state.js';

const COMMAND_TIMEOUT_MS = 4_000;
const PLAN_TTL_MS = 10 * 60 * 1000;

export interface SystemOptions {
  now?: () => Date;
  store?: SnapshotStore;
  allowIsolatedSimulatedHighRisk?: boolean;
  llm?: LlmPlanProvider | null;
}

export interface PlanExecution {
  plan: ExecutionPlan;
  status: StoredPlan['status'];
  commands: CommandRecord[];
  explanation: string;
}

export class PhysicalSystem {
  readonly bus = new EventBus();
  readonly simulator = new SimulatorAdapter();
  private readonly state = new DomainState();
  private readonly automations: AutomationEngine;
  private mqtt: MqttAdapter | null = null;
  private mqttUnsub: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private started = false;

  constructor(private readonly options: SystemOptions = {}) {
    this.automations = new AutomationEngine(this.createHost(), () => [...this.state.automations.values()]);
  }

  async start(): Promise<void> {
    if (this.started) return;
    const loaded = this.options.store ? await this.options.store.load() : null;
    if (loaded?.version === 1) this.state.hydrate(loaded);
    await this.simulator.connect();
    for (const device of this.state.devices.values()) {
      if (device.adapterId !== 'simulator') continue;
      this.simulator.addDevice({
        ref: device.adapterDeviceRef,
        name: device.name,
        manufacturer: device.manufacturer,
        capabilities: device.capabilities,
        metadata: device.metadata,
        observed: device.observed,
      });
    }
    this.bus.subscribe('device.state.changed', (event) => this.automations.handle(event));
    this.bus.subscribe('sensor.reading.received', (event) => this.automations.handle(event));
    this.bus.subscribe('environment.signal.changed', (event) => this.automations.handle(event));
    if (this.state.mqtt) {
      try {
        await this.connectMqtt(this.state.mqtt, { id: 'system', role: 'admin' }, true);
      } catch (error) {
        this.audit({ id: 'system', role: 'admin' }, 'mqtt.connect', 'failed', null, null, {
          message: error instanceof Error ? error.message : 'connect failed',
        });
      }
    }
    this.timer = setInterval(() => {
      void this.automations.tick().catch(() => undefined);
    }, 15_000);
    this.timer.unref?.();
    this.started = true;
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persist(true);
    await this.writes;
    await this.mqtt?.disconnect();
    await this.simulator.disconnect();
    this.started = false;
  }

  async whenIdle(): Promise<void> {
    await this.bus.whenIdle();
    await this.writes;
  }

  overview(): {
    environments: PhysicalEnvironment[];
    rooms: Room[];
    devices: Device[];
    automations: Automation[];
    estop: DomainState['estop'];
    settings: DomainState['settings'];
    signals: Array<{ environmentId: string; name: string; value: SignalValue }>;
  } {
    return {
      environments: clone([...this.state.environments.values()]),
      rooms: clone([...this.state.rooms.values()]),
      devices: clone([...this.state.devices.values()]),
      automations: clone([...this.state.automations.values()]),
      estop: { ...this.state.estop },
      settings: { ...this.state.settings },
      signals: this.state.snapshot().signals,
    };
  }

  listAudit(limit = 100): AuditEntry[] {
    return this.state.audits.slice(-limit).reverse();
  }

  listRuns(automationId?: string) {
    const runs = automationId
      ? this.state.runs.filter((run) => run.automationId === automationId)
      : this.state.runs;
    return runs.slice(-100).reverse();
  }

  createEnvironment(name: string, actor: Actor): PhysicalEnvironment {
    this.requireAdmin(actor);
    const environment = environmentSchema.parse({
      id: randomUUID(),
      name,
      domain: 'home',
      simulated: false,
      createdAt: this.iso(),
    });
    this.state.environments.set(environment.id, environment);
    this.audit(actor, 'environment.create', 'recorded', null, environment.id, { name });
    this.persist(true);
    return environment;
  }

  createRoom(environmentId: string, name: string, actor: Actor): Room {
    this.requireAdmin(actor);
    this.requireEnvironment(environmentId);
    const room = roomSchema.parse({
      id: randomUUID(),
      environmentId,
      name,
      createdAt: this.iso(),
    });
    this.state.rooms.set(room.id, room);
    this.audit(actor, 'room.create', 'recorded', null, room.id, { name });
    this.persist(true);
    return room;
  }

  addSimulatedDevice(
    input: {
      environmentId: string;
      roomId: string;
      name: string;
      kind: string;
      capabilities: CapabilityId[];
    },
    actor: Actor,
  ): Device {
    this.requireAdmin(actor);
    const room = this.requireRoom(input.roomId);
    if (room.environmentId !== input.environmentId) {
      throw new DomainError('invalid_room', 'Room is not in that environment.', 422);
    }
    const device = this.registerSimulator({
      environmentId: input.environmentId,
      roomId: input.roomId,
      name: input.name,
      kind: input.kind,
      capabilities: input.capabilities,
    });
    this.audit(actor, 'device.create', 'recorded', null, device.id, { simulated: true });
    this.publish({
      type: 'device.discovered',
      deviceId: device.id,
      adapterId: 'simulator',
      correlationId: null,
      causation: null,
    });
    this.persist(true);
    return clone(device);
  }

  async executeCommand(request: CommandRequest, actor: Actor): Promise<CommandRecord> {
    if (request.idempotencyKey) {
      const existingId = this.state.idempotency.get(request.idempotencyKey);
      const existing = this.state.commands.find((command) => command.id === existingId);
      if (existing) return clone(existing);
    }
    const device = this.requireDevice(request.deviceId);
    if (!device.capabilities.includes(request.capability)) {
      throw new DomainError('unsupported_capability', 'The device does not expose that capability.', 422);
    }
    const parsed = parseAction(
      request.capability,
      request.action,
      request.params,
      device.observed[request.capability],
    );
    const decision = evaluatePolicy({
      actor,
      capability: parsed.capability,
      action: parsed.action,
      device: {
        id: device.id,
        connectivity: device.connectivity,
        simulated: device.metadata.simulated === true,
        isolatedSimulator:
          device.metadata.simulated === true && device.metadata.isolatedSimulator === true,
      },
      estopLatched: this.state.estop.latched,
      approval: request.approval,
      settings: {
        requireMediumConfirmation: this.state.settings.requireMediumConfirmation,
        allowIsolatedSimulatedHighRisk: this.options.allowIsolatedSimulatedHighRisk === true,
      },
    });
    const correlationId = request.correlationId ?? randomUUID();
    const record: CommandRecord = {
      id: randomUUID(),
      correlationId,
      deviceId: device.id,
      capability: parsed.capability,
      action: parsed.action,
      params: parsed.params,
      actorId: actor.id,
      approval: request.approval,
      decision,
      outcome: 'accepted',
      verified: false,
      errorCode: null,
      errorMessage: null,
      idempotencyKey: request.idempotencyKey ?? null,
      planId: request.planId ?? null,
      causation: request.causation ?? null,
      createdAt: this.iso(),
      completedAt: null,
    };
    this.remember(record);
    this.publish({
      type: 'command.requested',
      commandId: record.id,
      deviceId: device.id,
      outcome: 'accepted',
      decision,
      correlationId,
      causation: request.causation ?? null,
    });
    if (decision.effect === 'deny') {
      return this.finish(record, 'rejected', decision.reasons[0] ?? 'denied', 'Policy denied the command.');
    }
    if (decision.effect === 'require_approval') {
      record.outcome = 'awaiting_approval';
      this.audit(actor, 'command.requested', 'awaiting_approval', correlationId, device.id, {
        capability: parsed.capability,
        risk: decision.risk,
      });
      this.persist(true);
      return clone(record);
    }
    this.publish({
      type: 'command.authorized',
      commandId: record.id,
      deviceId: device.id,
      outcome: 'accepted',
      decision,
      correlationId,
      causation: request.causation ?? null,
    });
    if (parsed.expectedState) {
      device.desired = { ...device.desired, [parsed.capability]: parsed.expectedState };
    }
    try {
      const adapter = this.adapterFor(device);
      const delivery = await adapter.executeCommand({
        deviceRef: device.adapterDeviceRef,
        capability: parsed.capability,
        action: parsed.action,
        params: parsed.params,
        correlationId,
        timeoutMs: COMMAND_TIMEOUT_MS,
      });
      const observed = await adapter.readState(device.adapterDeviceRef);
      const verified = stateVerified(parsed.expectedState, observed[parsed.capability]);
      this.commitObserved(device, observed, parsed.capability, correlationId, request.causation ?? null);
      if (!delivery.delivered) {
        return this.finish(record, 'failed', 'not_delivered', 'The adapter did not deliver the command.');
      }
      if (!verified) {
        record.verified = false;
        return this.finish(
          record,
          'delivered',
          'state_not_verified',
          'The command was delivered, but the observed state does not confirm it.',
        );
      }
      record.verified = true;
      return this.finish(record, 'verified', null, null);
    } catch (error) {
      const code = error instanceof AdapterError ? error.code : 'failed';
      const outcome = code === 'timeout' ? 'timed_out' : 'failed';
      return this.finish(record, outcome, code, error instanceof Error ? error.message : 'Command failed.');
    }
  }

  async approveCommand(commandId: string, actor: Actor): Promise<CommandRecord> {
    this.requireAdmin(actor);
    const existing = this.requireCommand(commandId);
    if (existing.outcome !== 'awaiting_approval') {
      throw new DomainError('not_pending', 'That command is not waiting for approval.', 409);
    }
    existing.outcome = 'rejected';
    existing.errorCode = 'superseded';
    existing.errorMessage = 'Superseded by an approved command.';
    existing.completedAt = this.iso();
    return this.executeCommand(
      {
        deviceId: existing.deviceId,
        capability: existing.capability,
        action: existing.action,
        params: existing.params,
        approval: 'plan_approval',
        correlationId: existing.correlationId,
        planId: existing.planId ?? undefined,
        causation: existing.causation ?? undefined,
      },
      actor,
    );
  }

  rejectCommand(commandId: string, actor: Actor): CommandRecord {
    this.requireAdmin(actor);
    const existing = this.requireCommand(commandId);
    if (existing.outcome !== 'awaiting_approval') {
      throw new DomainError('not_pending', 'That command is not waiting for approval.', 409);
    }
    return this.finish(existing, 'rejected', 'rejected_by_user', 'An administrator rejected the command.');
  }

  setSignal(environmentId: string, name: string, value: SignalValue, actor: Actor): void {
    this.requireAdmin(actor);
    this.requireEnvironment(environmentId);
    if (name !== 'after_sunset' || typeof value !== 'boolean') {
      throw new DomainError(
        'unknown_signal',
        'The MVP sunset stand-in is the boolean signal after_sunset.',
        422,
      );
    }
    const bucket = this.state.signals.get(environmentId) ?? new Map<string, SignalValue>();
    bucket.set(name, value);
    this.state.signals.set(environmentId, bucket);
    this.audit(actor, 'signal.set', 'recorded', null, environmentId, { name, value, simulated: true });
    this.publish({
      type: 'environment.signal.changed',
      environmentId,
      signal: name,
      value,
      correlationId: null,
      causation: null,
    });
    this.persist(true);
  }

  async createAutomation(input: unknown, actor: Actor): Promise<Automation> {
    this.requireAdmin(actor);
    const automation = automationDefinitionSchema.parse(input);
    this.requireEnvironment(automation.environmentId);
    this.assertActions(automation);
    this.state.automations.set(automation.id, automation);
    this.audit(actor, 'automation.create', 'recorded', null, automation.id, { name: automation.name });
    this.persist(true);
    return clone(automation);
  }

  updateAutomation(id: string, patch: { enabled?: boolean; dryRun?: boolean; name?: string }, actor: Actor): Automation {
    this.requireAdmin(actor);
    const current = this.state.automations.get(id);
    if (!current) throw new DomainError('unknown_automation', 'Automation not found.', 404);
    const next = automationDefinitionSchema.parse({ ...current, ...patch });
    this.state.automations.set(id, next);
    this.audit(actor, 'automation.update', 'recorded', null, id, patch);
    this.persist(true);
    return clone(next);
  }

  async dryRun(id: string, actor: Actor) {
    this.requireAdmin(actor);
    const automation = this.state.automations.get(id);
    if (!automation) throw new DomainError('unknown_automation', 'Automation not found.', 404);
    const before = this.state.runs.length;
    await this.automations.manualDryRun(automation);
    const run = this.state.runs[this.state.runs.length - 1];
    if (!run || this.state.runs.length === before) {
      throw new DomainError('dry_run_failed', 'Dry run did not record a result.', 500);
    }
    return clone(run);
  }

  async injectReading(deviceId: string, capability: CapabilityId, value: unknown, actor: Actor): Promise<Device> {
    this.requireAdmin(actor);
    const device = this.requireDevice(deviceId);
    if (device.adapterId !== 'simulator') {
      throw new DomainError('unsupported_operation', 'Readings can only be injected into the simulator.', 422);
    }
    if (!capabilityCatalog[capability].readOnly) {
      throw new DomainError('unsupported_operation', 'Only sensor readings can be injected.', 422);
    }
    this.simulator.writeCapability(device.adapterDeviceRef, capability, value);
    const observed = await this.simulator.readState(device.adapterDeviceRef);
    this.commitObserved(device, observed, capability, randomUUID(), null);
    this.audit(actor, 'sensor.inject', 'recorded', null, device.id, { capability, simulated: true });
    await this.bus.whenIdle();
    return clone(this.requireDevice(deviceId));
  }

  setSimulatorFault(deviceId: string, fault: SimulatorFault, actor: Actor): Device {
    this.requireAdmin(actor);
    const device = this.requireDevice(deviceId);
    if (device.adapterId !== 'simulator') {
      throw new DomainError('unsupported_operation', 'Faults apply only to simulated devices.', 422);
    }
    this.simulator.setFault(device.adapterDeviceRef, fault);
    device.connectivity = fault.disconnected ? 'offline' : 'online';
    this.publish({
      type: fault.disconnected ? 'device.disconnected' : 'device.connected',
      deviceId: device.id,
      adapterId: 'simulator',
      correlationId: null,
      causation: null,
    });
    this.audit(actor, 'simulator.fault', 'recorded', null, device.id, { ...fault });
    this.persist(true);
    return clone(device);
  }

  latchEstop(reason: string, actor: Actor): void {
    this.requireAdmin(actor);
    this.state.estop = { latched: true, at: this.iso(), by: actor.id, reason: reason.slice(0, 200) };
    this.audit(actor, 'safety.estop', 'latched', null, null, {
      reason: this.state.estop.reason,
      note: 'Software stop only. This is not a hardware safety system.',
    });
    this.persist(true);
  }

  resetEstop(confirmation: string, actor: Actor): void {
    this.requireAdmin(actor);
    if (confirmation !== 'RESET') {
      throw new DomainError('confirmation_required', 'Type RESET to clear the software stop.', 422);
    }
    this.state.estop = { latched: false, at: this.iso(), by: actor.id, reason: null };
    this.audit(actor, 'safety.estop', 'reset', null, null, {});
    this.persist(true);
  }

  updateSettings(patch: { requireMediumConfirmation?: boolean }, actor: Actor): DomainState['settings'] {
    this.requireAdmin(actor);
    if (patch.requireMediumConfirmation !== undefined) {
      this.state.settings.requireMediumConfirmation = patch.requireMediumConfirmation;
    }
    this.audit(actor, 'settings.update', 'recorded', null, null, patch);
    this.persist(true);
    return { ...this.state.settings };
  }

  async interpretUtterance(utterance: string, environmentId: string, actor: Actor): Promise<Interpretation & { planId?: string }> {
    this.requireAdmin(actor);
    this.requireEnvironment(environmentId);
    const result = await interpret({
      utterance,
      environmentId,
      catalog: {
        rooms: [...this.state.rooms.values()],
        devices: [...this.state.devices.values()],
      },
      provider: this.options.llm ?? null,
      now: this.now(),
    });
    if (result.type === 'query') {
      this.audit(actor, 'intelligence.query', 'recorded', null, result.deviceId, {
        capability: result.capability,
      });
      return result;
    }
    if (result.type !== 'plan') {
      this.audit(actor, 'intelligence.interpret', result.type, null, environmentId, {
        message: result.message,
      });
      return result;
    }
    const stored = this.storePlan(result.plan, result.source, actor);
    return { ...result, plan: stored.plan, planId: stored.plan.id };
  }

  ingestModelOutput(raw: unknown, utterance: string, environmentId: string, actor: Actor): StoredPlan {
    this.requireAdmin(actor);
    const plan = validateExternalPlan(
      raw,
      environmentId,
      { rooms: [...this.state.rooms.values()], devices: [...this.state.devices.values()] },
      utterance,
      this.now(),
    );
    return this.storePlan(plan, 'llm', actor);
  }

  async approvePlan(planId: string, actor: Actor): Promise<PlanExecution> {
    this.requireAdmin(actor);
    const stored = this.requirePlan(planId);
    if (stored.status !== 'awaiting_approval' && stored.status !== 'proposed') {
      throw new DomainError('not_pending', 'That plan is not waiting for approval.', 409);
    }
    if (this.now().getTime() - Date.parse(stored.plan.createdAt) > PLAN_TTL_MS) {
      stored.status = 'expired';
      throw new DomainError('plan_expired', 'The plan expired. Interpret the request again.', 409);
    }
    const commands: CommandRecord[] = [];
    for (const step of stored.plan.steps) {
      const record = await this.executeCommand(
        {
          deviceId: step.deviceId,
          capability: step.capability,
          action: step.action,
          params: step.params,
          approval: 'plan_approval',
          planId: stored.plan.id,
          correlationId: randomUUID(),
        },
        actor,
      );
      commands.push(record);
      if (record.outcome !== 'verified' && record.outcome !== 'delivered') {
        stored.status = 'failed';
        stored.commandIds = commands.map((command) => command.id);
        this.persist(true);
        return {
          plan: stored.plan,
          status: stored.status,
          commands,
          explanation: `${stored.plan.explanation} Execution stopped because a step ended as ${record.outcome}.`,
        };
      }
    }
    await this.bus.whenIdle();
    stored.status = 'executed';
    stored.commandIds = commands.map((command) => command.id);
    const verifiedCount = commands.filter((command) => command.verified).length;
    const explanation = `${stored.plan.explanation} Executed ${commands.length} step(s), ${verifiedCount} verified against observed state.`;
    this.audit(actor, 'intelligence.execute', stored.status, null, planId, { commands: stored.commandIds });
    this.persist(true);
    return { plan: stored.plan, status: stored.status, commands, explanation };
  }

  rejectPlan(planId: string, actor: Actor): StoredPlan {
    this.requireAdmin(actor);
    const stored = this.requirePlan(planId);
    stored.status = 'rejected';
    this.audit(actor, 'intelligence.reject', 'rejected', null, planId, {});
    this.persist(true);
    return clone(stored);
  }

  async connectMqtt(config: MqttConnectionConfig, actor: Actor, restoring = false): Promise<IntegrationHealth> {
    this.requireAdmin(actor);
    const parsed = mqttConnectionSchema.parse(config);
    for (const mapping of parsed.devices) this.requireRoom(mapping.roomId);
    await this.mqtt?.disconnect();
    this.mqttUnsub?.();
    const adapter = new MqttAdapter();
    this.mqtt = adapter;
    this.mqttUnsub = adapter.subscribeToEvents((event) => {
      this.onMqttEvent(event);
    });
    await adapter.connect(parsed);
    for (const mapping of parsed.devices) {
      this.ensureMqttDevice(mapping);
    }
    this.state.mqtt = parsed;
    if (!restoring) {
      this.audit(actor, 'mqtt.connect', 'recorded', null, null, {
        url: redactUrl(parsed.url),
        devices: parsed.devices.length,
        username: parsed.username ?? null,
      });
    }
    this.persist(true);
    return adapter.healthCheck();
  }

  async disconnectMqtt(actor: Actor): Promise<void> {
    this.requireAdmin(actor);
    await this.mqtt?.disconnect();
    this.mqtt = null;
    this.state.mqtt = null;
    this.audit(actor, 'mqtt.disconnect', 'recorded', null, null, {});
    this.persist(true);
  }

  async integrationHealth(): Promise<IntegrationHealth[]> {
    const simulator = await this.simulator.healthCheck();
    const mqttHealth = this.mqtt
      ? await this.mqtt.healthCheck()
      : {
          adapterId: 'mqtt',
          status: 'disabled' as const,
          message: 'MQTT is not configured.',
          checkedAt: this.iso(),
          details: {},
        };
    const planned: IntegrationHealth[] = [
      plannedHealth('android-tv', 'Planned. Read-only research only. No TV control is implemented.'),
      plannedHealth('home-assistant', 'Planned. Not implemented.'),
      plannedHealth('matter', 'Planned. Not implemented.'),
      plannedHealth('ros2', 'Planned. Not implemented.'),
    ];
    return [simulator, mqttHealth, ...planned];
  }

  mqttPublic(): { configured: boolean; url?: string; username?: string; deviceCount: number; passwordSet: boolean } {
    if (!this.state.mqtt) return { configured: false, deviceCount: 0, passwordSet: false };
    return {
      configured: true,
      url: this.state.mqtt.url,
      username: this.state.mqtt.username,
      deviceCount: this.state.mqtt.devices.length,
      passwordSet: Boolean(this.state.mqtt.password),
    };
  }

  createSimulatedHome(actor: Actor): { environmentId: string; automationId: string } {
    this.requireAdmin(actor);
    const environment = environmentSchema.parse({
      id: randomUUID(),
      name: 'Simulated Home',
      domain: 'home',
      simulated: true,
      createdAt: this.iso(),
    });
    this.state.environments.set(environment.id, environment);
    const living = this.createRoom(environment.id, 'Living Room', actor);
    const kitchen = this.createRoom(environment.id, 'Kitchen', actor);
    const bedroom = this.createRoom(environment.id, 'Bedroom', actor);
    const ceiling = this.registerSimulator({
      environmentId: environment.id,
      roomId: living.id,
      name: 'Ceiling light',
      kind: 'light',
      capabilities: ['on_off', 'brightness'],
    });
    const lamp = this.registerSimulator({
      environmentId: environment.id,
      roomId: living.id,
      name: 'Floor lamp',
      kind: 'light',
      capabilities: ['on_off'],
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: living.id,
      name: 'Motion sensor',
      kind: 'motion_sensor',
      capabilities: ['motion_sensor'],
      observed: { motion_sensor: { detected: false } },
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: living.id,
      name: 'Climate sensor',
      kind: 'environment_sensor',
      capabilities: ['temperature_sensor', 'humidity_sensor'],
      observed: { temperature_sensor: { celsius: 21.5 }, humidity_sensor: { percent: 48 } },
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: living.id,
      name: 'Wall switch',
      kind: 'switch',
      capabilities: ['on_off'],
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: kitchen.id,
      name: 'Kitchen light',
      kind: 'light',
      capabilities: ['on_off'],
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: bedroom.id,
      name: 'Bedroom light',
      kind: 'light',
      capabilities: ['on_off'],
    });
    this.registerSimulator({
      environmentId: environment.id,
      roomId: bedroom.id,
      name: 'Bedroom thermostat',
      kind: 'thermostat',
      capabilities: ['temperature_sensor', 'temperature_setpoint'],
      observed: { temperature_sensor: { celsius: 20.5 }, temperature_setpoint: { celsius: 21 } },
    });
    const bucket = new Map<string, SignalValue>([['after_sunset', false]]);
    this.state.signals.set(environment.id, bucket);
    const automation = automationDefinitionSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      environmentId: environment.id,
      name: 'Living room lights after sunset',
      enabled: true,
      trigger: {
        type: 'event',
        event: 'device.state.changed',
        deviceId: [...this.state.devices.values()].find((device) => device.name === 'Motion sensor')?.id,
        capability: 'motion_sensor',
        match: { detected: true },
      },
      conditions: { type: 'signal', signal: 'after_sunset', equals: true },
      actions: [ceiling, lamp].map((device) => ({
        type: 'device_command',
        deviceId: device.id,
        capability: 'on_off',
        action: 'set',
        params: { on: true },
      })),
      cooldownMs: 1_000,
      maxRunsPerHour: 30,
      timeoutMs: 8_000,
      dryRun: false,
    });
    this.state.automations.set(automation.id, automation);
    this.audit(actor, 'home.simulate', 'recorded', null, environment.id, { label: 'simulation' });
    this.persist(true);
    return { environmentId: environment.id, automationId: automation.id };
  }

  private createHost(): AutomationHost {
    return {
      now: () => this.now(),
      device: (id) => this.state.devices.get(id) ?? null,
      signal: (environmentId, name) => this.state.signals.get(environmentId)?.get(name),
      execute: async (automation, index, causation, _timeoutMs) => {
        const action = automation.actions[index];
        if (!action) throw new DomainError('malformed_automation', 'Missing action.', 422);
        return this.executeCommand(
          {
            deviceId: action.deviceId,
            capability: action.capability,
            action: action.action,
            params: action.params,
            approval: 'automation_rule',
            causation,
            correlationId: randomUUID(),
          },
          automationActor(automation.id),
        );
      },
      recordRun: (run) => {
        this.state.runs.push(run);
        this.publish({
          type: run.status === 'failed' || run.status === 'timed_out' ? 'automation.failed' : 'automation.triggered',
          automationId: run.automationId,
          reason: run.reason ?? run.status,
          correlationId: null,
          causation: null,
        });
        this.persist(false);
      },
    };
  }

  private registerSimulator(input: {
    environmentId: string;
    roomId: string;
    name: string;
    kind: string;
    capabilities: CapabilityId[];
    observed?: CapabilityStateMap;
  }): Device {
    const id = randomUUID();
    const created = this.simulator.addDevice({
      ref: id,
      name: input.name,
      capabilities: input.capabilities,
      metadata: { kind: input.kind, simulated: true, isolatedSimulator: true, model: 'SIM-1' },
      observed: input.observed,
    });
    const device = deviceSchema.parse({
      id,
      environmentId: input.environmentId,
      roomId: input.roomId,
      name: input.name,
      manufacturer: 'Physical OS Simulator',
      adapterId: 'simulator',
      adapterDeviceRef: created.ref,
      capabilities: input.capabilities,
      connectivity: 'online',
      observed: created.observed,
      desired: {},
      observedAt: this.iso(),
      metadata: created.metadata,
      createdAt: this.iso(),
    });
    this.state.devices.set(device.id, device);
    return device;
  }

  private ensureMqttDevice(mapping: MqttConnectionConfig['devices'][number]): Device {
    const existing = [...this.state.devices.values()].find(
      (device) => device.adapterId === 'mqtt' && device.adapterDeviceRef === mapping.localId,
    );
    if (existing) return existing;
    const room = this.requireRoom(mapping.roomId);
    const device = deviceSchema.parse({
      id: randomUUID(),
      environmentId: room.environmentId,
      roomId: room.id,
      name: mapping.name,
      manufacturer: null,
      adapterId: 'mqtt',
      adapterDeviceRef: mapping.localId,
      capabilities: mapping.capabilities,
      connectivity: 'unknown',
      observed: {},
      desired: {},
      observedAt: null,
      metadata: { kind: 'other', simulated: false, model: 'mqtt' },
      createdAt: this.iso(),
    });
    this.state.devices.set(device.id, device);
    this.publish({
      type: 'device.discovered',
      deviceId: device.id,
      adapterId: 'mqtt',
      correlationId: null,
      causation: null,
    });
    return device;
  }

  private onMqttEvent(event: AdapterEvent): void {
    const device = [...this.state.devices.values()].find(
      (item) => item.adapterId === 'mqtt' && item.adapterDeviceRef === event.deviceRef,
    );
    if (!device) return;
    if (event.kind === 'rejected') {
      this.audit({ id: 'mqtt', role: 'operator' }, 'mqtt.payload', 'rejected', null, device.id, {
        message: event.message ?? 'rejected',
      });
      return;
    }
    if (event.kind === 'state' && event.observed) {
      device.connectivity = 'online';
      this.commitObserved(device, event.observed, event.capability ?? null, null, null);
    }
    if (event.kind === 'disconnected') device.connectivity = 'offline';
  }

  private commitObserved(
    device: Device,
    observed: CapabilityStateMap,
    capability: CapabilityId | null,
    correlationId: string | null,
    causation: Causation | null,
  ): void {
    const previous = JSON.stringify(device.observed);
    device.observed = observed;
    device.observedAt = this.iso();
    if (device.connectivity === 'unknown') device.connectivity = 'online';
    if (previous === JSON.stringify(observed)) return;
    this.publish({
      type: 'device.state.changed',
      deviceId: device.id,
      capability,
      observed,
      correlationId,
      causation,
    });
    if (capability && capabilityCatalog[capability].readOnly) {
      this.publish({
        type: 'sensor.reading.received',
        deviceId: device.id,
        capability,
        reading: observed[capability],
        correlationId,
        causation,
      });
    }
    this.persist(false);
  }

  private storePlan(plan: ExecutionPlan, source: StoredPlan['source'], actor: Actor): StoredPlan {
    const needsApproval = plan.steps.length > 0;
    const stored: StoredPlan = {
      plan,
      status: needsApproval ? 'awaiting_approval' : 'proposed',
      source,
      commandIds: [],
      actorId: actor.id,
    };
    this.state.plans.set(plan.id, stored);
    this.audit(actor, 'intelligence.plan', stored.status, null, plan.id, {
      steps: plan.steps.length,
      source,
      risks: [...new Set(plan.steps.map((step) => step.risk))],
    });
    this.persist(true);
    return stored;
  }

  private finish(
    record: CommandRecord,
    outcome: CommandRecord['outcome'],
    errorCode: string | null,
    errorMessage: string | null,
  ): CommandRecord {
    record.outcome = outcome;
    record.errorCode = errorCode;
    record.errorMessage = errorMessage;
    record.completedAt = this.iso();
    record.verified = outcome === 'verified';
    const eventType =
      outcome === 'verified' || outcome === 'delivered' ? 'command.executed' : 'command.failed';
    this.publish({
      type: eventType,
      commandId: record.id,
      deviceId: record.deviceId,
      outcome,
      decision: record.decision,
      correlationId: record.correlationId,
      causation: record.causation,
    });
    this.audit({ id: record.actorId, role: 'operator' }, 'command.execute', outcome, record.correlationId, record.deviceId, {
      capability: record.capability,
      action: record.action,
      verified: record.verified,
      errorCode,
    });
    this.persist(true);
    return clone(record);
  }

  private remember(record: CommandRecord): void {
    this.state.commands.push(record);
    if (record.idempotencyKey) this.state.idempotency.set(record.idempotencyKey, record.id);
  }

  private assertActions(automation: Automation): void {
    for (const action of automation.actions) {
      const device = this.requireDevice(action.deviceId);
      if (device.environmentId !== automation.environmentId) {
        throw new DomainError('invalid_action', 'Automation actions must stay in the same environment.', 422);
      }
      parseAction(action.capability, action.action, action.params, device.observed[action.capability]);
      if (capabilityCatalog[action.capability].risk === 'high') {
        throw new DomainError('high_risk_disabled', 'Automations cannot include high-risk actions.', 403);
      }
    }
  }

  private adapterFor(device: Device) {
    if (device.adapterId === 'simulator') return this.simulator;
    if (device.adapterId === 'mqtt' && this.mqtt) return this.mqtt;
    throw new DomainError('adapter_offline', `Adapter ${device.adapterId} is not connected.`, 503);
  }

  private publish(event: { type: DomainEvent['type'] } & Record<string, unknown>): void {
    this.bus.publish({ ...event, id: randomUUID(), at: this.iso() } as DomainEvent);
  }

  private audit(
    actor: Actor,
    action: string,
    outcome: string,
    correlationId: string | null,
    target: string | null,
    details: Record<string, unknown>,
  ): void {
    this.state.audits.push({
      id: randomUUID(),
      at: this.iso(),
      actorId: actor.id,
      action,
      outcome,
      correlationId,
      target,
      details,
    });
  }

  private persist(immediate: boolean): void {
    const store = this.options.store;
    if (!store) return;
    const write = () => {
      const snapshot = structuredClone(this.state.snapshot());
      return Promise.resolve(store.save(snapshot)).then(() => undefined);
    };
    if (immediate) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.writes = this.writes.then(write).catch(() => undefined);
      return;
    }
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.writes = this.writes.then(write).catch(() => undefined);
    }, 50);
    this.saveTimer.unref?.();
  }

  private requireAdmin(actor: Actor): void {
    if (actor.role !== 'admin') throw new DomainError('unauthorized', 'Administrator permission is required.', 403);
  }

  private requireEnvironment(id: string): PhysicalEnvironment {
    const environment = this.state.environments.get(id);
    if (!environment) throw new DomainError('unknown_environment', 'Environment not found.', 404);
    return environment;
  }

  private requireRoom(id: string): Room {
    const room = this.state.rooms.get(id);
    if (!room) throw new DomainError('unknown_room', 'Room not found.', 404);
    return room;
  }

  private requireDevice(id: string): Device {
    const device = this.state.devices.get(id);
    if (!device) throw new DomainError('unknown_device', 'Device not found.', 404);
    return device;
  }

  private requireCommand(id: string): CommandRecord {
    const command = this.state.commands.find((item) => item.id === id);
    if (!command) throw new DomainError('unknown_command', 'Command not found.', 404);
    return command;
  }

  private requirePlan(id: string): StoredPlan {
    const plan = this.state.plans.get(id);
    if (!plan) throw new DomainError('unknown_plan', 'Plan not found.', 404);
    return plan;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private iso(): string {
    return this.now().toISOString();
  }
}

function plannedHealth(adapterId: string, message: string): IntegrationHealth {
  return {
    adapterId,
    status: 'planned',
    message,
    checkedAt: new Date().toISOString(),
    details: { implemented: false },
  };
}

function redactUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.password) parsed.password = 'redacted';
  if (parsed.username) parsed.username = 'redacted';
  return parsed.toString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function deviceKindOf(device: Device): string {
  return readDeviceKind(device.metadata);
}

export function observedMatches(device: Device, capability: CapabilityId, expected: unknown): boolean {
  return valuesMatch(expected, device.observed[capability]);
}
