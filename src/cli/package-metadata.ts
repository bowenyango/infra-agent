import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InfraAgentPackageMetadata {
  version: string;
  nodeEngine: string | null;
}

export async function readPackageMetadata(): Promise<InfraAgentPackageMetadata> {
  const currentFilePath = fileURLToPath(import.meta.url);
  const packageJsonPath = resolve(dirname(currentFilePath), '../..', 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: unknown;
    engines?: {
      node?: unknown;
    };
  };

  return {
    version: typeof packageJson.version === 'string' ? packageJson.version : 'unknown',
    nodeEngine: typeof packageJson.engines?.node === 'string' ? packageJson.engines.node : null
  };
}

export async function readPackageVersion(): Promise<string> {
  return (await readPackageMetadata()).version;
}
