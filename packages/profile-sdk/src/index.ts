import { constraintById, deniedTool } from '@physical-os/industry-policies';
import { retrieveKnowledge } from '@physical-os/knowledge-connectors';
import { parseManifest, profileManifestSchema, type ProfileManifest } from '@physical-os/professional-profiles';
import { planTurn, type ProfilePlan } from '@physical-os/profile-runtime';

export { profileManifestSchema, parseManifest, starterProfiles, avatarCatalog, voiceCatalog } from '@physical-os/professional-profiles';
export { industryConstraints, floorDenies } from '@physical-os/industry-policies';
export { signManifest, verifyManifest, ProfileRegistry, ProfileError } from '@physical-os/profile-registry';
export { planTurn, ProfileHost } from '@physical-os/profile-runtime';
export type { ProfileManifest, ProfilePlan };

export function checkCompatibility(schemaVersion: number): { compatible: boolean; reason: string | null } {
  if (schemaVersion !== 1) return { compatible: false, reason: 'This engine accepts manifest schema 1.' };
  return { compatible: true, reason: null };
}

export function validateTools(manifest: ProfileManifest): string[] {
  return manifest.tools.filter((tool) => deniedTool(manifest.safetyPolicies, tool.id)).map((tool) => tool.id);
}

export function validateProfilePackage(raw: unknown): { ok: true; manifest: ProfileManifest } | { ok: false; issues: string[] } {
  const parsed = profileManifestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.map((issue) => issue.message) };
  const issues: string[] = [];
  if (!checkCompatibility(parsed.data.schemaVersion).compatible) issues.push('schema_version');
  for (const id of parsed.data.safetyPolicies) {
    if (!constraintById(id)) issues.push(`unknown_policy:${id}`);
  }
  issues.push(...validateTools(parsed.data).map((tool) => `tool_denied:${tool}`));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, manifest: parsed.data };
}

export function starterTemplate(input: { industry: string; profession: string; specialization: string }): ProfileManifest {
  return parseManifest({
    schemaVersion: 1,
    profileId: `${input.industry}.${input.profession}.${input.specialization}`.replace(/[^a-z0-9.]+/g, ''),
    version: '0.1.0',
    industry: input.industry,
    profession: input.profession,
    specialization: input.specialization,
    displayName: { en: input.profession, es: input.profession },
    description: { en: 'Simulated starter profile.', es: 'Perfil simulado de partida.' },
    purpose: 'Answer from approved notes and hand off anything else.',
    capabilities: ['answer'],
    knowledgeSources: [],
    tools: [
      { id: 'answer', effect: 'read' },
      { id: 'handoff_human', effect: 'handoff' },
    ],
    requiredPermissions: ['read_notes'],
    safetyPolicies: ['security.no_unlock'],
    presencePreset: 'figure-neutral',
    voicePreset: 'voice-calm',
    supportedLanguages: ['en', 'es'],
    handoffPolicy: { cues: ['help', 'ayuda'], target: 'A person' },
    deploymentRequirements: { simulated: true, integrations: [] },
    tone: {
      formality: 'professional',
      pace: 'calm',
      greeting: { en: 'Hello. I am an AI professional.', es: 'Hola. Soy un profesional de inteligencia artificial.' },
    },
    disclosure: {
      en: 'I am an AI professional, not a person.',
      es: 'Soy un profesional de inteligencia artificial, no una persona.',
    },
    metrics: ['turns', 'handoffs', 'denied', 'checkouts'],
  });
}

export function simulateProfile(manifest: ProfileManifest, utterance: string, now = new Date()): ProfilePlan {
  return planTurn(manifest, manifest.presencePreset, manifest.voicePreset, utterance, retrieveKnowledge(manifest.knowledgeSources, utterance, now));
}
