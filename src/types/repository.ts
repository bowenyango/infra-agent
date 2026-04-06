export type RepoProfileId = 'generic' | 'scrawlr-infra-apps' | 'scrawlr-infra-cloud';

export interface RepoProfile {
  id: RepoProfileId;
  label: string;
  reasons: string[];
}

export interface WorkspaceValidationConfigEntry {
  kind: 'helm' | 'pulumi';
  target: string;
  commands: string[];
}

export interface WorkspaceAgentConfig {
  profileId?: RepoProfileId;
  writePolicy?: {
    allowedPaths?: string[];
  };
  validation?: {
    includeDefaults?: boolean;
    entries?: WorkspaceValidationConfigEntry[];
  };
}

export interface HelmChartSummary {
  chartRoot: string;
  chartName: string;
  hasValuesFile: boolean;
  hasTemplatesDir: boolean;
  environmentHints: string[];
}

export interface PulumiProjectSummary {
  projectRoot: string;
  projectFile: string;
  stackFiles: string[];
  stackNames: string[];
  environmentHints: string[];
}

export interface WorkspaceInspection {
  workspaceRoot: string;
  profile: RepoProfile;
  config: WorkspaceAgentConfig | null;
  helmCharts: HelmChartSummary[];
  pulumiProjects: PulumiProjectSummary[];
  fileCounts: {
    chartFiles: number;
    pulumiProjectFiles: number;
    pulumiStackFiles: number;
  };
}

export interface ValidatorAvailability {
  name: 'helm' | 'pulumi';
  available: boolean;
  resolvedPath: string | null;
}

export interface ValidationPlanEntry {
  kind: 'helm' | 'pulumi';
  target: string;
  commands: string[];
}

export interface ValidationPreflight {
  workspaceRoot: string;
  validators: ValidatorAvailability[];
  plan: ValidationPlanEntry[];
  usedWorkspaceConfig: boolean;
}

export interface TargetCandidate {
  kind: 'helm-chart' | 'pulumi-project';
  name: string;
  path: string;
  score: number;
  reasons: string[];
  matchedEnvironmentHints: string[];
}

export interface RunPreflightState {
  task: string;
  workspaceRoot: string;
  profile: RepoProfile;
  inspection: WorkspaceInspection;
  validation: ValidationPreflight;
  requestedEnvironment: string | null;
  requestedService: string | null;
  targetCandidates: TargetCandidate[];
  assumptions: string[];
  blockers: string[];
  nextActions: string[];
}
