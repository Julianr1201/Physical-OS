import type { ExpressionName, PresenceState } from './state.js';

export type SpeechMode = 'silent' | 'playing' | 'caption' | 'gesture';

export interface PresenceTurn {
  state: PresenceState;
  generation: number;
  expression: ExpressionName;
  line: string | null;
  planId: string | null;
  speech: SpeechMode;
  error: string | null;
}

export type EngineReply =
  | { kind: 'say'; text: string; expression: ExpressionName }
  | { kind: 'clarify'; text: string }
  | { kind: 'confirm'; text: string; planId: string }
  | { kind: 'unavailable'; text: string };

export type TurnEvent =
  | { type: 'awaken' }
  | { type: 'ready' }
  | { type: 'listen' }
  | { type: 'heard' }
  | { type: 'reply'; reply: EngineReply; generation: number; canSpeak: boolean }
  | { type: 'speech_ended'; generation: number }
  | { type: 'interrupt' }
  | { type: 'approve' }
  | { type: 'settled'; generation: number; line: string; expression: ExpressionName; canSpeak: boolean }
  | { type: 'reject' }
  | { type: 'preview'; line: string }
  | { type: 'fail'; message: string }
  | { type: 'dismiss' }
  | { type: 'sleep' };

export interface TurnEffect {
  turn: PresenceTurn;
  cancelSpeech: boolean;
  discardPlanId: string | null;
}

export function initialTurn(): PresenceTurn {
  return {
    state: 'DORMANT',
    generation: 0,
    expression: 'neutral',
    line: null,
    planId: null,
    speech: 'silent',
    error: null,
  };
}

export function reduceTurn(turn: PresenceTurn, event: TurnEvent): TurnEffect {
  switch (event.type) {
    case 'awaken':
      if (turn.state !== 'DORMANT' && turn.state !== 'SLEEPING') return same(turn);
      return change(turn, { state: 'AWAKENING', expression: 'neutral', error: null, speech: 'silent' });
    case 'ready':
      if (turn.state !== 'AWAKENING') return same(turn);
      return change(turn, { state: 'IDLE', expression: 'neutral' });
    case 'listen': {
      if (!canListen(turn)) return same(turn);
      return change(
        turn,
        {
          state: 'LISTENING',
          generation: turn.generation + 1,
          expression: 'attentive',
          planId: null,
          line: null,
          speech: 'silent',
        },
        { cancelSpeech: turn.speech === 'playing', discardPlanId: turn.planId },
      );
    }
    case 'heard':
      if (turn.state !== 'LISTENING') return same(turn);
      return change(turn, { state: 'THINKING', expression: 'thoughtful', speech: 'silent' });
    case 'reply': {
      if (turn.state !== 'THINKING' || event.generation !== turn.generation) return same(turn);
      if (event.reply.kind === 'confirm') {
        return change(turn, {
          state: 'ACTING',
          expression: 'attentive',
          line: event.reply.text,
          planId: event.reply.planId,
          speech: event.canSpeak ? 'playing' : 'caption',
        });
      }
      if (event.reply.kind === 'unavailable') {
        return change(turn, {
          state: 'ERROR',
          expression: 'concerned',
          line: event.reply.text,
          error: event.reply.text,
          speech: 'caption',
        });
      }
      const expression = event.reply.kind === 'say' ? event.reply.expression : 'curious';
      return change(turn, {
        state: 'SPEAKING',
        expression,
        line: event.reply.text,
        planId: null,
        speech: event.canSpeak ? 'playing' : 'caption',
      });
    }
    case 'speech_ended':
      if (event.generation !== turn.generation) return same(turn);
      if (turn.state === 'SPEAKING') return change(turn, { state: 'IDLE', speech: 'silent', expression: 'neutral' });
      if (turn.state === 'ACTING' && turn.speech === 'playing') return change(turn, { speech: 'caption' });
      return same(turn);
    case 'interrupt':
      if (turn.state !== 'SPEAKING' && turn.state !== 'ACTING' && !(turn.state === 'THINKING' && turn.planId === null)) return same(turn);
      return change(
        turn,
        {
          state: 'LISTENING',
          generation: turn.generation + 1,
          expression: 'attentive',
          speech: 'silent',
          planId: null,
          line: null,
        },
        { cancelSpeech: true, discardPlanId: turn.planId },
      );
    case 'approve':
      if (turn.state !== 'ACTING' || !turn.planId) return same(turn);
      return change(
        turn,
        { state: 'THINKING', expression: 'thoughtful', generation: turn.generation + 1, speech: 'silent' },
        { cancelSpeech: turn.speech === 'playing' },
      );
    case 'settled':
      if (turn.state !== 'THINKING' || event.generation !== turn.generation) return same(turn);
      return change(turn, {
        state: 'SPEAKING',
        expression: event.expression,
        line: event.line,
        planId: null,
        speech: event.canSpeak ? 'playing' : 'caption',
        error: null,
      });
    case 'reject':
      if (turn.state !== 'ACTING') return same(turn);
      return change(turn, { state: 'IDLE', planId: null, line: null, speech: 'silent', expression: 'neutral' }, { cancelSpeech: true });
    case 'preview':
      if (turn.state !== 'IDLE') return same(turn);
      return change(turn, {
        state: 'SPEAKING',
        expression: 'neutral',
        line: event.line,
        speech: 'gesture',
        generation: turn.generation + 1,
      });
    case 'fail':
      return change(
        turn,
        { state: 'ERROR', expression: 'concerned', error: event.message, line: event.message, speech: 'caption', planId: null },
        { cancelSpeech: true },
      );
    case 'dismiss':
      if (turn.state !== 'ERROR') return same(turn);
      return change(turn, { state: 'IDLE', expression: 'neutral', error: null, speech: 'silent' });
    case 'sleep':
      if (turn.state !== 'IDLE') return same(turn);
      return change(turn, { state: 'SLEEPING', expression: 'neutral', speech: 'silent' });
    default:
      return same(turn);
  }
}

function canListen(turn: PresenceTurn): boolean {
  if (turn.state === 'THINKING' && turn.planId) return false;
  return turn.state === 'IDLE' || turn.state === 'LISTENING' || turn.state === 'THINKING' || turn.state === 'SPEAKING' || turn.state === 'ACTING';
}

function same(turn: PresenceTurn): TurnEffect {
  return { turn, cancelSpeech: false, discardPlanId: null };
}

function change(turn: PresenceTurn, patch: Partial<PresenceTurn>, effect?: Partial<TurnEffect>): TurnEffect {
  return {
    turn: { ...turn, ...patch },
    cancelSpeech: effect?.cancelSpeech ?? false,
    discardPlanId: effect?.discardPlanId ?? null,
  };
}
