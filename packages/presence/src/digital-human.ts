import type { ExpressionName, PresenceState } from './state.js';
import type { SpeechCue, Viseme } from './visual.js';

/** The character is not finished. Blender authoring, unique clips, and mesh variants are still open. */
export const digitalHumanComplete = false;

export const digitalHumanUrl = '/presence/digital-human/female-executive.glb';

export const digitalHumanMorphs = [
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeWideLeft',
  'eyeWideRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'jawOpen',
  'mouthSmile',
  'mouthFrown',
  'mouthPucker',
  'mouthPress',
  'mouthStretch',
  'noseSneerLeft',
  'noseSneerRight',
  'mouthUpperUp',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
] as const;

export const digitalHumanBones = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  'Jaw',
  'LeftEye',
  'RightEye',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'LeftHandThumb1',
  'LeftHandThumb2',
  'LeftHandThumb3',
  'LeftHandThumb4',
  'LeftHandIndex1',
  'LeftHandIndex2',
  'LeftHandIndex3',
  'LeftHandIndex4',
  'LeftHandMiddle1',
  'LeftHandMiddle2',
  'LeftHandMiddle3',
  'LeftHandMiddle4',
  'LeftHandRing1',
  'LeftHandRing2',
  'LeftHandRing3',
  'LeftHandRing4',
  'LeftHandPinky1',
  'LeftHandPinky2',
  'LeftHandPinky3',
  'LeftHandPinky4',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'LeftToe_End',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'RightHandThumb1',
  'RightHandThumb2',
  'RightHandThumb3',
  'RightHandThumb4',
  'RightHandIndex1',
  'RightHandIndex2',
  'RightHandIndex3',
  'RightHandIndex4',
  'RightHandMiddle1',
  'RightHandMiddle2',
  'RightHandMiddle3',
  'RightHandMiddle4',
  'RightHandRing1',
  'RightHandRing2',
  'RightHandRing3',
  'RightHandRing4',
  'RightHandPinky1',
  'RightHandPinky2',
  'RightHandPinky3',
  'RightHandPinky4',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
  'RightToe_End',
  'WeaponR',
] as const;

export type AnimationStatus = 'authored' | 'reused' | 'missing';

export interface LibraryClip {
  id: string;
  clip: string | null;
  status: AnimationStatus;
}

/** Clips that exist in the exported GLB. Missing rows have no authored take. */
export const animationLibrary: readonly LibraryClip[] = [
  { id: 'idle', clip: 'Idle', status: 'authored' },
  { id: 'breathing', clip: 'Idle', status: 'reused' },
  { id: 'listening', clip: 'Idle', status: 'reused' },
  { id: 'thinking', clip: 'Idle', status: 'reused' },
  { id: 'speaking', clip: 'Talk', status: 'authored' },
  { id: 'greeting', clip: 'Wave', status: 'authored' },
  { id: 'pointing', clip: null, status: 'missing' },
  { id: 'presenting', clip: null, status: 'missing' },
  { id: 'confirming', clip: null, status: 'missing' },
  { id: 'surprised', clip: null, status: 'missing' },
  { id: 'happy', clip: 'Laugh', status: 'authored' },
  { id: 'concerned', clip: null, status: 'missing' },
  { id: 'goodbye', clip: 'Wave', status: 'reused' },
];

export interface ClipIntent {
  clip: string;
  loop: boolean;
}

export function clipIntent(state: PresenceState, expression: ExpressionName): ClipIntent {
  if (state === 'SPEAKING') return { clip: 'Talk', loop: true };
  if (state === 'AWAKENING') return { clip: 'Wave', loop: false };
  if (expression === 'pleased') return { clip: 'Laugh', loop: false };
  return { clip: 'Idle', loop: true };
}

const visemeMorph: Record<Exclude<Viseme, 'sil'>, (typeof digitalHumanMorphs)[number]> = {
  PP: 'viseme_PP',
  FF: 'viseme_FF',
  aa: 'viseme_aa',
  E: 'viseme_E',
  I: 'viseme_I',
  O: 'viseme_O',
  U: 'viseme_U',
  etc: 'viseme_DD',
};

const openVowels = new Set<Viseme>(['aa', 'E', 'O']);

export type LipsyncMode = 'marks' | 'character-fallback' | 'silent-gesture' | 'idle';

export interface VisemeMark {
  atMs: number;
  viseme: Viseme;
}

export function cueFromMarks(marks: readonly VisemeMark[], timeMs: number): SpeechCue | null {
  let chosen: VisemeMark | null = null;
  for (const mark of marks) {
    if (mark.atMs <= timeMs) chosen = mark;
  }
  if (!chosen || chosen.viseme === 'sil') return null;
  return { viseme: chosen.viseme, mouth: 0, charIndex: -1 };
}

function emptyFace(): Record<string, number> {
  return {
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    eyeWideLeft: 0,
    eyeWideRight: 0,
    browInnerUp: 0,
    browDownLeft: 0,
    browDownRight: 0,
    mouthSmile: 0,
    mouthFrown: 0,
    jawOpen: 0,
    viseme_PP: 0,
    viseme_FF: 0,
    viseme_aa: 0,
    viseme_E: 0,
    viseme_I: 0,
    viseme_O: 0,
    viseme_U: 0,
    viseme_DD: 0,
  };
}

function applyCue(weights: Record<string, number>, cue: SpeechCue): void {
  if (cue.viseme === 'sil') return;
  const morph = visemeMorph[cue.viseme];
  weights[morph] = 0.82;
  if (openVowels.has(cue.viseme)) weights.jawOpen = 0.16;
}

export function morphFrame(input: {
  expression: ExpressionName;
  blink: number;
  cue: SpeechCue | null;
  marks: readonly VisemeMark[] | null;
  timeMs: number;
  gestureMouth: number | null;
}): { weights: Record<string, number>; lipsync: LipsyncMode } {
  const weights = emptyFace();
  weights.eyeBlinkLeft = input.blink;
  weights.eyeBlinkRight = input.blink;
  if (input.expression === 'pleased') weights.mouthSmile = 0.4;
  if (input.expression === 'concerned') {
    weights.mouthFrown = 0.35;
    weights.browDownLeft = 0.4;
    weights.browDownRight = 0.4;
  }
  if (input.expression === 'curious') {
    weights.browInnerUp = 0.45;
    weights.eyeWideLeft = 0.22;
    weights.eyeWideRight = 0.22;
  }

  if (input.marks && input.marks.length > 0) {
    const cue = cueFromMarks(input.marks, input.timeMs);
    if (cue) applyCue(weights, cue);
    return { weights, lipsync: 'marks' };
  }
  if (input.cue) {
    applyCue(weights, input.cue);
    return { weights, lipsync: input.cue.viseme === 'sil' ? 'idle' : 'character-fallback' };
  }
  if (input.gestureMouth !== null && input.gestureMouth > 0) {
    weights.viseme_aa = input.gestureMouth * 0.45;
    weights.jawOpen = input.gestureMouth * 0.12;
    return { weights, lipsync: 'silent-gesture' };
  }
  return { weights, lipsync: 'idle' };
}

export function blendMorphs(
  current: Record<string, number>,
  target: Record<string, number>,
  dtSeconds: number,
): Record<string, number> {
  const rate = 1 - Math.exp(-Math.max(0, dtSeconds) * 14);
  const next: Record<string, number> = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(target)]);
  for (const key of keys) {
    const from = current[key] ?? 0;
    const to = target[key] ?? 0;
    next[key] = from + (to - from) * rate;
  }
  return next;
}
