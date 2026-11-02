import { describe, expect, it } from 'vitest';
import { profileById } from '@physical-os/professional-profiles';
import { checkCompatibility, simulateProfile, starterTemplate, validateProfilePackage, validateTools } from './index.js';

describe('profile sdk', () => {
  it('validates a starter template and rejects the next schema', () => {
    const template = starterTemplate({ industry: 'workshop', profession: 'maker', specialization: 'bench' });
    expect(validateProfilePackage(template).ok).toBe(true);
    expect(checkCompatibility(2).compatible).toBe(false);
    expect(validateTools(template)).toEqual([]);
  });

  it('simulates the concierge without installing a server', () => {
    const manifest = profileById('hospitality.concierge');
    if (!manifest) throw new Error('missing profile');
    const plan = simulateProfile(manifest, 'What time is breakfast?', new Date('2026-11-01T18:00:00.000Z'));
    expect(plan.text.en).toContain('7:00');
    expect(plan.proposal).toBeNull();
  });
});
