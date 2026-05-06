import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const TEST_ROOT = resolve('test');
const CATEGORY_DIRS = ['unit', 'integration', 'contract'];
const TEST_SHARD_MAX_LINES = 2000;
const SUPPORT_HELPER_MAX_LINES = 1000;
const RUNNERS = {
  unit: 'test/run-unit.mjs',
  integration: 'test/run-integration.mjs',
  contract: 'test/run-contract.mjs'
};
const SUPPORT_DIR = 'test/support';
const BANNED_TEST_PATTERNS = [
  {
    name: 'monolithic cli-smoke harness import',
    pattern: /cli-smoke-harness/
  }
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function normalizePath(path) {
  return path.split('\\').join('/');
}

async function readRunnerImports(runnerPath) {
  const content = await readFile(runnerPath, 'utf8');
  return [...content.matchAll(/import\s+['"](\.\/[^'"]+)['"];?/g)]
    .map(match => match[1]);
}

async function assertRunnerCoverage(category, failures) {
  const categoryDir = resolve(TEST_ROOT, category);
  const discovered = (await readdir(categoryDir))
    .filter(file => file.endsWith('.test.mjs'))
    .map(file => `./${category}/${file}`)
    .sort();
  const imports = (await readRunnerImports(RUNNERS[category])).sort();

  for (const file of discovered) {
    if (!imports.includes(file)) {
      failures.push(`${RUNNERS[category]} does not import ${file}.`);
    }
  }

  for (const imported of imports) {
    if (!discovered.includes(imported)) {
      failures.push(`${RUNNERS[category]} imports unknown shard ${imported}.`);
    }
  }

  if (new Set(imports).size !== imports.length) {
    failures.push(`${RUNNERS[category]} imports at least one shard more than once.`);
  }
}

async function main() {
  const failures = [];
  const allFiles = await listFiles(TEST_ROOT);
  const rootTestFiles = allFiles
    .map(file => normalizePath(relative(TEST_ROOT, file)))
    .filter(file => file.endsWith('.test.mjs') && !file.includes('/'));

  for (const file of rootTestFiles) {
    failures.push(`test root must not contain shard file ${file}; use test/unit, test/integration, or test/contract.`);
  }

  for (const category of CATEGORY_DIRS) {
    await assertRunnerCoverage(category, failures);
  }

  const runAllImports = await readRunnerImports('test/run-all.mjs');
  for (const requiredRunner of ['./run-unit.mjs', './run-integration.mjs', './run-contract.mjs']) {
    if (!runAllImports.includes(requiredRunner)) {
      failures.push(`test/run-all.mjs does not import ${requiredRunner}.`);
    }
  }

  for (const file of allFiles) {
    const relativePath = normalizePath(relative(process.cwd(), file));
    const content = await readFile(file, 'utf8');

    if (relativePath.endsWith('.test.mjs')) {
      const lineCount = content.split(/\r?\n/).length - (content.endsWith('\n') ? 1 : 0);
      if (lineCount > TEST_SHARD_MAX_LINES) {
        failures.push(
          `${relativePath} has ${lineCount} lines; split shards above ${TEST_SHARD_MAX_LINES} lines by behavior.`
        );
      }
    }

    if (relativePath.startsWith(`${SUPPORT_DIR}/`) && relativePath.endsWith('.mjs')) {
      const lineCount = content.split(/\r?\n/).length - (content.endsWith('\n') ? 1 : 0);
      if (lineCount > SUPPORT_HELPER_MAX_LINES) {
        failures.push(
          `${relativePath} has ${lineCount} lines; split support helpers above ${SUPPORT_HELPER_MAX_LINES} lines by fixture family.`
        );
      }
    }

    if (relativePath === `${SUPPORT_DIR}/cli-smoke-harness.mjs`) {
      failures.push('test/support/cli-smoke-harness.mjs must not be restored; use narrow support helpers and direct imports.');
    }

    for (const rule of BANNED_TEST_PATTERNS) {
      if (rule.pattern.test(content)) {
        failures.push(`${relativePath}: ${rule.name} is not allowed.`);
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write('test structure check failed\n');
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`test structure check passed (${allFiles.length} files checked)\n`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`test structure check failed: ${message}\n`);
  process.exit(1);
});
