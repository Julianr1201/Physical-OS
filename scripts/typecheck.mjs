import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['packages', 'apps'];
const projects = [];

for (const root of roots) {
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    projects.push(join(dir, 'tsconfig.json'));
  }
}

const tsc = join('node_modules', 'typescript', 'bin', 'tsc');
let failed = false;

for (const project of projects) {
  const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', project], {
    stdio: 'inherit',
  });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
