import type {
  HelmDeploymentLinkSummary,
  HelmChartMetadataSummary,
  InfraDomainId,
  RepoProfile
} from './repository.ts';
import type { ResolvedKnowledgeCacheRoot } from './knowledge.ts';

export type InventoryTargetKind =
  | 'helm-chart'
  | 'pulumi-project'
  | 'terraform-root';

export interface InventoryReportOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  relatedFileLimit?: number;
}

export interface InventoryFileReferences {
  primary: string[];
  related: string[];
  omittedRelatedCount: number;
}

export interface InventoryTargetBase {
  id: string;
  domain: InfraDomainId;
  kind: InventoryTargetKind;
  name: string;
  path: string;
  lookupIdentities: string[];
  environmentHints: string[];
  files: InventoryFileReferences;
  validationTargets: string[];
  semanticFactCount: number;
}

export interface HelmInventoryTarget extends InventoryTargetBase {
  domain: 'helm';
  kind: 'helm-chart';
  chartName: string;
  chartMetadata: HelmChartMetadataSummary;
  deploymentLinks: HelmDeploymentLinkSummary[];
  hasValuesFile: boolean;
  hasTemplatesDir: boolean;
  valuesSchemaFile: string | null;
}

export interface PulumiInventoryTarget extends InventoryTargetBase {
  domain: 'pulumi';
  kind: 'pulumi-project';
  projectFile: string;
  packageFileCount: number;
  stackFileCount: number;
  stackNames: string[];
  resourceTokenCount: number;
  resourcePackages: string[];
  resourceTypes: string[];
}

export interface TerraformInventoryTarget extends InventoryTargetBase {
  domain: 'terraform';
  kind: 'terraform-root';
  tfFileCount: number;
  tfvarsFileCount: number;
  providerSchemaFileCount: number;
  resourceTypeCount: number;
  dataSourceTypeCount: number;
  resourceTypes: string[];
  dataSourceTypes: string[];
  moduleHints: string[];
}

export type InventoryTarget =
  | HelmInventoryTarget
  | PulumiInventoryTarget
  | TerraformInventoryTarget;

export interface InventoryToolSummary {
  domain: InfraDomainId;
  label: string;
  detectedTargetCount: number;
  includedTargetCount: number;
  validatorCommands: string[];
}

export interface InventoryEnvironmentSummary {
  name: string;
  domains: InfraDomainId[];
  targetPaths: string[];
  targetCount: number;
}

export interface InventoryReport {
  kind: 'infra-agent.inventory';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  profile: RepoProfile;
  workspaceConfigPresent: boolean;
  filters: {
    domains: InfraDomainId[];
    targetPaths: string[];
  };
  summary: {
    totalTargetCount: number;
    includedTargetCount: number;
    omittedTargetCount: number;
    domains: InfraDomainId[];
    environmentCount: number;
    semanticFactCount: number;
  };
  tools: InventoryToolSummary[];
  environments: InventoryEnvironmentSummary[];
  targets: InventoryTarget[];
  knowledgeCache: ResolvedKnowledgeCacheRoot;
  omitted: {
    filteredTargetsByDomain: Array<{
      domain: InfraDomainId;
      count: number;
    }>;
  };
}
