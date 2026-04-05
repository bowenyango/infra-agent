import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.next',
  '.turbo'
]);

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory';
}

export async function listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
  const resolvedDirPath = resolve(dirPath);
  const entries = await readdir(resolvedDirPath, { withFileTypes: true });

  return entries.map(entry => ({
    name: entry.name,
    path: resolve(resolvedDirPath, entry.name),
    kind: entry.isDirectory() ? 'directory' : 'file'
  }));
}

export function shouldIgnoreDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name);
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(resolve(filePath), 'utf8');
}

export function isYamlPath(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return extension === '.yaml' || extension === '.yml';
}
