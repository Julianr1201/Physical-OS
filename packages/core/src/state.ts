import type {
  AuditEntry,
  Automation,
  AutomationRun,
  CommandRecord,
  Device,
  ExecutionPlan,
  PhysicalEnvironment,
  PlanStatus,
  Room,
  SignalValue,
} from '@physical-os/shared';
import type { MqttConnectionConfig } from '@physical-os/adapter-mqtt';

export interface StoredPlan {
  plan: ExecutionPlan;
  status: PlanStatus;
  source: 'deterministic' | 'llm';
  commandIds: string[];
  actorId: string;
}

export interface EstopState {
  latched: boolean;
  at: string | null;
  by: string | null;
  reason: string | null;
}

export interface RuntimeSettings {
  requireMediumConfirmation: boolean;
}

export interface PersistedSnapshot {
  version: 1;
  environments: PhysicalEnvironment[];
  rooms: Room[];
  devices: Device[];
  automations: Automation[];
  runs: AutomationRun[];
  commands: CommandRecord[];
  audits: AuditEntry[];
  signals: Array<{ environmentId: string; name: string; value: SignalValue }>;
  plans: StoredPlan[];
  estop: EstopState;
  settings: RuntimeSettings;
  mqtt: MqttConnectionConfig | null;
}

export interface SnapshotStore {
  load(): PersistedSnapshot | null | Promise<PersistedSnapshot | null>;
  save(snapshot: PersistedSnapshot): void | Promise<void>;
}

export class DomainState {
  environments = new Map<string, PhysicalEnvironment>();
  rooms = new Map<string, Room>();
  devices = new Map<string, Device>();
  automations = new Map<string, Automation>();
  runs: AutomationRun[] = [];
  commands: CommandRecord[] = [];
  idempotency = new Map<string, string>();
  audits: AuditEntry[] = [];
  signals = new Map<string, Map<string, SignalValue>>();
  plans = new Map<string, StoredPlan>();
  estop: EstopState = { latched: false, at: null, by: null, reason: null };
  settings: RuntimeSettings = { requireMediumConfirmation: true };
  mqtt: MqttConnectionConfig | null = null;

  snapshot(): PersistedSnapshot {
    return {
      version: 1,
      environments: [...this.environments.values()],
      rooms: [...this.rooms.values()],
      devices: [...this.devices.values()],
      automations: [...this.automations.values()],
      runs: this.runs.slice(-200),
      commands: this.commands.slice(-200),
      audits: this.audits.slice(-400),
      signals: [...this.signals.entries()].flatMap(([environmentId, values]) =>
        [...values.entries()].map(([name, value]) => ({ environmentId, name, value })),
      ),
      plans: [...this.plans.values()],
      estop: this.estop,
      settings: this.settings,
      mqtt: this.mqtt,
    };
  }

  hydrate(snapshot: PersistedSnapshot): void {
    this.environments = new Map(snapshot.environments.map((item) => [item.id, item]));
    this.rooms = new Map(snapshot.rooms.map((item) => [item.id, item]));
    this.devices = new Map(snapshot.devices.map((item) => [item.id, item]));
    this.automations = new Map(snapshot.automations.map((item) => [item.id, item]));
    this.runs = snapshot.runs;
    this.commands = snapshot.commands;
    this.audits = snapshot.audits;
    this.plans = new Map(snapshot.plans.map((item) => [item.plan.id, item]));
    this.estop = snapshot.estop;
    this.settings = snapshot.settings;
    this.mqtt = snapshot.mqtt;
    this.signals = new Map();
    for (const signal of snapshot.signals) {
      const bucket = this.signals.get(signal.environmentId) ?? new Map<string, SignalValue>();
      bucket.set(signal.name, signal.value);
      this.signals.set(signal.environmentId, bucket);
    }
    this.idempotency = new Map(
      snapshot.commands
        .filter((command) => command.idempotencyKey)
        .map((command) => [command.idempotencyKey as string, command.id]),
    );
  }
}
