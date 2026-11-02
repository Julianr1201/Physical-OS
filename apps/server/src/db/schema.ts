import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { MqttConnectionConfig } from '@physical-os/adapter-mqtt';
import type {
  AuditEntry,
  Automation,
  AutomationRun,
  CapabilityId,
  CapabilityStateMap,
  CommandRecord,
  Connectivity,
  Metadata,
} from '@physical-os/shared';
import type { EstopState, StoredPlan } from '@physical-os/core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  simulated: integer('simulated', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull(),
  roomId: text('room_id').notNull(),
  name: text('name').notNull(),
  manufacturer: text('manufacturer'),
  adapterId: text('adapter_id').notNull(),
  adapterDeviceRef: text('adapter_device_ref').notNull(),
  capabilitiesJson: text('capabilities_json', { mode: 'json' }).$type<CapabilityId[]>().notNull(),
  connectivity: text('connectivity').$type<Connectivity>().notNull(),
  observedJson: text('observed_json', { mode: 'json' }).$type<CapabilityStateMap>().notNull(),
  desiredJson: text('desired_json', { mode: 'json' }).$type<CapabilityStateMap>().notNull(),
  observedAt: text('observed_at'),
  metadataJson: text('metadata_json', { mode: 'json' }).$type<Metadata>().notNull(),
  createdAt: text('created_at').notNull(),
});

export const automations = sqliteTable('automations', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull(),
  definitionJson: text('definition_json', { mode: 'json' }).$type<Automation>().notNull(),
});

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').notNull(),
  recordJson: text('record_json', { mode: 'json' }).$type<AutomationRun>().notNull(),
});

export const commands = sqliteTable('commands', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  recordJson: text('record_json', { mode: 'json' }).$type<CommandRecord>().notNull(),
});

export const audits = sqliteTable('audits', {
  id: text('id').primaryKey(),
  at: text('at').notNull(),
  recordJson: text('record_json', { mode: 'json' }).$type<AuditEntry>().notNull(),
});

export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull(),
  name: text('name').notNull(),
  valueJson: text('value_json', { mode: 'json' }).notNull(),
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  recordJson: text('record_json', { mode: 'json' }).$type<StoredPlan>().notNull(),
});

export const runtime = sqliteTable('runtime', {
  id: text('id').primaryKey(),
  requireMediumConfirmation: integer('require_medium_confirmation', { mode: 'boolean' }).notNull(),
  estopJson: text('estop_json', { mode: 'json' }).$type<EstopState>().notNull(),
  mqttJson: text('mqtt_json', { mode: 'json' }).$type<MqttConnectionConfig | null>(),
});

export const schema = {
  users,
  sessions,
  environments,
  rooms,
  devices,
  automations,
  automationRuns,
  commands,
  audits,
  signals,
  plans,
  runtime,
};
