import { describe, expect, it } from 'vitest';
import {
  animationLibrary,
  blendMorphs,
  clipIntent,
  cueFromMarks,
  digitalHumanBones,
  digitalHumanComplete,
  digitalHumanMorphs,
  morphFrame,
} from './digital-human.js';
import { visemeFromBoundary } from './visual.js';

describe('digital human controller', () => {
  it('keeps the character incomplete until authored clips and mesh variants exist', () => {
    expect(digitalHumanComplete).toBe(false);
    expect(digitalHumanMorphs).toContain('viseme_aa');
    expect(digitalHumanBones).toHaveLength(69);
    expect(animationLibrary.filter((row) => row.status === 'missing').map((row) => row.id)).toEqual([
      'pointing',
      'presenting',
      'confirming',
      'surprised',
      'concerned',
    ]);
  });

  it('selects talk while speaking and returns to idle', () => {
    expect(clipIntent('SPEAKING', 'neutral')).toEqual({ clip: 'Talk', loop: true });
    expect(clipIntent('IDLE', 'neutral')).toEqual({ clip: 'Idle', loop: true });
    expect(clipIntent('AWAKENING', 'neutral').clip).toBe('Wave');
    expect(clipIntent('IDLE', 'pleased').clip).toBe('Laugh');
  });

  it('drives an oculus viseme for a Spanish vowel instead of jaw alone', () => {
    const line = 'Hola, buenos días';
    const frames = [...line].map((_, index) =>
      morphFrame({
        expression: 'neutral',
        blink: 0,
        cue: visemeFromBoundary(line, index),
        marks: null,
        timeMs: 0,
        gestureMouth: null,
      }),
    );
    const openO = frames.find((frame) => (frame.weights.viseme_O ?? 0) > 0);
    const openA = frames.find((frame) => (frame.weights.viseme_aa ?? 0) > 0);
    expect(openO?.lipsync).toBe('character-fallback');
    expect(openO?.weights.viseme_O ?? 0).toBeGreaterThan(openO?.weights.jawOpen ?? 1);
    expect(openA?.weights.viseme_aa ?? 0).toBeGreaterThan(openA?.weights.jawOpen ?? 1);
    const closed = frames.find((frame) => (frame.weights.viseme_PP ?? 0) > 0);
    expect(closed?.weights.jawOpen).toBe(0);
  });

  it('follows viseme marks when the provider supplies them', () => {
    const marks = [
      { atMs: 0, viseme: 'sil' as const },
      { atMs: 80, viseme: 'O' as const },
      { atMs: 180, viseme: 'aa' as const },
    ];
    expect(cueFromMarks(marks, 40)?.viseme).toBeUndefined();
    const spoken = morphFrame({
      expression: 'neutral',
      blink: 0,
      cue: null,
      marks,
      timeMs: 100,
      gestureMouth: null,
    });
    expect(spoken.lipsync).toBe('marks');
    expect(spoken.weights.viseme_O ?? 0).toBeGreaterThan(spoken.weights.jawOpen ?? 0);
  });

  it('releases the mouth back toward idle after an interruption', () => {
    const spoken = morphFrame({
      expression: 'neutral',
      blink: 0,
      cue: visemeFromBoundary('a', 0),
      marks: null,
      timeMs: 0,
      gestureMouth: null,
    });
    const mid = blendMorphs(spoken.weights, morphFrame({
      expression: 'neutral',
      blink: 0,
      cue: null,
      marks: null,
      timeMs: 0,
      gestureMouth: null,
    }).weights, 0.08);
    expect(mid.viseme_aa ?? 0).toBeLessThan(spoken.weights.viseme_aa ?? 0);
    const settled = blendMorphs(mid, morphFrame({
      expression: 'neutral',
      blink: 0,
      cue: null,
      marks: null,
      timeMs: 0,
      gestureMouth: null,
    }).weights, 0.6);
    expect(settled.viseme_aa).toBeLessThan(0.05);
    expect(settled.jawOpen).toBeLessThan(0.05);
  });

  it('labels the silent gesture and still uses a viseme shape', () => {
    const frame = morphFrame({
      expression: 'neutral',
      blink: 0,
      cue: null,
      marks: null,
      timeMs: 0,
      gestureMouth: 0.7,
    });
    expect(frame.lipsync).toBe('silent-gesture');
    expect(frame.weights.viseme_aa ?? 0).toBeGreaterThan(frame.weights.jawOpen ?? 0);
  });
});
