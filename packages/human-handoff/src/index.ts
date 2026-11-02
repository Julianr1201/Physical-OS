export interface HandoffRecord {
  id: string;
  profileId: string;
  target: string;
  reason: string;
  at: string;
}

export function matchCue(cues: string[], utterance: string): string | null {
  const text = utterance.toLowerCase();
  return cues.find((cue) => text.includes(cue.toLowerCase())) ?? null;
}

export function openHandoff(input: { id: string; profileId: string; target: string; reason: string; at: string }): HandoffRecord {
  return {
    id: input.id,
    profileId: input.profileId,
    target: input.target,
    reason: input.reason,
    at: input.at,
  };
}
