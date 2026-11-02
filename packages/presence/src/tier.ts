export type PerformanceTier = 'high' | 'medium' | 'low';

export function chooseTier(input: { cores: number; memoryGb: number | null; measuredFps: number | null }): PerformanceTier {
  if (input.measuredFps !== null && input.measuredFps < 24) return 'low';
  if (input.measuredFps !== null && input.measuredFps < 45) return 'medium';
  if (input.cores <= 2) return 'low';
  if (input.memoryGb !== null && input.memoryGb <= 2) return 'low';
  if (input.cores <= 4) return 'medium';
  if (input.memoryGb !== null && input.memoryGb <= 4) return 'medium';
  return 'high';
}

export function particleBudget(tier: PerformanceTier): number {
  if (tier === 'high') return 8000;
  if (tier === 'medium') return 3600;
  return 1400;
}

export function renderScale(tier: PerformanceTier): number {
  if (tier === 'high') return 1.5;
  if (tier === 'medium') return 1.25;
  return 1;
}
