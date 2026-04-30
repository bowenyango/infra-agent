import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InfraAgentPackageMetadata {
  packageRoot: string;
  version: string;
  nodeEngine: string | null;
  files: string[];
}

export async function readPackageMetadata(): Promise<InfraAgentPackageMetadata> {
  const currentFilePath = fileURLToPath(import.meta.url);
  const packageRoot = resolve(dirname(currentFilePath), '../..');
  const packageJsonPath = resolve(packageRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: unknown;
    engines?: {
      node?: unknown;
    };
    files?: unknown;
  };

  return {
    packageRoot,
    version: typeof packageJson.version === 'string' ? packageJson.version : 'unknown',
    nodeEngine: typeof packageJson.engines?.node === 'string' ? packageJson.engines.node : null,
    files: Array.isArray(packageJson.files)
      ? packageJson.files.filter((entry): entry is string => typeof entry === 'string')
      : []
  };
}

export async function readPackageVersion(): Promise<string> {
  return (await readPackageMetadata()).version;
}
