import type { EditPlanKind, FileWriteMode, FileWriteRisk } from './edit-plan.ts';
import type { ConfigSemanticsSummary } from './config-semantics.ts';
import type { ResolvedKnowledgeCacheRoot } from './knowledge.ts';
import type { ToolPermissionCategory } from '../agent/tool-permissions.ts';

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

export interface WorkspaceCuratedKnowledgeUnitsSourceConfig {
  domain: InfraDomainId;
  targetPath?: string;
  path: string;
  name?: string;
  version?: string;
}

export interface WorkspaceKnowledgeUnitArtifactSourceConfig {
  domain: InfraDomainId;
  targetPath?: string;
  path?: string;
  url?: string;
  name?: string;
  version?: string;
}

export interface WorkspaceKnowledgeUnitArtifactRegistrySourceConfig {
  domain?: InfraDomainId;
  targetPath?: string;
  path?: string;
  url?: string;
  name?: string;
  version?: string;
}

export interface WorkspaceApprovalPathRule {
  path: string;
  requiredWriteRisks: FileWriteRisk[];
}

export interface WorkspaceAgentConfig {
  profileId?: RepoProfileId;
  knowledgeCache?: {
    root?: string;
  };
  knowledgeSources?: {
    curatedUnits?: WorkspaceCuratedKnowledgeUnitsSourceConfig[];
    unitArtifacts?: WorkspaceKnowledgeUnitArtifactSourceConfig[];
    unitArtifactRegistries?: WorkspaceKnowledgeUnitArtifactRegistrySourceConfig[];
  };
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
    requiredToolCategories?: ToolPermissionCategory[];
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
  approvedToolCategories: ToolPermissionCategory[];
}

export interface ResolvedApprovalPolicy {
  requiredWriteRisks: FileWriteRisk[];
  requiredToolCategories: ToolPermissionCategory[];
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
  valuesSchemaFile: string | null;
  environmentHints: string[];
}

export interface PulumiProjectSummary {
  projectRoot: string;
  projectFile: string;
  packageFiles: string[];
  resourceTokens: PulumiResourceTokenSummary[];
  stackFiles: string[];
  stackNames: string[];
  environmentHints: string[];
}

export interface PulumiResourceTokenSummary {
  name: string;
  type: string;
  packageName: string;
  moduleName: string;
  typeName: string;
  evidence?: {
    kind: 'pulumi-nodejs';
    sourcePath: string;
    sourceLocator: string;
  };
}

export interface TerraformRootSummary {
  rootPath: string;
  tfFiles: string[];
  tfvarsFiles: string[];
  providerSchemaFiles: string[];
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
  configSemantics: ConfigSemanticsSummary[];
  knowledgeCache: ResolvedKnowledgeCacheRoot;
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
