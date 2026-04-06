import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FILES_TO_CHECK = [
  'README.md',
  'package.json',
  'tsconfig.json'
];

const DIRECTORY_EXTENSIONS = new Map([
  ['src', ['.ts']],
  ['scripts', ['.mjs']],
  ['test', ['.mjs']]
]);

const forbiddenPatterns = [
  {
    name: 'TypeScript parameter properties are not supported by node --experimental-strip-types',
    pattern: /constructor\s*\(\s*(?:private|public|protected)\s+(?:readonly\s+)?[A-Za-z_$][\w$]*\s*:/m
  },
  {
    name: 'Trailing whitespace is not allowed',
    pattern: /[ \t]+$/m
  },
  {
    name: 'Tab characters are not allowed',
    pattern: /\t/
  }
];

async function listFiles(directory, extensions) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(resolve(directory), { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(fullPath, extensions);
      results.push(...nested);
      continue;
    }

    if (extensions.some(extension => entry.name.endsWith(extension))) {
      results.push(fullPath);
    }
  }

  return results;
}

async function gatherFiles() {
  const files = FILES_TO_CHECK.map(file => resolve(file));

  for (const [directory, extensions] of DIRECTORY_EXTENSIONS) {
    const discovered = await listFiles(directory, extensions);
    files.push(...discovered);
  }

  return files.sort();
}

async function main() {
  const files = await gatherFiles();
  const failures = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(content)) {
        failures.push(`${file}: ${rule.name}`);
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write('lint failed\n');
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`lint passed (${files.length} files checked)\n`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`lint failed: ${message}\n`);
  process.exit(1);
});
