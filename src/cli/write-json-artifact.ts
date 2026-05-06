import { randomUUID } from 'node:crypto';
import {
  mkdir,
  rename,
  unlink,
  writeFile
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  resolve
} from 'node:path';

export async function writeJsonArtifact(
  outputPath: string,
  baseDir: string,
  payload: unknown
): Promise<string> {
  const resolvedPath = isAbsolute(outputPath)
    ? outputPath
    : resolve(baseDir, outputPath);
  const outputDir = dirname(resolvedPath);
  const tempPath = resolve(outputDir, `.${basename(resolvedPath)}.${process.pid}.${randomUUID()}.tmp`);
  let tempCreated = false;

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    tempCreated = true;
    await rename(tempPath, resolvedPath);
    tempCreated = false;
  } finally {
    if (tempCreated) {
      await unlink(tempPath).catch(() => undefined);
    }
  }

  return resolvedPath;
}
