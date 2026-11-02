import type { ExpressionName, PresenceState } from './state.js';

export interface VisualPose {
  expression: ExpressionName;
  gazeX: number;
  gazeY: number;
  blinkBias: number;
  gesture: number;
  spread: number;
  energy: number;
  mouthBias: number;
  brow: number;
  opacity: number;
  audio: 'none' | 'tone' | 'voice';
}

export interface BlinkClock {
  nextAt: number;
  closed: number;
}

function drift(time: number, a: number, b: number): number {
  return Math.sin(time * a) * 0.22 + Math.sin(time * b) * 0.11;
}

const brows: Record<ExpressionName, number> = {
  neutral: 0,
  curious: 0.8,
  attentive: 0.35,
  pleased: 0.12,
  concerned: -0.55,
  thoughtful: 0.2,
};

export function visualFor(state: PresenceState, expression: ExpressionName, time: number, awaken: number): VisualPose {
  const idleGaze = drift(time, 0.37, 0.19);
  let gazeX = idleGaze;
  let gazeY = drift(time, 0.23, 0.13) * 0.65;
  let gesture = 0.12;
  let spread = 1;
  let energy = 0.55;
  let opacity = 0.9;
  let blinkBias = 0;
  let audio: VisualPose['audio'] = 'none';
  const progress = Math.min(1, Math.max(0, awaken));

  if (state === 'DORMANT') {
    spread = 1.7;
    energy = 0.15;
    opacity = 0.38;
    gazeY = -0.2;
    gesture = 0;
  } else if (state === 'AWAKENING') {
    spread = 1.55 - progress * 0.53;
    energy = 0.25 + progress * 0.4;
    opacity = 0.45 + progress * 0.45;
    audio = 'tone';
  } else if (state === 'LISTENING') {
    gazeX = idleGaze * 0.35;
    gazeY = 0.08 + drift(time, 0.41, 0.17) * 0.15;
    gesture = 0.22;
    energy = 0.7;
  } else if (state === 'THINKING') {
    gazeX = 0.42 + drift(time, 0.29, 0.11) * 0.2;
    gazeY = 0.16;
    gesture = 0.08;
    energy = 0.3;
  } else if (state === 'SPEAKING') {
    gazeX = idleGaze * 0.55;
    gesture = 0.3;
    energy = 0.62;
    audio = 'voice';
  } else if (state === 'ACTING') {
    gazeX = 0.18;
    gazeY = -0.04;
    gesture = 0.72;
    energy = 0.5;
  } else if (state === 'ERROR') {
    gazeX = idleGaze * 0.25;
    gazeY = -0.22;
    gesture = 0.04;
    energy = 0.2;
    audio = 'tone';
  } else if (state === 'SLEEPING') {
    spread = 1.18;
    gazeY = -0.55;
    gazeX = idleGaze * 0.15;
    gesture = 0.02;
    energy = 0.08;
    opacity = 0.5;
    blinkBias = 1;
  }

  return {
    expression,
    gazeX,
    gazeY,
    blinkBias,
    gesture,
    spread,
    energy,
    mouthBias: expression === 'pleased' ? 0.06 : 0,
    brow: brows[expression],
    opacity,
    audio,
  };
}

export function createBlink(start = 1.8): BlinkClock {
  return { nextAt: start, closed: 0 };
}

export function advanceBlink(clock: BlinkClock, time: number, dt: number, forceClosed: boolean): BlinkClock {
  if (forceClosed) return { nextAt: clock.nextAt, closed: 1 };
  if (clock.closed > 0) return { nextAt: clock.nextAt, closed: Math.max(0, clock.closed - dt * 6.5) };
  if (time < clock.nextAt) return clock;
  const gap = 2.6 + ((time * 1.3) % 1.5);
  return { nextAt: time + gap, closed: 1 };
}

export type Viseme = 'sil' | 'PP' | 'FF' | 'aa' | 'E' | 'I' | 'O' | 'U' | 'etc';

export interface SpeechCue {
  viseme: Viseme;
  mouth: number;
  charIndex: number;
}

/** Maps one spoken character to a viseme. Spanish vowels keep their accent forms. */
export function visemeFromBoundary(text: string, charIndex: number): SpeechCue {
  const lower = (text[charIndex] ?? ' ').toLowerCase();
  if ('aá'.includes(lower)) return { viseme: 'aa', mouth: 0.75, charIndex };
  if ('eé'.includes(lower)) return { viseme: 'E', mouth: 0.75, charIndex };
  if ('ií'.includes(lower)) return { viseme: 'I', mouth: 0.55, charIndex };
  if ('oó'.includes(lower)) return { viseme: 'O', mouth: 0.7, charIndex };
  if ('uúü'.includes(lower)) return { viseme: 'U', mouth: 0.45, charIndex };
  if ('mpb'.includes(lower)) return { viseme: 'PP', mouth: 0.08, charIndex };
  if ('fv'.includes(lower)) return { viseme: 'FF', mouth: 0.22, charIndex };
  if (lower === ' ' || lower === '.' || lower === ',' || lower === '¿' || lower === '?') return { viseme: 'sil', mouth: 0.05, charIndex };
  return { viseme: 'etc', mouth: 0.32, charIndex };
}

export function mouthFromBoundary(text: string, charIndex: number): number {
  return visemeFromBoundary(text, charIndex).mouth;
}

/** Visual timing for a gesture preview. This does not synthesize audio. */
export function gestureMouth(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const t = elapsedMs / durationMs;
  if (t <= 0 || t >= 1) return 0;
  return Math.max(0, Math.sin(t * Math.PI * 8)) * 0.7;
}
