import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

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

export async function tryReadTextFile(filePath: string): Promise<string | null> {
  try {
    return await readTextFile(filePath);
  } catch {
    return null;
  }
}

export function isYamlPath(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return extension === '.yaml' || extension === '.yml';
}

export interface SearchWorkspaceOptions {
  rootPath: string;
  fileNamePattern?: RegExp;
  contentPattern?: RegExp;
  maxResults?: number;
}

export interface SearchWorkspaceMatch {
  path: string;
  kind: 'file_name' | 'file_content';
  line?: number;
  preview?: string;
}

async function searchDirectory(
  currentDir: string,
  options: Required<SearchWorkspaceOptions>,
  matches: SearchWorkspaceMatch[]
): Promise<void> {
  if (matches.length >= options.maxResults) {
    return;
  }

  const entries = await listDirectory(currentDir);

  for (const entry of entries) {
    if (matches.length >= options.maxResults) {
      return;
    }

    if (entry.kind === 'directory') {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      await searchDirectory(entry.path, options, matches);
      continue;
    }

    if (options.fileNamePattern && options.fileNamePattern.test(basename(entry.path))) {
      matches.push({
        path: entry.path,
        kind: 'file_name'
      });
      if (matches.length >= options.maxResults) {
        return;
      }
    }

    if (!options.contentPattern) {
      continue;
    }

    const content = await readTextFile(entry.path);
    const lines = content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!options.contentPattern.test(lines[index])) {
        continue;
      }

      matches.push({
        path: entry.path,
        kind: 'file_content',
        line: index + 1,
        preview: lines[index].trim().slice(0, 200)
      });
      break;
    }
  }
}

export async function searchWorkspace(input: SearchWorkspaceOptions): Promise<SearchWorkspaceMatch[]> {
  const options: Required<SearchWorkspaceOptions> = {
    rootPath: resolve(input.rootPath),
    fileNamePattern: input.fileNamePattern ?? /.^/,
    contentPattern: input.contentPattern ?? /.^/,
    maxResults: input.maxResults ?? 20
  };

  const hasFileNamePattern = input.fileNamePattern instanceof RegExp;
  const hasContentPattern = input.contentPattern instanceof RegExp;
  if (!hasFileNamePattern && !hasContentPattern) {
    return [];
  }

  const matches: SearchWorkspaceMatch[] = [];
  await searchDirectory(options.rootPath, options, matches);
  return matches;
}
