import type { InfraDomainId } from './repository.ts';

export type ChangedContextFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'unknown';

export interface ChangedContextFileInput {
  path: string;
  status?: ChangedContextFileStatus;
  previousPath?: string;
}

export interface ChangedContextComparison {
  source: 'git-diff' | 'explicit-files';
  base?: string;
  head?: string;
}

export interface ChangedContextReportOptions {
  changedFiles: ChangedContextFileInput[];
  comparison: ChangedContextComparison;
  domains?: InfraDomainId[];
  targetPaths?: string[];
}

export interface ChangedContextFile {
  path: string;
  status: ChangedContextFileStatus;
  previousPath?: string;
}

export type ChangedContextComponentKind =
  | 'helm-chart'
  | 'pulumi-project'
  | 'terraform-root';

export type ChangedContextRiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ChangedContextRecommendedAction =
  | 'none'
  | 'inspect-changed-files'
  | 'inspect-affected-components'
  | 'review-before-validation';

export interface ChangedContextEvidence {
  path: string;
  reason: string;
}

export interface ChangedContextAffectedComponent {
  id: string;
  domain: InfraDomainId;
  kind: ChangedContextComponentKind;
  name: string;
  targetPath: string;
  changedFiles: ChangedContextFile[];
  suggestedInspectFiles: string[];
  suggestedValidationTargets: string[];
  riskHints: string[];
  evidence: ChangedContextEvidence[];
}

export interface ChangedContextReport {
  kind: 'infra-agent.changed-context';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  comparison: ChangedContextComparison;
  changedFiles: ChangedContextFile[];
  affectedComponents: ChangedContextAffectedComponent[];
  omitted: {
    unmappedFiles: ChangedContextFile[];
  };
  summary: {
    changedFileCount: number;
    affectedComponentCount: number;
    domains: InfraDomainId[];
    riskLevel: ChangedContextRiskLevel;
    recommendedAction: ChangedContextRecommendedAction;
  };
}
