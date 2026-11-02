import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from './app.js';

loadEnv(resolve(process.cwd(), '.env'));

const dataDir = process.env.PHYSICAL_OS_DATA_DIR ?? resolve(process.cwd(), 'data');
const allowLan = process.env.PHYSICAL_OS_ALLOW_LAN === '1';
const requested = process.env.PHYSICAL_OS_BIND ?? '127.0.0.1';
const host = allowLan ? requested : '127.0.0.1';
const port = Number(process.env.PHYSICAL_OS_PORT ?? 4747);
const origin = process.env.PHYSICAL_OS_ORIGIN ?? 'http://127.0.0.1:3000';
const origins = [
  origin,
  origin.includes('127.0.0.1') ? origin.replace('127.0.0.1', 'localhost') : origin.replace('localhost', '127.0.0.1'),
];

const { app } = await buildApp({ dataDir, logger: true, origins });
await app.listen({ host, port });
app.log.info({ host, port, lan: allowLan }, 'Physical OS API listening');

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
