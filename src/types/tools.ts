export interface DirectoryListingOutput {
  path: string;
  entries: Array<{
    name: string;
    kind: 'file' | 'directory';
  }>;
}

export interface SearchWorkspaceMatch {
  path: string;
  kind: 'file_name' | 'file_content';
  line?: number;
  preview?: string;
}

export interface SearchWorkspaceOutput {
  rootPath: string;
  matches: SearchWorkspaceMatch[];
}

export interface HelmShowValuesOutput {
  workspaceRoot: string;
  chartPath: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  content: string;
}

export interface FileReadOutput {
  path: string;
  content: string;
  truncated: boolean;
}

export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
  content: string;
}

export interface DiffPreviewOutput {
  path: string;
  exists: boolean;
  addedLines: number;
  removedLines: number;
  previousContent?: string;
  preview: string[];
}

export interface ValidationCommandOutput {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ValidationRunOutput {
  workspaceRoot: string;
  results: ValidationCommandOutput[];
}

export interface TerraformFormattedFile {
  path: string;
  content: string;
}

export interface TerraformFormatRepairOutput {
  workspaceRoot: string;
  rootPath: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  formattedFiles: TerraformFormattedFile[];
}

export interface PulumiConfigSetOutput {
  workspaceRoot: string;
  projectRoot: string;
  stackName: string;
  key: string;
  value: string;
  stackFilePath: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  content: string;
}
