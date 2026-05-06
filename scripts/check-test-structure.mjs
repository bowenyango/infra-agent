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
const RUN_CATEGORY_PATH = 'test/run-category.mjs';
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

async function assertCategoryRunner(category, failures) {
  const runnerPath = RUNNERS[category];
  const content = await readFile(runnerPath, 'utf8');

  if (!content.includes("import { runCategory } from './run-category.mjs';")) {
    failures.push(`${runnerPath} must import the shared category runner.`);
  }

  if (!content.includes(`await runCategory('${category}');`)) {
    failures.push(`${runnerPath} must run the ${category} category through runCategory.`);
  }

  const manualShardImports = (await readRunnerImports(runnerPath))
    .filter(importPath => importPath.includes(`./${category}/`));
  for (const importPath of manualShardImports) {
    failures.push(`${runnerPath} must not manually import shard ${importPath}; use runCategory.`);
  }
}

async function main() {
  const failures = [];
  const allFiles = await listFiles(TEST_ROOT);
  const testShards = allFiles
    .map(file => normalizePath(relative(TEST_ROOT, file)))
    .filter(file => file.endsWith('.test.mjs'));

  for (const file of testShards) {
    const parts = file.split('/');
    if (parts.length === 1) {
      failures.push(`test root must not contain shard file ${file}; use test/unit, test/integration, or test/contract.`);
      continue;
    }
    if (!CATEGORY_DIRS.includes(parts[0])) {
      failures.push(`${file} must live under one of ${CATEGORY_DIRS.map(category => `test/${category}`).join(', ')}.`);
      continue;
    }
    if (parts.length > 2) {
      failures.push(`${file} is nested too deeply; category runners discover direct .test.mjs shards only.`);
    }
  }

  const runCategoryContent = await readFile(RUN_CATEGORY_PATH, 'utf8');
  if (!runCategoryContent.includes("entry.name.endsWith('.test.mjs')")) {
    failures.push(`${RUN_CATEGORY_PATH} must discover only .test.mjs shard files.`);
  }
  if (!runCategoryContent.includes('.sort(')) {
    failures.push(`${RUN_CATEGORY_PATH} must sort discovered shard files for stable execution order.`);
  }

  for (const category of CATEGORY_DIRS) {
    await assertCategoryRunner(category, failures);
  }

  const runAllContent = await readFile('test/run-all.mjs', 'utf8');
  if (!runAllContent.includes("import { runCategory } from './run-category.mjs';")) {
    failures.push('test/run-all.mjs must import the shared category runner.');
  }
  for (const category of CATEGORY_DIRS) {
    if (!runAllContent.includes(`await runCategory('${category}');`)) {
      failures.push(`test/run-all.mjs must run the ${category} category through runCategory.`);
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
