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
  inspection: WorkspaceInspection;
  validation: ValidationPreflight;
  requestedEnvironment: string | null;
  requestedService: string | null;
  targetCandidates: TargetCandidate[];
  assumptions: string[];
  blockers: string[];
  nextActions: string[];
}
