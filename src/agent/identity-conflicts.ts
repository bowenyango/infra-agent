import type { ValidationIssue } from '../types/agent.ts';

export type IdentityConflictRiskCategory =
  | 'create-before-delete-ordering'
  | 'dns-or-domain-ownership'
  | 'exclusive-identity-review'
  | 'kubernetes-object-ownership'
  | 'physical-name-ownership';

export interface RuntimeIdentityConflictSummary {
  engine: 'pulumi' | 'terraform';
  issueKind: ValidationIssue['kind'];
  conflictCode: string | null;
  conflictFamily: string | null;
  conflictLabel: string | null;
  resourceAddress: string | null;
  resourceName: string | null;
  resourceType: string | null;
  identity: Record<string, string>;
  riskCategory: IdentityConflictRiskCategory;
  reviewSteps: string[];
  suggestedAction: string | null;
  sourceCommand: string;
}

function validationIssueEngine(issue: ValidationIssue): RuntimeIdentityConflictSummary['engine'] | null {
  if (issue.kind === 'pulumi-create-before-delete-conflict') {
    return 'pulumi';
  }

  if (issue.kind === 'terraform-create-before-delete-conflict') {
    return 'terraform';
  }

  return null;
}

function collectIdentityConflictMetadata(metadata: ValidationIssue['metadata']): Record<string, string> {
  if (!metadata) {
    return {};
  }

  const identityKeys: Array<keyof NonNullable<ValidationIssue['metadata']>> = [
    'duplicateIdentity',
    'dnsNames',
    'kubernetesNames',
    'kubernetesNamespaces',
    'listenerArns',
    'listenerRulePriorities',
    'oidcProviderUrls',
    'recordTypes',
    'routeDestinations',
    'routeTableIds',
    'securityGroupIds',
    'securityGroupRulePeers'
  ];
  const identity: Record<string, string> = {};

  for (const key of identityKeys) {
    const value = metadata[key];
    if (value) {
      identity[key] = value;
    }
  }

  return identity;
}

export function formatIdentityConflictFields(identity: Record<string, string>): string {
  const entries = Object.entries(identity);
  if (entries.length === 0) {
    return 'matched provider identity';
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function isIdentityConflictRiskCategory(value: string | null | undefined): value is IdentityConflictRiskCategory {
  return value === 'create-before-delete-ordering'
    || value === 'dns-or-domain-ownership'
    || value === 'exclusive-identity-review'
    || value === 'kubernetes-object-ownership'
    || value === 'physical-name-ownership';
}

function categorizeIdentityConflict(conflictFamily: string | null | undefined): IdentityConflictRiskCategory {
  switch (conflictFamily) {
    case 'aws-cloudfront-alias':
    case 'aws-api-gateway-domain-name':
    case 'aws-route53-record':
      return 'dns-or-domain-ownership';
    case 'aws-route':
    case 'aws-lb-listener-rule':
    case 'aws-security-group-rule':
    case 'aws-vpc-security-group-rule':
      return 'create-before-delete-ordering';
    case 'aws-iam-oidc-provider':
    case 'aws-s3-bucket':
    case 'aws-named-resource':
      return 'physical-name-ownership';
    case 'kubernetes-namespaced-object':
    case 'kubernetes-namespace':
      return 'kubernetes-object-ownership';
    default:
      return 'exclusive-identity-review';
  }
}

export function normalizeIdentityConflictRiskCategory(
  riskCategory: string | null | undefined,
  conflictFamily: string | null | undefined
): IdentityConflictRiskCategory {
  return isIdentityConflictRiskCategory(riskCategory)
    ? riskCategory
    : categorizeIdentityConflict(conflictFamily);
}

function buildIdentityConflictSpecificReviewStep(metadata: ValidationIssue['metadata']): string {
  switch (metadata?.conflictFamily) {
    case 'aws-route':
      return 'Confirm route table ID, destination CIDR/prefix, and the old/new route target before deciding rename, import, or delete-before-create sequencing.';
    case 'aws-lb-listener-rule':
      return 'Confirm listener ARN and priority match the existing listener rule; choose a free priority when the old and new rules must coexist.';
    case 'aws-security-group-rule':
    case 'aws-vpc-security-group-rule':
      return 'Confirm direction, protocol, port range, security group ID, and peer; duplicate security permissions cannot coexist in the provider API.';
    case 'aws-cloudfront-alias':
      return 'Confirm alternate domain names, certificate coverage, distribution ownership, and DNS cutover before alias transfer or import.';
    case 'aws-api-gateway-domain-name':
      return 'Confirm custom domain ownership, certificate mapping, and base path mappings before import, replacement, or manual sequencing.';
    case 'aws-route53-record':
      return 'Confirm record name, type, hosted zone ownership, and whether overwrite/import or DNS cutover is the intended remediation.';
    case 'aws-iam-oidc-provider':
      return 'Confirm OIDC provider URL and account ownership before import, delete, or recreate sequencing.';
    case 'aws-s3-bucket':
      return 'Confirm physical bucket name, account ownership, region expectations, and retention/data policies before import, delete, or recreate.';
    case 'aws-named-resource':
      return 'Confirm the physical resource name, owning account/region, and service ownership before import, delete, or recreate sequencing.';
    case 'kubernetes-namespaced-object':
      return 'Confirm API kind, metadata.name, metadata.namespace, and owning stack/release before alias, import, delete, or recreate sequencing.';
    case 'kubernetes-namespace':
      return 'Confirm namespace name and cluster ownership before import, delete, or recreate sequencing.';
    default:
      return 'Confirm the matched provider-exclusive identity belongs to the intended resource, module, stack, and environment.';
  }
}

function buildIdentityConflictReviewSteps(
  engine: RuntimeIdentityConflictSummary['engine'],
  issue: ValidationIssue
): string[] {
  const identity = formatIdentityConflictFields(collectIdentityConflictMetadata(issue.metadata));
  const label = issue.metadata?.conflictLabel ?? issue.metadata?.conflictFamily ?? 'provider-exclusive identity';
  const locator = engine === 'terraform'
    ? issue.metadata?.resourceAddress
    : issue.metadata?.resourceName;
  const engineLabel = engine === 'terraform' ? 'Terraform' : 'Pulumi';
  const nativeReviewCommand = engine === 'terraform' ? 'terraform plan' : 'pulumi preview';

  return [
    locator
      ? `Review ${engineLabel} locator ${locator} against existing state/stack ownership.`
      : `Review the native ${engineLabel} state/preview output to find the resource that owns the ${label} identity.`,
    `${buildIdentityConflictSpecificReviewStep(issue.metadata)} Matched identity: ${identity}.`,
    engine === 'terraform'
      ? 'If this is a logical rename, prefer a reviewed moved block or terraform state mv mapping before retrying plan.'
      : 'If this is a logical rename, prefer a reviewed Pulumi alias, import, or state repair before retrying preview.',
    engine === 'terraform'
      ? 'If this is a real replacement, remove create-before-destroy pressure or sequence delete/import/state repair with explicit approval.'
      : 'If this is a real replacement, use deleteBeforeReplace or manual sequencing only after downtime and ownership review.',
    `Rerun ${nativeReviewCommand} and keep apply/update blocked until the exclusive identity conflict is gone.`
  ];
}

export function identityConflictResourceLocator(conflict: RuntimeIdentityConflictSummary): string | null {
  return conflict.engine === 'terraform' ? conflict.resourceAddress : conflict.resourceName;
}

export function collectRuntimeIdentityConflicts(
  validationIssues: ValidationIssue[],
  limit = 5
): RuntimeIdentityConflictSummary[] {
  return validationIssues
    .flatMap(issue => {
      const engine = validationIssueEngine(issue);
      if (!engine) {
        return [];
      }

      return [{
        engine,
        issueKind: issue.kind,
        conflictCode: issue.metadata?.conflictCode ?? null,
        conflictFamily: issue.metadata?.conflictFamily ?? null,
        conflictLabel: issue.metadata?.conflictLabel ?? null,
        resourceAddress: issue.metadata?.resourceAddress ?? null,
        resourceName: issue.metadata?.resourceName ?? null,
        resourceType: issue.metadata?.resourceType ?? null,
        identity: collectIdentityConflictMetadata(issue.metadata),
        riskCategory: categorizeIdentityConflict(issue.metadata?.conflictFamily),
        reviewSteps: buildIdentityConflictReviewSteps(engine, issue),
        suggestedAction: issue.metadata?.conflictSuggestedAction ?? null,
        sourceCommand: issue.sourceCommand
      }];
    })
    .slice(0, limit);
}
