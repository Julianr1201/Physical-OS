import { z } from 'zod';
import { capabilityIdSchema, riskLevelSchema } from './capabilities.js';

export const idSchema = z.string().uuid();

export const connectivitySchema = z.enum(['online', 'offline', 'degraded', 'unknown']);
export type Connectivity = z.infer<typeof connectivitySchema>;

export const deviceKindSchema = z.enum([
  'light',
  'switch',
  'motion_sensor',
  'thermostat',
  'environment_sensor',
  'media_player',
  'meter',
  'other',
]);
export type DeviceKind = z.infer<typeof deviceKindSchema>;

const metadataValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const metadataSchema = z
  .record(z.string().min(1).max(64), metadataValueSchema)
  .refine((value) => Object.keys(value).length <= 32, 'Metadata has too many keys');

export type Metadata = z.infer<typeof metadataSchema>;

export const capabilityStateMapSchema = z.record(capabilityIdSchema, z.unknown());
export type CapabilityStateMap = Partial<Record<z.infer<typeof capabilityIdSchema>, unknown>>;

export const environmentSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(80),
  domain: z.literal('home'),
  simulated: z.boolean(),
  createdAt: z.string().datetime(),
});
export type PhysicalEnvironment = z.infer<typeof environmentSchema>;

export const roomSchema = z.object({
  id: idSchema,
  environmentId: idSchema,
  name: z.string().min(1).max(80),
  createdAt: z.string().datetime(),
});
export type Room = z.infer<typeof roomSchema>;

export const deviceSchema = z.object({
  id: idSchema,
  environmentId: idSchema,
  roomId: idSchema,
  name: z.string().min(1).max(80),
  manufacturer: z.string().max(80).nullable(),
  adapterId: z.string().min(1).max(64),
  adapterDeviceRef: z.string().min(1).max(200),
  capabilities: z.array(capabilityIdSchema).min(1).max(12),
  connectivity: connectivitySchema,
  observed: capabilityStateMapSchema,
  desired: capabilityStateMapSchema,
  observedAt: z.string().datetime().nullable(),
  metadata: metadataSchema,
  createdAt: z.string().datetime(),
});
export type Device = z.infer<typeof deviceSchema>;

export const approvalMethodSchema = z.enum([
  'none',
  'explicit_ui',
  'plan_approval',
  'automation_rule',
]);
export type ApprovalMethod = z.infer<typeof approvalMethodSchema>;

export const causationSchema = z.object({
  automationId: idSchema,
  depth: z.number().int().min(0).max(8),
  rootCorrelationId: idSchema,
});
export type Causation = z.infer<typeof causationSchema>;

export const actorSchema = z.object({
  id: z.string().min(1).max(120),
  role: z.enum(['admin', 'operator', 'viewer', 'automation']),
  automationId: idSchema.optional(),
});
export type Actor = z.infer<typeof actorSchema>;

export const commandOutcomeSchema = z.enum([
  'accepted',
  'awaiting_approval',
  'rejected',
  'delivered',
  'verified',
  'failed',
  'timed_out',
]);
export type CommandOutcome = z.infer<typeof commandOutcomeSchema>;

export const policyEffectSchema = z.enum(['allow', 'deny', 'require_approval']);

export const policyDecisionSchema = z.object({
  effect: policyEffectSchema,
  risk: riskLevelSchema,
  reasons: z.array(z.string().min(1).max(200)).max(12),
});
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

export const commandRequestSchema = z.object({
  deviceId: idSchema,
  capability: capabilityIdSchema,
  action: z.string().min(1).max(64),
  params: z.record(z.string().max(64), z.unknown()).default({}),
  idempotencyKey: z.string().min(8).max(80).optional(),
  approval: approvalMethodSchema.default('none'),
  correlationId: idSchema.optional(),
  causation: causationSchema.optional(),
  planId: idSchema.optional(),
});
export type CommandRequest = z.infer<typeof commandRequestSchema>;

export const commandRecordSchema = z.object({
  id: idSchema,
  correlationId: idSchema,
  deviceId: idSchema,
  capability: capabilityIdSchema,
  action: z.string(),
  params: z.record(z.string(), z.unknown()),
  actorId: z.string(),
  approval: approvalMethodSchema,
  decision: policyDecisionSchema,
  outcome: commandOutcomeSchema,
  verified: z.boolean(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  planId: idSchema.nullable(),
  causation: causationSchema.nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type CommandRecord = z.infer<typeof commandRecordSchema>;

export const auditEntrySchema = z.object({
  id: idSchema,
  at: z.string().datetime(),
  actorId: z.string(),
  action: z.string().min(1).max(80),
  outcome: z.string().min(1).max(80),
  correlationId: z.string().nullable(),
  target: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const signalValueSchema = z.union([z.boolean(), z.number().finite(), z.string().max(80)]);
export type SignalValue = z.infer<typeof signalValueSchema>;

export const adapterOperationSchema = z.enum([
  'discover',
  'connect',
  'disconnect',
  'listDevices',
  'getCapabilities',
  'readState',
  'executeCommand',
  'subscribeToEvents',
  'healthCheck',
]);
export type AdapterOperation = z.infer<typeof adapterOperationSchema>;

export const adapterManifestSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  version: z.string().min(1).max(32),
  contractVersion: z.literal('1'),
  vendor: z.string().min(1).max(80),
  operations: z.array(adapterOperationSchema).min(1),
  simulated: z.boolean(),
});
export type AdapterManifest = z.infer<typeof adapterManifestSchema>;

export const integrationHealthSchema = z.object({
  adapterId: z.string(),
  status: z.enum(['healthy', 'degraded', 'offline', 'disabled', 'planned']),
  message: z.string().max(300),
  checkedAt: z.string().datetime(),
  details: z.record(z.string(), z.unknown()),
});
export type IntegrationHealth = z.infer<typeof integrationHealthSchema>;

export const conditionSchema: z.ZodType<AutomationCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('all'),
      items: z.array(conditionSchema).max(12),
    }),
    z.object({
      type: z.literal('any'),
      items: z.array(conditionSchema).max(12),
    }),
    z.object({
      type: z.literal('not'),
      item: conditionSchema,
    }),
    z.object({
      type: z.literal('state'),
      deviceId: idSchema,
      capability: capabilityIdSchema,
      match: z.record(z.string().max(64), z.unknown()),
    }),
    z.object({
      type: z.literal('signal'),
      signal: z.string().min(1).max(64),
      equals: signalValueSchema,
    }),
    z.object({
      type: z.literal('time_window'),
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(0).max(1439),
    }),
  ]),
);

export type AutomationCondition =
  | { type: 'all'; items: AutomationCondition[] }
  | { type: 'any'; items: AutomationCondition[] }
  | { type: 'not'; item: AutomationCondition }
  | {
      type: 'state';
      deviceId: string;
      capability: z.infer<typeof capabilityIdSchema>;
      match: Record<string, unknown>;
    }
  | { type: 'signal'; signal: string; equals: SignalValue }
  | { type: 'time_window'; startMinute: number; endMinute: number };

export const automationTriggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    event: z.enum(['device.state.changed', 'sensor.reading.received']),
    deviceId: idSchema.optional(),
    capability: capabilityIdSchema.optional(),
    match: z.record(z.string().max(64), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('time'),
    mode: z.enum(['interval', 'daily']),
    everyMs: z.number().int().min(15_000).max(86_400_000).optional(),
    atMinuteOfDay: z.number().int().min(0).max(1439).optional(),
  }),
  z.object({
    type: z.literal('signal'),
    signal: z.string().min(1).max(64),
    equals: signalValueSchema,
  }),
]);
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

export const automationActionSchema = z.object({
  type: z.literal('device_command'),
  deviceId: idSchema,
  capability: capabilityIdSchema,
  action: z.string().min(1).max(64),
  params: z.record(z.string().max(64), z.unknown()),
});
export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    environmentId: idSchema,
    name: z.string().min(1).max(120),
    enabled: z.boolean(),
    trigger: automationTriggerSchema,
    conditions: conditionSchema,
    actions: z.array(automationActionSchema).min(1).max(20),
    cooldownMs: z.number().int().min(0).max(3_600_000).default(5_000),
    maxRunsPerHour: z.number().int().min(1).max(120).default(30),
    timeoutMs: z.number().int().min(200).max(30_000).default(8_000),
    dryRun: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.trigger.type === 'time' && value.trigger.mode === 'interval' && !value.trigger.everyMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interval triggers require everyMs.',
        path: ['trigger', 'everyMs'],
      });
    }
    if (
      value.trigger.type === 'time' &&
      value.trigger.mode === 'daily' &&
      value.trigger.atMinuteOfDay === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Daily triggers require atMinuteOfDay.',
        path: ['trigger', 'atMinuteOfDay'],
      });
    }
  });

export type Automation = z.infer<typeof automationDefinitionSchema>;

export const automationRunSchema = z.object({
  id: idSchema,
  automationId: idSchema,
  at: z.string().datetime(),
  dryRun: z.boolean(),
  status: z.enum(['completed', 'failed', 'skipped', 'timed_out']),
  reason: z.string().nullable(),
  commandIds: z.array(idSchema),
});
export type AutomationRun = z.infer<typeof automationRunSchema>;

export const executionStepSchema = z.object({
  id: idSchema,
  deviceId: idSchema,
  capability: capabilityIdSchema,
  action: z.string().min(1).max(64),
  params: z.record(z.string().max(64), z.unknown()),
  risk: riskLevelSchema,
});
export type ExecutionStep = z.infer<typeof executionStepSchema>;

export const executionPlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  environmentId: idSchema,
  utterance: z.string().min(1).max(500),
  explanation: z.string().min(1).max(2_000),
  steps: z.array(executionStepSchema).max(50),
  readOnly: z.boolean(),
  createdAt: z.string().datetime(),
});
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;

export const planStatusSchema = z.enum([
  'proposed',
  'awaiting_approval',
  'rejected',
  'executed',
  'failed',
  'expired',
]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export function readDeviceKind(metadata: Metadata): DeviceKind {
  const parsed = deviceKindSchema.safeParse(metadata.kind);
  return parsed.success ? parsed.data : 'other';
}

export function valuesMatch(expected: unknown, actual: unknown): boolean {
  if (expected === actual) return true;
  if (typeof expected !== 'object' || expected === null || typeof actual !== 'object' || actual === null) {
    return false;
  }
  const expectedRecord = expected as Record<string, unknown>;
  const actualRecord = actual as Record<string, unknown>;
  return Object.entries(expectedRecord).every(([key, value]) => valuesMatch(value, actualRecord[key]));
}
