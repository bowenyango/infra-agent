import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const TEST_ROOT = resolve('test');

export async function listCategoryTestFiles(category) {
  const categoryDir = resolve(TEST_ROOT, category);
  const entries = await readdir(categoryDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
    .map(entry => resolve(categoryDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export async function runCategory(category) {
  const files = await listCategoryTestFiles(category);

  for (const file of files) {
    await import(pathToFileURL(file).href);
  }
}
