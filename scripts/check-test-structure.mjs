import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

const TEST_ROOT = resolve('test');
const CATEGORY_DIRS = ['unit', 'integration', 'contract'];
const TEST_SHARD_MAX_LINES = 1800;
const SUPPORT_HELPER_MAX_LINES = 1000;
const REPO_SCAN_IGNORED_DIRS = new Set([
  '.git',
  'node_modules'
]);
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
  },
  {
    name: 'committed focused test',
    pattern: /\b(?:test|describe)\.only\s*\(/
  },
  {
    name: 'committed skipped test',
    pattern: /\b(?:test|describe)\.skip\s*\(/
  },
  {
    name: 'committed focused test option',
    pattern: /\bonly\s*:\s*true\b/
  },
  {
    name: 'committed skipped test option',
    pattern: /\bskip\s*:\s*true\b/
  }
];

async function listFiles(directory, ignoredDirectoryNames = new Set()) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      files.push(...await listFiles(fullPath, ignoredDirectoryNames));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function normalizePath(path) {
  return path.split('\\').join('/');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedTestShardPath(relativePath) {
  const parts = normalizePath(relativePath).split('/');
  return parts.length === 3
    && parts[0] === 'test'
    && CATEGORY_DIRS.includes(parts[1])
    && parts[2].endsWith('.test.mjs');
}

function isTestLikeFile(relativePath) {
  const fileName = normalizePath(relativePath).split('/').at(-1) ?? '';
  return /\.(?:test|spec)\.[^.]+$/.test(fileName);
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

async function assertPackageScripts(failures) {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const scripts = packageJson.scripts ?? {};
  const testScript = scripts.test ?? '';
  const verifyScript = scripts.verify ?? '';
  const coverageScript = scripts['test:coverage'] ?? '';
  const packageCheckScript = scripts['package:check'] ?? '';

  if (!testScript.includes('npm run test:structure') || !testScript.includes('npm run test:all')) {
    failures.push('package.json test script must run the structure guard before all tests.');
  }

  for (const command of [
    'npm run lint',
    'npm run test:structure',
    'npm run test:unit',
    'npm run test:integration',
    'npm run test:contract',
    'npm run smoke',
    'npm run e2e',
    'npm run test:coverage',
    'npm run package:check'
  ]) {
    if (!verifyScript.includes(command)) {
      failures.push(`package.json verify script must include ${command}.`);
    }
  }
  if (verifyScript.includes('npm run test:all')) {
    failures.push('package.json verify script must run category suites explicitly for clearer CI failures.');
  }

  for (const flag of [
    '--experimental-test-coverage',
    '--test-coverage-include=',
    '--test-coverage-lines=85',
    '--test-coverage-branches=75',
    '--test-coverage-functions=90'
  ]) {
    if (!coverageScript.includes(flag)) {
      failures.push(`package.json test:coverage script must include ${flag}.`);
    }
  }

  if (!packageCheckScript.includes('npm pack --dry-run --json')) {
    failures.push('package.json package:check script must run npm pack --dry-run --json.');
  }
}

async function assertVerifyWorkflow(failures) {
  const workflowPath = '.github/workflows/verify.yml';
  const workflow = parseYaml(await readFile(workflowPath, 'utf8'));

  if (!isRecord(workflow)) {
    failures.push(`${workflowPath} must parse as a YAML object.`);
    return;
  }

  if (!isRecord(workflow.permissions) || workflow.permissions.contents !== 'read') {
    failures.push(`${workflowPath} must set read-only contents permissions.`);
  }
  if (!isRecord(workflow.concurrency) || workflow.concurrency['cancel-in-progress'] !== true) {
    failures.push(`${workflowPath} must cancel in-progress runs for the same ref.`);
  }
  if (!isRecord(workflow.jobs)) {
    failures.push(`${workflowPath} must define jobs.`);
    return;
  }

  const expectedJobs = {
    static: {
      runs: ['npm run lint', 'npm run test:structure', 'npm run package:check'],
      needs: []
    },
    unit: {
      runs: ['npm run test:unit'],
      needs: []
    },
    integration: {
      runs: ['npm run test:integration'],
      needs: []
    },
    contract: {
      runs: ['npm run test:contract'],
      needs: []
    },
    'smoke-e2e': {
      runs: ['npm run smoke', 'npm run e2e'],
      needs: ['static', 'unit', 'integration', 'contract']
    },
    coverage: {
      runs: ['npm run test:coverage'],
      needs: ['static', 'unit', 'integration', 'contract']
    }
  };

  for (const [jobName, expectation] of Object.entries(expectedJobs)) {
    const job = workflow.jobs[jobName];
    if (!isRecord(job)) {
      failures.push(`${workflowPath} must define ${jobName} job.`);
      continue;
    }

    if (job['runs-on'] !== 'ubuntu-latest') {
      failures.push(`${workflowPath} ${jobName} job must run on ubuntu-latest.`);
    }
    if (typeof job['timeout-minutes'] !== 'number' || job['timeout-minutes'] <= 0) {
      failures.push(`${workflowPath} ${jobName} job must define a positive timeout-minutes.`);
    }

    const needs = Array.isArray(job.needs)
      ? job.needs
      : typeof job.needs === 'string'
        ? [job.needs]
        : [];
    for (const need of expectation.needs) {
      if (!needs.includes(need)) {
        failures.push(`${workflowPath} ${jobName} job must depend on ${need}.`);
      }
    }

    const runCommands = Array.isArray(job.steps)
      ? job.steps
        .filter(step => isRecord(step) && typeof step.run === 'string')
        .map(step => step.run)
      : [];
    for (const command of expectation.runs) {
      if (!runCommands.includes(command)) {
        failures.push(`${workflowPath} ${jobName} job must run ${command}.`);
      }
    }
  }
}

function assertRepositoryTestFiles(allRepoFiles, failures) {
  for (const file of allRepoFiles) {
    const relativePath = normalizePath(relative(process.cwd(), file));
    if (!isTestLikeFile(relativePath)) {
      continue;
    }
    if (!isAllowedTestShardPath(relativePath)) {
      failures.push(
        `${relativePath} looks like a test file but is not a direct test/unit, test/integration, or test/contract .test.mjs shard.`
      );
    }
  }
}

async function main() {
  const failures = [];
  const allFiles = await listFiles(TEST_ROOT);
  const allRepoFiles = await listFiles(process.cwd(), REPO_SCAN_IGNORED_DIRS);
  const testShards = allFiles
    .map(file => normalizePath(relative(TEST_ROOT, file)))
    .filter(file => file.endsWith('.test.mjs'));

  assertRepositoryTestFiles(allRepoFiles, failures);

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
  await assertPackageScripts(failures);
  await assertVerifyWorkflow(failures);

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
