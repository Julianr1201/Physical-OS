import { describe, expect, it } from 'vitest';
import {
  absentProvider,
  acceptProvider,
  advanceBlink,
  applyFrame,
  chooseTier,
  createBlink,
  defaultPrivacy,
  extentMatchesUp,
  femaleAdult01Axes,
  figureKind,
  frameAvatar,
  gestureMouth,
  initialTurn,
  isEcho,
  lineForExecution,
  mouthFromBoundary,
  particleBudget,
  presenceFocus,
  recordingIndicator,
  reduceTurn,
  replyFromInterpret,
  sampleFigure,
  setCameraGaze,
  shellBudget,
  stepVad,
  visualFor,
  visemeFromBoundary,
  createVad,
} from './index.js';

describe('presence behavior', () => {
  it('wakes, listens, speaks, and returns to idle', () => {
    let turn = initialTurn();
    turn = reduceTurn(turn, { type: 'awaken' }).turn;
    expect(turn.state).toBe('AWAKENING');
    turn = reduceTurn(turn, { type: 'ready' }).turn;
    turn = reduceTurn(turn, { type: 'listen' }).turn;
    const generation = turn.generation;
    turn = reduceTurn(turn, { type: 'heard' }).turn;
    expect(turn.state).toBe('THINKING');
    expect(turn.expression).toBe('thoughtful');
    turn = reduceTurn(turn, {
      type: 'reply',
      generation,
      canSpeak: true,
      reply: { kind: 'say', text: 'The living room is 22 degrees.', expression: 'attentive' },
    }).turn;
    expect(turn.state).toBe('SPEAKING');
    expect(turn.speech).toBe('playing');
    turn = reduceTurn(turn, { type: 'speech_ended', generation }).turn;
    expect(turn.state).toBe('IDLE');
    expect(turn.expression).toBe('neutral');
  });

  it('drops a late reply and cancels speech on interruption', () => {
    let turn = reduceTurn(initialTurn(), { type: 'awaken' }).turn;
    turn = reduceTurn(turn, { type: 'ready' }).turn;
    turn = reduceTurn(turn, { type: 'listen' }).turn;
    const generation = turn.generation;
    turn = reduceTurn(turn, { type: 'heard' }).turn;
    turn = reduceTurn(turn, {
      type: 'reply',
      generation,
      canSpeak: true,
      reply: { kind: 'say', text: 'Working.', expression: 'neutral' },
    }).turn;
    const interrupted = reduceTurn(turn, { type: 'interrupt' });
    expect(interrupted.cancelSpeech).toBe(true);
    expect(interrupted.turn.state).toBe('LISTENING');
    const late = reduceTurn(interrupted.turn, {
      type: 'reply',
      generation,
      canSpeak: true,
      reply: { kind: 'say', text: 'Too late.', expression: 'neutral' },
    });
    expect(late.turn).toBe(interrupted.turn);
    expect(late.turn.line).toBeNull();
  });

  it('holds a plan until confirmation and discards it when interrupted', () => {
    let turn = reduceTurn(initialTurn(), { type: 'awaken' }).turn;
    turn = reduceTurn(turn, { type: 'ready' }).turn;
    turn = reduceTurn(turn, { type: 'listen' }).turn;
    const generation = turn.generation;
    turn = reduceTurn(turn, { type: 'heard' }).turn;
    turn = reduceTurn(turn, {
      type: 'reply',
      generation,
      canSpeak: false,
      reply: { kind: 'confirm', planId: 'plan-1', text: 'Turn off the living room lights.' },
    }).turn;
    expect(turn.state).toBe('ACTING');
    expect(turn.planId).toBe('plan-1');
    expect(turn.speech).toBe('caption');
    const interrupted = reduceTurn(turn, { type: 'interrupt' });
    expect(interrupted.discardPlanId).toBe('plan-1');
    expect(interrupted.turn.planId).toBeNull();
  });

  it('does not interrupt an approval that is already running', () => {
    let turn = reduceTurn(initialTurn(), { type: 'awaken' }).turn;
    turn = reduceTurn(turn, { type: 'ready' }).turn;
    turn = reduceTurn(turn, { type: 'listen' }).turn;
    turn = reduceTurn(turn, { type: 'heard' }).turn;
    turn = reduceTurn(turn, {
      type: 'reply',
      generation: turn.generation,
      canSpeak: false,
      reply: { kind: 'confirm', planId: 'plan-2', text: 'Turn on the lamp.' },
    }).turn;
    const approval = reduceTurn(turn, { type: 'approve' });
    expect(approval.turn.state).toBe('THINKING');
    expect(approval.turn.planId).toBe('plan-2');
    expect(reduceTurn(approval.turn, { type: 'interrupt' }).turn).toBe(approval.turn);
  });

  it('keeps idle neutral and moves the gaze while thinking', () => {
    const idle = visualFor('IDLE', 'neutral', 0.4, 1);
    const later = visualFor('IDLE', 'neutral', 2.4, 1);
    expect(idle.expression).toBe('neutral');
    expect(idle.mouthBias).toBe(0);
    expect(idle.gazeX).not.toBe(later.gazeX);
    const thinking = visualFor('THINKING', 'thoughtful', 0, 1);
    expect(thinking.gazeX).toBeGreaterThan(0.3);
    expect(visualFor('SLEEPING', 'neutral', 1, 1).blinkBias).toBe(1);
    expect(visualFor('SPEAKING', 'pleased', 1, 1).audio).toBe('voice');
  });

  it('opens the mouth on a vowel and keeps a gesture preview silent', () => {
    expect(mouthFromBoundary('hola', 1)).toBeGreaterThan(mouthFromBoundary('hola', 0));
    expect(gestureMouth(0, 1000)).toBe(0);
    expect(gestureMouth(100, 1000)).toBeGreaterThan(0);
  });

  it('blinks and then opens again', () => {
    const closed = advanceBlink(createBlink(0.2), 0.2, 0.016, false);
    expect(closed.closed).toBe(1);
    const open = advanceBlink(closed, 0.4, 0.2, false);
    expect(open.closed).toBeLessThan(1);
    expect(advanceBlink(open, 0.5, 0.016, true).closed).toBe(1);
  });
});

describe('presence privacy and performance', () => {
  it('keeps the camera off and refuses retained media', () => {
    const privacy = defaultPrivacy();
    expect(privacy.cameraGaze).toBe(false);
    expect(privacy.retainMedia).toBe(false);
    expect(recordingIndicator(privacy, false)).toBe('off');
    const live = setCameraGaze({ ...privacy, microphone: true }, true);
    expect(recordingIndicator(live, true)).toBe('both');
    expect(recordingIndicator(setCameraGaze(live, false), true)).toBe('microphone');
  });

  it('selects a tier from a measured frame rate before the CPU guess', () => {
    expect(chooseTier({ cores: 8, memoryGb: 16, measuredFps: 20 })).toBe('low');
    expect(chooseTier({ cores: 8, memoryGb: 16, measuredFps: 40 })).toBe('medium');
    expect(chooseTier({ cores: 8, memoryGb: 16, measuredFps: null })).toBe('high');
    expect(chooseTier({ cores: 4, memoryGb: null, measuredFps: null })).toBe('medium');
    expect(particleBudget('high')).toBeGreaterThan(particleBudget('medium'));
    expect(particleBudget('medium')).toBeGreaterThan(particleBudget('low'));
  });

  it('does not invent a speech provider', () => {
    expect(acceptProvider(null, 'recognition').available).toBe(false);
    expect(absentProvider('synthesis').id).toBe('none');
  });

  it('samples a face denser at the eyes than across the head', () => {
    const figure = sampleFigure(2000);
    expect(figure.count).toBe(2000);
    const eyes = span(figure, figureKind.eye, 0);
    const head = span(figure, figureKind.head, 0);
    expect(eyes).toBeLessThan(head);
    expect(meanAxis(figure, figureKind.eye, 2)).toBeGreaterThan(meanAxis(figure, figureKind.torso, 2));
    expect(meanAxis(figure, figureKind.hand, 2)).toBeGreaterThan(meanAxis(figure, figureKind.torso, 2));
    expect(meanAxis(figure, figureKind.hair, 2)).toBeLessThan(meanAxis(figure, figureKind.head, 2));
    expect(meanAxis(figure, figureKind.ring, 1)).toBeLessThan(meanAxis(figure, figureKind.torso, 1));
    let left = false;
    let right = false;
    for (let index = 0; index < figure.count; index += 1) {
      if ((figure.kind[index] ?? 0) !== figureKind.eye) continue;
      const x = figure.positions[index * 3] ?? 0;
      if (x > 0.03) right = true;
      if (x < -0.03) left = true;
      expect(Number.isFinite(x)).toBe(true);
    }
    expect(left && right).toBe(true);
    const face = sampleFigure(800, { body: false });
    expect([...face.kind].some((kind) => kind === figureKind.torso || kind === figureKind.arm || kind === figureKind.hand || kind === figureKind.ring)).toBe(false);
  });

  it('maps intelligence results without treating a delivery as verified', () => {
    const plan = replyFromInterpret({ type: 'plan', plan: { id: 'p1', explanation: 'Turn off the lights.' } });
    expect(plan).toEqual({ kind: 'confirm', planId: 'p1', text: 'Turn off the lights.' });
    expect(replyFromInterpret({ type: 'query', explanation: '22 °C' }).kind).toBe('say');
    const sent = lineForExecution([{ verified: false, outcome: 'delivered' }], 'Done.', { sent: 'Sent.', failed: 'Failed.' });
    expect(sent.expression).not.toBe('pleased');
    expect(sent.line).toContain('Sent.');
    const verified = lineForExecution([{ verified: true, outcome: 'verified' }], 'Done.', { sent: 'Sent.', failed: 'Failed.' });
    expect(verified.expression).toBe('pleased');
    expect(isEcho('turn off the lights', 'Turn off the lights.')).toBe(true);
  });

  it('requires a short run of energy before calling speech active', () => {
    const first = stepVad(createVad(), 0.1, 0);
    expect(first.active).toBe(false);
    const held = stepVad(first, 0.1, 200);
    expect(held.active).toBe(true);
    expect(stepVad(held, 0.01, 260).active).toBe(false);
  });
});

describe('avatar frame', () => {
  it('turns the measured rocketbox axes to face the camera without mirroring', () => {
    const center: [number, number, number] = [0, 0.2, 1.6];
    const frame = frameAvatar(femaleAdult01Axes, center, presenceFocus);
    const origin = applyFrame(frame, [0, 0, 0]);
    const up = applyFrame(frame, [0, 0, 1]);
    const face = applyFrame(frame, [0, 1, 0]);
    const right = applyFrame(frame, [1, 0, 0]);
    expect(up[1] - origin[1]).toBeCloseTo(1);
    expect(face[2] - origin[2]).toBeCloseTo(1);
    expect(right[0] - origin[0]).toBeCloseTo(-1);
    const placed = applyFrame(frame, center);
    expect(placed[0]).toBeCloseTo(presenceFocus[0]);
    expect(placed[1]).toBeCloseTo(presenceFocus[1]);
    expect(placed[2]).toBeCloseTo(presenceFocus[2]);
    expect(extentMatchesUp([-0.61, -0.13, 0], [0.61, 0.25, 1.74], femaleAdult01Axes.up)).toBe(true);
    expect(extentMatchesUp([-0.61, -0.13, 0], [0.61, 0.25, 1.74], [0, 1, 0])).toBe(false);
  });

  it('maps Spanish speech marks onto visemes and keeps a vowel more open than a consonant', () => {
    expect(visemeFromBoundary('Hola', 1).viseme).toBe('O');
    expect(visemeFromBoundary('México', 1).viseme).toBe('E');
    expect(visemeFromBoundary('tú', 1).viseme).toBe('U');
    expect(visemeFromBoundary('papá', 0).viseme).toBe('PP');
    expect(visemeFromBoundary('café', 2).viseme).toBe('FF');
    expect(mouthFromBoundary('hola', 1)).toBeGreaterThan(mouthFromBoundary('hola', 0));
    expect(shellBudget('high')).toBeGreaterThan(shellBudget('medium'));
    expect(shellBudget('medium')).toBeGreaterThan(shellBudget('low'));
  });
});

function span(figure: { count: number; positions: Float32Array; kind: Float32Array }, kind: number, axis: number): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < figure.count; index += 1) {
    if ((figure.kind[index] ?? 0) !== kind) continue;
    const value = figure.positions[index * 3 + axis] ?? 0;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return max - min;
}

function meanAxis(figure: { count: number; positions: Float32Array; kind: Float32Array }, kind: number, axis: number): number {
  let sum = 0;
  let count = 0;
  for (let index = 0; index < figure.count; index += 1) {
    if ((figure.kind[index] ?? 0) !== kind) continue;
    sum += figure.positions[index * 3 + axis] ?? 0;
    count += 1;
  }
  return sum / count;
}
