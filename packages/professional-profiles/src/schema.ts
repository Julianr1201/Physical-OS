import { z } from 'zod';

const text = z.object({ en: z.string().min(1).max(400), es: z.string().min(1).max(400) });

export const profileToolSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).max(64),
  effect: z.enum(['read', 'propose', 'checkout', 'handoff', 'teach']),
});

export const profileManifestSchema = z.object({
  schemaVersion: z.literal(1),
  profileId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  industry: z.string().min(2).max(40),
  profession: z.string().min(2).max(40),
  specialization: z.string().min(2).max(40),
  displayName: text,
  description: text,
  purpose: z.string().min(1).max(400),
  capabilities: z.array(z.string().min(1).max(80)).min(1).max(20),
  knowledgeSources: z.array(z.string().min(1).max(80)).max(12),
  tools: z.array(profileToolSchema).min(1).max(16),
  requiredPermissions: z.array(z.string().min(1).max(80)).max(20),
  safetyPolicies: z.array(z.string().min(1).max(80)).min(1).max(12),
  presencePreset: z.string().min(1).max(40),
  voicePreset: z.string().min(1).max(40),
  supportedLanguages: z.array(z.enum(['en', 'es'])).min(1),
  handoffPolicy: z.object({
    cues: z.array(z.string().min(2).max(40)).max(20),
    target: z.string().min(2).max(80),
  }),
  deploymentRequirements: z.object({
    simulated: z.literal(true),
    integrations: z.array(z.string().min(1).max(80)).max(12),
  }),
  tone: z.object({
    formality: z.enum(['casual', 'professional', 'formal']),
    pace: z.enum(['calm', 'measured', 'brisk']),
    greeting: text,
  }),
  disclosure: text,
  metrics: z.array(z.enum(['turns', 'handoffs', 'denied', 'checkouts'])).min(1),
});

export type ProfileManifest = z.infer<typeof profileManifestSchema>;
export type ProfileTool = z.infer<typeof profileToolSchema>;

export function parseManifest(raw: unknown): ProfileManifest {
  return profileManifestSchema.parse(raw);
}
