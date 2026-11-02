import { describe, expect, it } from 'vitest';
import { loginHref, safeNext } from './safe-next';

describe('login return path', () => {
  it('returns to a local screen and drops an external address', () => {
    expect(safeNext('/profiles')).toBe('/profiles');
    expect(safeNext('https://example.com')).toBe('/');
    expect(safeNext('//example.com')).toBe('/');
    expect(safeNext('/login')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });

  it('builds a login link that remembers the screen', () => {
    expect(loginHref('/profiles')).toBe('/login?next=%2Fprofiles');
    expect(loginHref('/')).toBe('/login');
  });
});
