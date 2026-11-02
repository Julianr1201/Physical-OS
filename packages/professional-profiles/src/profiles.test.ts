import { describe, expect, it } from 'vitest';
import { parseManifest, profileById, starterProfiles } from './index.js';

describe('professional profile catalog', () => {
  it('ships the concierge, the sales advisor, and the tutor as installable manifests', () => {
    const ids = starterProfiles().map((item) => item.profileId);
    expect(ids).toContain('hospitality.concierge');
    expect(ids).toContain('commerce.sales-advisor');
    expect(ids).toContain('education.tutor');
    expect(new Set(ids).size).toBe(ids.length);
    const tutor = profileById('education.tutor');
    expect(tutor?.industry).toBe('education');
    expect(tutor?.presencePreset).not.toBe(tutor?.profileId);
    expect(tutor?.disclosure.en).toMatch(/AI professional/);
  });

  it('accepts a profession that is not in the starter list', () => {
    const custom = parseManifest({
      ...profileById('personal.home-host'),
      profileId: 'workshop.maker',
      industry: 'workshop',
      profession: 'maker',
      specialization: 'bench',
      displayName: { en: 'Bench assistant', es: 'Asistente de banco' },
    });
    expect(custom.profileId).toBe('workshop.maker');
    expect(starterProfiles().some((item) => item.profileId === 'workshop.maker')).toBe(false);
  });
});
