export const presenceStates = [
  'DORMANT',
  'AWAKENING',
  'IDLE',
  'LISTENING',
  'THINKING',
  'SPEAKING',
  'ACTING',
  'ERROR',
  'SLEEPING',
] as const;

export type PresenceState = (typeof presenceStates)[number];

export const expressions = ['neutral', 'curious', 'attentive', 'pleased', 'concerned', 'thoughtful'] as const;

export type ExpressionName = (typeof expressions)[number];
