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
