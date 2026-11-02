import { z } from 'zod';

export const riskLevels = ['low', 'medium', 'high'] as const;
export const riskLevelSchema = z.enum(riskLevels);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const capabilityIds = [
  'on_off',
  'brightness',
  'temperature_sensor',
  'temperature_setpoint',
  'humidity_sensor',
  'motion_sensor',
  'power_meter',
  'battery',
  'position',
  'media_control',
] as const;

export const capabilityIdSchema = z.enum(capabilityIds);
export type CapabilityId = z.infer<typeof capabilityIdSchema>;

const playbackSchema = z.enum(['play', 'pause', 'stop']);

export interface CapabilityDefinition {
  id: CapabilityId;
  title: string;
  risk: RiskLevel;
  readOnly: boolean;
  stateSchema: z.ZodTypeAny;
  actions: Record<string, z.ZodTypeAny>;
}

export const capabilityCatalog: Record<CapabilityId, CapabilityDefinition> = {
  on_off: {
    id: 'on_off',
    title: 'On / off',
    risk: 'medium',
    readOnly: false,
    stateSchema: z.object({ on: z.boolean() }).strict(),
    actions: {
      set: z.object({ on: z.boolean() }).strict(),
      toggle: z.object({}).strict(),
    },
  },
  brightness: {
    id: 'brightness',
    title: 'Brightness',
    risk: 'medium',
    readOnly: false,
    stateSchema: z.object({ level: z.number().min(0).max(100) }).strict(),
    actions: {
      set: z.object({ level: z.number().min(0).max(100) }).strict(),
    },
  },
  temperature_sensor: {
    id: 'temperature_sensor',
    title: 'Temperature',
    risk: 'low',
    readOnly: true,
    stateSchema: z.object({ celsius: z.number().min(-40).max(125) }).strict(),
    actions: {},
  },
  temperature_setpoint: {
    id: 'temperature_setpoint',
    title: 'Temperature setpoint',
    risk: 'high',
    readOnly: false,
    stateSchema: z.object({ celsius: z.number().min(5).max(35) }).strict(),
    actions: {
      set: z.object({ celsius: z.number().min(5).max(35) }).strict(),
    },
  },
  humidity_sensor: {
    id: 'humidity_sensor',
    title: 'Humidity',
    risk: 'low',
    readOnly: true,
    stateSchema: z.object({ percent: z.number().min(0).max(100) }).strict(),
    actions: {},
  },
  motion_sensor: {
    id: 'motion_sensor',
    title: 'Motion',
    risk: 'low',
    readOnly: true,
    stateSchema: z.object({ detected: z.boolean() }).strict(),
    actions: {},
  },
  power_meter: {
    id: 'power_meter',
    title: 'Power',
    risk: 'low',
    readOnly: true,
    stateSchema: z.object({ watts: z.number().min(0).max(100_000) }).strict(),
    actions: {},
  },
  battery: {
    id: 'battery',
    title: 'Battery',
    risk: 'low',
    readOnly: true,
    stateSchema: z.object({ percent: z.number().min(0).max(100) }).strict(),
    actions: {},
  },
  position: {
    id: 'position',
    title: 'Position',
    risk: 'low',
    readOnly: true,
    stateSchema: z
      .object({
        value: z.number().min(0).max(100),
        unit: z.literal('percent'),
      })
      .strict(),
    actions: {},
  },
  media_control: {
    id: 'media_control',
    title: 'Media',
    risk: 'medium',
    readOnly: false,
    stateSchema: z.object({ playback: playbackSchema }).strict(),
    actions: {
      set: z.object({ playback: playbackSchema }).strict(),
    },
  },
};

export function getCapability(id: string): CapabilityDefinition | undefined {
  if (!capabilityIdSchema.safeParse(id).success) return undefined;
  return capabilityCatalog[id as CapabilityId];
}

export function assertCapability(id: string): CapabilityDefinition {
  const capability = getCapability(id);
  if (!capability) {
    throw new Error(`Unknown capability: ${id}`);
  }
  return capability;
}
