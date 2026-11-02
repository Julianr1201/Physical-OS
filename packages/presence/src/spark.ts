import type { ExpressionName, PresenceState } from './state.js';
import type { PerformanceTier } from './tier.js';

export const sparkMoods = [
  'DORMANT',
  'IDLE',
  'LISTENING',
  'THINKING',
  'SPEAKING',
  'ACTING',
  'SUCCESS',
  'ERROR',
  'OFFLINE',
] as const;

export type SparkMood = (typeof sparkMoods)[number];

export type SparkLink = 'ready' | 'offline';

/** Local canvas only. Piper and whisper.cpp are not installed on this machine. */
export const sparkRuntime = {
  visual: 'local-canvas',
  piper: null,
  whisper: null,
  recognition: 'browser-speech-recognition',
  synthesis: 'browser-speech-synthesis',
  mexicanAccentValidated: false,
} as const;

const femaleName = /sabina|paulina|helena|elena|dalia|elvira|m[oó]nica|laura|sof[ií]a|female|mujer|woman/i;

export function spanishFemaleVoice(voices: readonly { name: string; lang: string }[]): { name: string; lang: string } | null {
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().startsWith('es'));
  return spanish.find((voice) => femaleName.test(voice.name)) ?? null;
}

export function sparkMood(state: PresenceState, expression: ExpressionName, link: SparkLink): SparkMood {
  if (link === 'offline') return 'OFFLINE';
  if (state === 'ERROR') return 'ERROR';
  if (state === 'DORMANT' || state === 'SLEEPING') return 'DORMANT';
  if (expression === 'pleased' && (state === 'IDLE' || state === 'SPEAKING')) return 'SUCCESS';
  if (state === 'LISTENING') return 'LISTENING';
  if (state === 'THINKING') return 'THINKING';
  if (state === 'SPEAKING') return 'SPEAKING';
  if (state === 'ACTING') return 'ACTING';
  return 'IDLE';
}

export function sparkDensity(tier: PerformanceTier): { filaments: number; motes: number } {
  if (tier === 'low') return { filaments: 2, motes: 8 };
  if (tier === 'medium') return { filaments: 3, motes: 16 };
  return { filaments: 5, motes: 28 };
}

export function decayLevel(current: number, target: number, dtSeconds: number): number {
  const rate = 1 - Math.exp(-Math.max(0, dtSeconds) * 8);
  return current + (target - current) * rate;
}
