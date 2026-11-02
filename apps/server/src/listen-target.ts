import { resolve } from 'node:path';

export interface ListenTarget {
  host: string;
  port: number;
  dataDir: string;
  origins: string[];
  secureCookie: boolean;
}

export function listenTarget(env: NodeJS.ProcessEnv, cwd: string): ListenTarget {
  const onVercel = env.VERCEL === '1';
  const origin = env.PHYSICAL_OS_ORIGIN ?? 'http://127.0.0.1:3000';
  const twin = origin.includes('127.0.0.1')
    ? origin.replace('127.0.0.1', 'localhost')
    : origin.replace('localhost', '127.0.0.1');
  const origins = twin === origin ? [origin] : [origin, twin];
  for (const name of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL', 'VERCEL_BRANCH_URL'] as const) {
    const host = env[name];
    if (host) origins.push(`https://${host}`);
  }
  const allowLan = env.PHYSICAL_OS_ALLOW_LAN === '1';
  return {
    host: onVercel ? '0.0.0.0' : allowLan ? (env.PHYSICAL_OS_BIND ?? '127.0.0.1') : '127.0.0.1',
    port: Number(env.PORT ?? env.PHYSICAL_OS_PORT ?? 4747),
    dataDir: env.PHYSICAL_OS_DATA_DIR ?? (onVercel ? '/tmp/physical-os' : resolve(cwd, 'data')),
    origins,
    secureCookie: onVercel || env.PHYSICAL_OS_COOKIE_SECURE === '1',
  };
}
