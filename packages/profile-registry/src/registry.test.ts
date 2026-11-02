import { describe, expect, it } from 'vitest';
import { profileById, type ProfileManifest } from '@physical-os/professional-profiles';
import { ProfileRegistry, signManifest } from './index.js';

const now = () => new Date('2026-11-01T18:00:00.000Z');
const key = 'test-trust-key';

describe('profile registry', () => {
  it('installs a bundled profile in simulation and refuses it in production', () => {
    const simulation = new ProfileRegistry({ mode: 'simulation', trustKey: key, now });
    expect(simulation.installBundled('hospitality.concierge').trust).toBe('bundled');
    const production = new ProfileRegistry({ mode: 'production', trustKey: key, now });
    expect(() => production.installBundled('hospitality.concierge')).toThrow(/Bundled profiles/);
  });

  it('rejects a bad signature and a silent permission grant', () => {
    const registry = new ProfileRegistry({ mode: 'production', trustKey: key, now });
    const base = profileById('commerce.sales-advisor');
    if (!base) throw new Error('missing profile');
    expect(() => registry.installSigned(base, 'a'.repeat(64))).toThrow(/signature/);
    registry.installSigned(base, signManifest(base, key));
    const next: ProfileManifest = { ...base, version: '1.1.0', requiredPermissions: [...base.requiredPermissions, 'capture_payment'] };
    expect(() => registry.update(next, signManifest(next, key), [])).toThrow(/permissions/);
    const updated = registry.update(next, signManifest(next, key), ['capture_payment']);
    expect(updated.manifest.version).toBe('1.1.0');
    expect(registry.rollback(base.profileId, '1.0.0').manifest.requiredPermissions).not.toContain('capture_payment');
  });

  it('switches the active profile on the same device', () => {
    const registry = new ProfileRegistry({ mode: 'simulation', trustKey: key, now });
    registry.installBundled('hospitality.concierge');
    registry.installBundled('education.tutor');
    const concierge = profileById('hospitality.concierge');
    const tutor = profileById('education.tutor');
    if (!concierge || !tutor) throw new Error('missing profile');
    registry.activate({
      profileId: concierge.profileId,
      avatarId: 'figure-neutral',
      voicePreset: 'voice-calm',
      organizationName: 'Hotel Norte',
      deviceId: 'console',
      acceptedPermissions: concierge.requiredPermissions,
    });
    registry.activate({
      profileId: tutor.profileId,
      avatarId: 'figure-education',
      voicePreset: 'voice-calm',
      organizationName: 'Aula Sur',
      deviceId: 'console',
      acceptedPermissions: tutor.requiredPermissions,
    });
    expect(registry.resolve('console')?.manifest.profileId).toBe('education.tutor');
    expect(registry.resolve('console')?.deployment.avatarId).toBe('figure-education');
    registry.remove('education.tutor');
    expect(registry.resolve('console')).toBeNull();
  });
});
