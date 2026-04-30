#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(currentFilePath), '..');
const cliEntry = resolve(projectRoot, 'src/cli/main.ts');

const result = spawnSync(process.execPath, ['--experimental-strip-types', cliEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
