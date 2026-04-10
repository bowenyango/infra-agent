import type { EditPlanKind, FileWriteMode, FileWriteRisk } from './edit-plan.ts';

export type RepoProfileId = 'generic' | 'scrawlr-infra-apps' | 'scrawlr-infra-cloud';
export type InfraDomainId = 'helm' | 'pulumi' | 'terraform';

export interface RepoProfile {
  id: RepoProfileId;
  label: string;
  reasons: string[];
}

export interface DomainCapabilitySummary {
  id: InfraDomainId;
  label: string;
  detectedTargets: number;
  supportedTaskKinds: string[];
  boundedEditKinds: string[];
  validatorCommands: string[];
}

export interface WorkspaceValidationConfigEntry {
  kind: 'helm' | 'pulumi' | 'terraform';
  target: string;
  commands: string[];
}

export interface WorkspaceApprovalPathRule {
  path: string;
  requiredWriteRisks: FileWriteRisk[];
}

export interface WorkspaceAgentConfig {
  profileId?: RepoProfileId;
  writePolicy?: {
    allowedPaths?: string[];
    allowedModes?: FileWriteMode[];
  };
  editPolicy?: {
    allowedEditPlanKinds?: EditPlanKind[];
    allowedTargetPrefixes?: string[];
    allowedTargetPrefixesByKind?: Partial<Record<EditPlanKind, string[]>>;
  };
  approvalPolicy?: {
    requiredWriteRisks?: FileWriteRisk[];
    pathRules?: WorkspaceApprovalPathRule[];
  };
  validation?: {
    includeDefaults?: boolean;
    entries?: WorkspaceValidationConfigEntry[];
  };
}

export interface RunApprovalScope {
  approvedWritePaths: string[];
  approvedWriteRisks: FileWriteRisk[];
}

export interface ResolvedApprovalPolicy {
  requiredWriteRisks: FileWriteRisk[];
  pathRules: WorkspaceApprovalPathRule[];
  sources: string[];
}

export interface ResolvedEditConstraintPolicy {
  allowedEditPlanKinds: EditPlanKind[] | null;
  allowedTargetPrefixes: string[] | null;
  allowedTargetPrefixesByKind: Partial<Record<EditPlanKind, string[]>>;
  sources: string[];
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

export interface TerraformRootSummary {
  rootPath: string;
  tfFiles: string[];
  tfvarsFiles: string[];
  moduleHints: string[];
  environmentHints: string[];
}

export interface WorkspaceInspection {
  workspaceRoot: string;
  profile: RepoProfile;
  config: WorkspaceAgentConfig | null;
  domainCapabilities: DomainCapabilitySummary[];
  helmCharts: HelmChartSummary[];
  pulumiProjects: PulumiProjectSummary[];
  terraformRoots: TerraformRootSummary[];
  fileCounts: {
    chartFiles: number;
    pulumiProjectFiles: number;
    pulumiStackFiles: number;
    terraformRootFiles: number;
    terraformVariableFiles: number;
  };
}

export interface ValidatorAvailability {
  name: 'helm' | 'pulumi' | 'terraform';
  available: boolean;
  resolvedPath: string | null;
}

export interface ValidationPlanEntry {
  kind: 'helm' | 'pulumi' | 'terraform';
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
  kind: 'helm-chart' | 'pulumi-project' | 'terraform-root';
  name: string;
  path: string;
  score: number;
  reasons: string[];
  matchedEnvironmentHints: string[];
  details?: string[];
}

export interface RunPreflightState {
  task: string;
  workspaceRoot: string;
  profile: RepoProfile;
  approval: RunApprovalScope;
  effectiveApprovalPolicy: ResolvedApprovalPolicy;
  effectiveEditPolicy: ResolvedEditConstraintPolicy;
  inspection: WorkspaceInspection;
  validation: ValidationPreflight;
  requestedDomains: InfraDomainId[];
  requestedEnvironment: string | null;
  requestedService: string | null;
  targetCandidates: TargetCandidate[];
  assumptions: string[];
  blockers: string[];
  nextActions: string[];
}
