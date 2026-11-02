import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ProfileManifest } from '@physical-os/professional-profiles';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function signManifest(manifest: ProfileManifest, key: string): string {
  return createHmac('sha256', key).update(canonical(manifest)).digest('hex');
}

export function verifyManifest(manifest: ProfileManifest, signature: string, key: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = signManifest(manifest, key);
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}
