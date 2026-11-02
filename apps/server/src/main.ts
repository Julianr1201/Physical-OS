import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import { listenTarget } from './listen-target.js';

loadEnv(resolve(process.cwd(), '.env'));
loadEnv(resolve(process.cwd(), '../../.env'));

const onVercel = process.env.VERCEL === '1';

try {
  const { buildApp } = await import('./app.js');
  const target = listenTarget(process.env, process.cwd());
  const { app } = await buildApp({
    dataDir: target.dataDir,
    logger: true,
    origins: target.origins,
    secureCookie: target.secureCookie,
  });
  app.log.info({ host: target.host, port: target.port }, 'Physical OS API listening');
  if (onVercel) {
    app.listen({ port: Number(process.env.PORT || 3000) });
  } else {
    await app.listen({ host: target.host, port: target.port });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'startup failed';
  console.error(message);
  if (!onVercel) throw error;
  const fallback = Fastify({ logger: false });
  fallback.all('*', async (_request, reply) => {
    reply.code(500).send({ error: { code: 'startup_failed', message } });
  });
  fallback.listen({ port: Number(process.env.PORT || 3000) });
}

function loadEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
