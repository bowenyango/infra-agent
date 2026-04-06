export interface DirectoryListingOutput {
  path: string;
  entries: Array<{
    name: string;
    kind: 'file' | 'directory';
  }>;
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
