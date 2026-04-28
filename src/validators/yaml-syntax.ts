import { extname } from 'node:path';
import { parseAllDocuments } from 'yaml';

export interface YamlSyntaxValidationResult {
  valid: boolean;
  parser: string;
  stdout: string;
  stderr: string;
}

export function shouldValidateYamlSyntaxPath(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  if (extension !== '.yaml' && extension !== '.yml') {
    return false;
  }

  return !filePath.split(/[\\/]/).includes('templates');
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function validateYamlSyntax(content: string): Promise<YamlSyntaxValidationResult> {
  try {
    const documents = parseAllDocuments(content);
    const errors = documents.flatMap(document => document.errors ?? []);
    if (errors.length > 0) {
      return {
        valid: false,
        parser: 'yaml',
        stdout: '',
        stderr: errors.map(formatUnknownError).join('\n')
      };
    }

    return {
      valid: true,
      parser: 'yaml',
      stdout: 'YAML syntax OK',
      stderr: ''
    };
  } catch (error) {
    return {
      valid: false,
      parser: 'yaml',
      stdout: '',
      stderr: formatUnknownError(error)
    };
  }
}
