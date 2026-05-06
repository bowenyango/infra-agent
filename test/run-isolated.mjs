import { spawn } from 'node:child_process';
import { relative } from 'node:path';
import { listCategoryTestFiles } from './run-category.mjs';

const CATEGORIES = ['unit', 'integration', 'contract'];
const requestedCategories = process.argv.slice(2);
const categories = requestedCategories.length > 0 ? requestedCategories : CATEGORIES;

for (const category of categories) {
  if (!CATEGORIES.includes(category)) {
    process.stderr.write(`unknown test category: ${category}\n`);
    process.exit(1);
  }
}

function runShard(file) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', file],
      {
        env: process.env,
        stdio: 'inherit'
      }
    );

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const reason = signal === null
        ? `exit code ${code}`
        : `signal ${signal}`;
      reject(new Error(`${relative(process.cwd(), file)} failed with ${reason}`));
    });
  });
}

let checkedCount = 0;

for (const category of categories) {
  const files = await listCategoryTestFiles(category);

  for (const file of files) {
    process.stdout.write(`isolated shard: ${relative(process.cwd(), file)}\n`);
    await runShard(file);
    checkedCount += 1;
  }
}

process.stdout.write(`isolated shard check passed (${checkedCount} files checked)\n`);
