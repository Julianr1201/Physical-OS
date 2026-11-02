export interface VadClock {
  active: boolean;
  since: number | null;
}

export function createVad(): VadClock {
  return { active: false, since: null };
}

export function stepVad(clock: VadClock, rms: number, timeMs: number, threshold = 0.045, holdMs = 180): VadClock {
  if (rms >= threshold) {
    if (clock.since === null) return { active: false, since: timeMs };
    if (timeMs - clock.since >= holdMs) return { active: true, since: clock.since };
    return clock;
  }
  return { active: false, since: null };
}
