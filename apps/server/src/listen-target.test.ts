import { describe, expect, it } from 'vitest';
import { listenTarget } from './listen-target.js';

describe('listen target', () => {
  it('stays on loopback with a local data directory', () => {
    const target = listenTarget({}, 'C:/app');
    expect(target.host).toBe('127.0.0.1');
    expect(target.port).toBe(4747);
    expect(target.dataDir.replaceAll('\\', '/')).toBe('C:/app/data');
    expect(target.secureCookie).toBe(false);
    expect(target.origins).toEqual(['http://127.0.0.1:3000', 'http://localhost:3000']);
  });

  it('follows the platform port and deployment origin on Vercel', () => {
    const target = listenTarget(
      {
        VERCEL: '1',
        PORT: '3000',
        VERCEL_URL: 'physical-os-abc.vercel.app',
        VERCEL_PROJECT_PRODUCTION_URL: 'physical-os.vercel.app',
      },
      'C:/app',
    );
    expect(target.host).toBe('0.0.0.0');
    expect(target.port).toBe(3000);
    expect(target.dataDir).toBe('/tmp/physical-os');
    expect(target.secureCookie).toBe(true);
    expect(target.origins).toContain('https://physical-os.vercel.app');
    expect(target.origins).toContain('https://physical-os-abc.vercel.app');
  });
});
