import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 14;

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return { hash: derived.toString('hex'), salt };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function newSessionToken(): { token: string; tokenHash: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `pos_session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(secure: boolean): string {
  const parts = ['pos_session=', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
