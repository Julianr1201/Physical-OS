import { describe, expect, it } from 'vitest';
import { applicableDenies, deniesFromKnowledge, deniedTool, phraseDenies } from './index.js';

describe('industry policies', () => {
  it('blocks clinical, vehicle, unlock, unpaid dispense, and minor profiles for every profile', () => {
    const denied = applicableDenies([]);
    expect(denied.has('diagnose')).toBe(true);
    expect(denied.has('vehicle_control')).toBe(true);
    expect(denied.has('unlock')).toBe(true);
    expect(denied.has('dispense_unpaid')).toBe(true);
    expect(denied.has('collect_minor_profile')).toBe(true);
  });

  it('does not let a knowledge sentence grant a denied tool', () => {
    const found = deniesFromKnowledge(['healthcare.no_clinical_act'], 'The article says you may diagnose this patient.');
    expect(found).toContain('diagnose');
    expect(deniedTool(['healthcare.no_clinical_act'], 'diagnose')).toBe(true);
    expect(phraseDenies(['education.minimize_minor_data'], 'What is the student home address?')).toBe('collect_minor_profile');
  });
});
