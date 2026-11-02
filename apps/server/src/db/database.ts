import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { PersistedSnapshot, SnapshotStore } from '@physical-os/core';
import {
  audits,
  automationRuns,
  automations,
  commands,
  devices,
  environments,
  plans,
  rooms,
  runtime,
  schema,
  sessions,
  signals,
  users,
} from './schema.js';

const MIGRATION = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS environments (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain text NOT NULL,
  simulated integer NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  environment_id text NOT NULL,
  name text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id text PRIMARY KEY,
  environment_id text NOT NULL,
  room_id text NOT NULL,
  name text NOT NULL,
  manufacturer text,
  adapter_id text NOT NULL,
  adapter_device_ref text NOT NULL,
  capabilities_json text NOT NULL,
  connectivity text NOT NULL,
  observed_json text NOT NULL,
  desired_json text NOT NULL,
  observed_at text,
  metadata_json text NOT NULL,
  created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS automations (
  id text PRIMARY KEY,
  environment_id text NOT NULL,
  definition_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS automation_runs (
  id text PRIMARY KEY,
  automation_id text NOT NULL,
  record_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS commands (
  id text PRIMARY KEY,
  created_at text NOT NULL,
  record_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS audits (
  id text PRIMARY KEY,
  at text NOT NULL,
  record_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS signals (
  id text PRIMARY KEY,
  environment_id text NOT NULL,
  name text NOT NULL,
  value_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  record_json text NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime (
  id text PRIMARY KEY,
  require_medium_confirmation integer NOT NULL,
  estop_json text NOT NULL,
  mqtt_json text
);
CREATE INDEX IF NOT EXISTS rooms_environment ON rooms(environment_id);
CREATE INDEX IF NOT EXISTS devices_room ON devices(room_id);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`;

export interface AuthUser {
  id: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
}

export interface AuthSession {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export class AppDatabase {
  readonly snapshots: SnapshotStore;
  private readonly sqlite: DatabaseSync;
  private readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(filename: string) {
    mkdirSync(dirname(filename), { recursive: true });
    this.sqlite = new DatabaseSync(filename);
    this.sqlite.exec('PRAGMA journal_mode = WAL');
    this.sqlite.exec(MIGRATION);
    this.db = drizzle(
      async (sql, params, method): Promise<{ rows: unknown[] }> => this.query(sql, params, method),
      { schema },
    );
    this.snapshots = {
      load: () => this.enqueue(() => this.loadSnapshot()),
      save: (snapshot) => this.enqueue(() => this.saveSnapshot(snapshot)),
    };
  }

  private queue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  async close(): Promise<void> {
    await this.flush();
    this.sqlite.close();
  }

  async countUsers(): Promise<number> {
    const rows = await this.enqueue(() => this.db.select().from(users));
    return rows.length;
  }

  async listUsers(): Promise<AuthUser[]> {
    const rows = await this.enqueue(() => this.db.select().from(users));
    return rows.map(toUser);
  }

  async insertUser(user: AuthUser): Promise<void> {
    await this.enqueue(() => this.db.insert(users).values(user));
  }

  async updatePassword(userId: string, passwordHash: string, passwordSalt: string): Promise<void> {
    await this.enqueue(() => this.db.update(users).set({ passwordHash, passwordSalt }).where(eq(users.id, userId)));
  }

  async insertSession(session: AuthSession & { createdAt: string }): Promise<void> {
    await this.enqueue(() => this.db.insert(sessions).values(session));
  }

  async findSession(tokenHash: string): Promise<AuthSession | null> {
    const rows = await this.enqueue(() => this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)));
    return rows[0] ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.enqueue(() => this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)));
  }

  async deleteSessions(): Promise<void> {
    await this.enqueue(() => this.db.delete(sessions));
  }

  private async loadSnapshot(): Promise<PersistedSnapshot | null> {
    const runtimeRows = await this.db.select().from(runtime);
    const current = runtimeRows[0];
    if (!current) return null;
    const [environmentRows, roomRows, deviceRows, automationRows, runRows, commandRows, auditRows, signalRows, planRows] =
      await Promise.all([
        this.db.select().from(environments),
        this.db.select().from(rooms),
        this.db.select().from(devices),
        this.db.select().from(automations),
        this.db.select().from(automationRuns),
        this.db.select().from(commands),
        this.db.select().from(audits),
        this.db.select().from(signals),
        this.db.select().from(plans),
      ]);
    return {
      version: 1,
      environments: environmentRows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: 'home',
        simulated: row.simulated,
        createdAt: row.createdAt,
      })),
      rooms: roomRows.map((row) => ({
        id: row.id,
        environmentId: row.environmentId,
        name: row.name,
        createdAt: row.createdAt,
      })),
      devices: deviceRows.map((row) => ({
        id: row.id,
        environmentId: row.environmentId,
        roomId: row.roomId,
        name: row.name,
        manufacturer: row.manufacturer,
        adapterId: row.adapterId,
        adapterDeviceRef: row.adapterDeviceRef,
        capabilities: row.capabilitiesJson,
        connectivity: row.connectivity,
        observed: row.observedJson,
        desired: row.desiredJson,
        observedAt: row.observedAt,
        metadata: row.metadataJson,
        createdAt: row.createdAt,
      })),
      automations: automationRows.map((row) => row.definitionJson),
      runs: runRows.map((row) => row.recordJson),
      commands: commandRows.map((row) => row.recordJson),
      audits: auditRows.map((row) => row.recordJson),
      signals: signalRows.map((row) => ({
        environmentId: row.environmentId,
        name: row.name,
        value: row.valueJson as PersistedSnapshot['signals'][number]['value'],
      })),
      plans: planRows.map((row) => row.recordJson),
      estop: current.estopJson,
      settings: { requireMediumConfirmation: current.requireMediumConfirmation },
      mqtt: current.mqttJson ?? null,
    };
  }

  private async saveSnapshot(snapshot: PersistedSnapshot): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(plans);
      await tx.delete(signals);
      await tx.delete(audits);
      await tx.delete(commands);
      await tx.delete(automationRuns);
      await tx.delete(automations);
      await tx.delete(devices);
      await tx.delete(rooms);
      await tx.delete(environments);
      await tx.delete(runtime);
      if (snapshot.environments.length) {
        await tx.insert(environments).values(
          snapshot.environments.map((item) => ({
            id: item.id,
            name: item.name,
            domain: item.domain,
            simulated: item.simulated,
            createdAt: item.createdAt,
          })),
        );
      }
      if (snapshot.rooms.length) {
        await tx.insert(rooms).values(snapshot.rooms);
      }
      if (snapshot.devices.length) {
        await tx.insert(devices).values(
          snapshot.devices.map((device) => ({
            id: device.id,
            environmentId: device.environmentId,
            roomId: device.roomId,
            name: device.name,
            manufacturer: device.manufacturer,
            adapterId: device.adapterId,
            adapterDeviceRef: device.adapterDeviceRef,
            capabilitiesJson: device.capabilities,
            connectivity: device.connectivity,
            observedJson: device.observed,
            desiredJson: device.desired,
            observedAt: device.observedAt,
            metadataJson: device.metadata,
            createdAt: device.createdAt,
          })),
        );
      }
      if (snapshot.automations.length) {
        await tx.insert(automations).values(
          snapshot.automations.map((automation) => ({
            id: automation.id,
            environmentId: automation.environmentId,
            definitionJson: automation,
          })),
        );
      }
      if (snapshot.runs.length) {
        await tx.insert(automationRuns).values(
          snapshot.runs.map((run) => ({
            id: run.id,
            automationId: run.automationId,
            recordJson: run,
          })),
        );
      }
      if (snapshot.commands.length) {
        await tx.insert(commands).values(
          snapshot.commands.map((command) => ({
            id: command.id,
            createdAt: command.createdAt,
            recordJson: command,
          })),
        );
      }
      if (snapshot.audits.length) {
        await tx.insert(audits).values(
          snapshot.audits.map((audit) => ({
            id: audit.id,
            at: audit.at,
            recordJson: audit,
          })),
        );
      }
      if (snapshot.signals.length) {
        await tx.insert(signals).values(
          snapshot.signals.map((signal) => ({
            id: `${signal.environmentId}:${signal.name}`,
            environmentId: signal.environmentId,
            name: signal.name,
            valueJson: signal.value,
          })),
        );
      }
      if (snapshot.plans.length) {
        await tx.insert(plans).values(
          snapshot.plans.map((plan) => ({
            id: plan.plan.id,
            recordJson: plan,
          })),
        );
      }
      await tx.insert(runtime).values({
        id: 'runtime',
        requireMediumConfirmation: snapshot.settings.requireMediumConfirmation,
        estopJson: snapshot.estop,
        mqttJson: snapshot.mqtt,
      });
    });
  }

  private query(
    sql: string,
    params: unknown[],
    method: 'run' | 'all' | 'values' | 'get',
  ): Promise<{ rows: unknown[] }> {
    const statement = this.sqlite.prepare(sql);
    const bound = params.map((value) => (value === undefined ? null : value));
    if (method === 'run') {
      statement.run(...(bound as never[]));
      return Promise.resolve({ rows: [] as unknown[] });
    }
    if (method === 'get') {
      const row = statement.get(...(bound as never[])) as Record<string, unknown> | undefined;
      return Promise.resolve({ rows: row ? Object.values(row) : [] });
    }
    const rows = statement.all(...(bound as never[])) as Record<string, unknown>[];
    return Promise.resolve({ rows: rows.map((row) => Object.values(row)) });
  }
}

function toUser(row: typeof users.$inferSelect): AuthUser {
  const role = row.role === 'operator' || row.role === 'viewer' ? row.role : 'admin';
  return {
    id: row.id,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
    role,
    createdAt: row.createdAt,
  };
}
