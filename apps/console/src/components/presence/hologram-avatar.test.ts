import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { applyPresenceFade, type MaterialFade } from './hologram-avatar';

function fadeFrom(material: MeshStandardMaterial): MaterialFade {
  return {
    material,
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  };
}

describe('presence mesh fade', () => {
  it('dims the authored material while the presence is waking', () => {
    const material = new MeshStandardMaterial({ opacity: 1, transparent: false });
    const fade = fadeFrom(material);
    applyPresenceFade([fade], 0.4);
    expect(material.opacity).toBeCloseTo(0.4);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    applyPresenceFade([fade], 0.9);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it('restores the authored opacity, transparency, and depth write', () => {
    const hair = new MeshStandardMaterial({ opacity: 1, transparent: true, depthWrite: false, alphaTest: 0.4 });
    const fade = fadeFrom(hair);
    applyPresenceFade([fade], 0.5);
    applyPresenceFade([fade], 1);
    expect(hair.opacity).toBe(1);
    expect(hair.transparent).toBe(true);
    expect(hair.depthWrite).toBe(false);
  });
});
