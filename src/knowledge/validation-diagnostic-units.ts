import type { AgentRuntimeState, ValidationIssue } from '../types/agent.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgePackDiagnosticUnit, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_DIAGNOSTIC_UNITS = 8;
const IDENTITY_METADATA_KEYS: Array<keyof NonNullable<ValidationIssue['metadata']>> = [
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

function isValidationDiagnosticUnit(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'diagnostic' && unit.extractionMethod === 'validation-diagnostic';
}

function issueDomain(issue: ValidationIssue): InfraDomainId | null {
  if (issue.kind.startsWith('terraform-') || /^terraform\b/i.test(issue.sourceCommand)) {
    return 'terraform';
  }
  if (issue.kind.startsWith('pulumi-') || /^pulumi\b/i.test(issue.sourceCommand)) {
    return 'pulumi';
  }
  if (issue.kind.startsWith('helm-') || /^helm\b/i.test(issue.sourceCommand)) {
    return 'helm';
  }

  return null;
}

function diagnosticEngine(issue: ValidationIssue): KnowledgePackDiagnosticUnit['engine'] {
  const domain = issueDomain(issue);
  return domain ?? 'runtime';
}

function compactOptionalText(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || SECRET_VALUE_PATTERN.test(text)) {
    return null;
  }

  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function compactText(value: string | undefined, fallback: string): string {
  return compactOptionalText(value) ?? fallback;
}

function metadataIdentity(issue: ValidationIssue): string | null {
  const helmIdentity = helmValidationMetadataIdentity(issue);
  if (helmIdentity) {
    return helmIdentity;
  }

  const candidates = [
    issue.metadata?.resourceAddress,
    issue.metadata?.resourceType,
    issue.metadata?.missingConfigKey,
    issue.metadata?.missingVariableName,
    issue.metadata?.yamlPath,
    issue.metadata?.conflictFamily,
    issue.metadata?.conflictCode
  ];

  return candidates.find(candidate => candidate && !SECRET_VALUE_PATTERN.test(candidate)) ?? null;
}

function helmValidationMetadataIdentity(issue: ValidationIssue): string | null {
  if (!issue.metadata || Object.keys(issue.metadata).length === 0) {
    return null;
  }

  const configuredKey = compactOptionalText(issue.metadata.missingConfigKey);
  if (configuredKey) {
    return configuredKey;
  }

  if (issue.kind === 'helm-missing-service-port') {
    return 'service.port';
  }

  if (issue.kind === 'helm-missing-ingress-values') {
    return 'ingress.enabled';
  }

  return null;
}

function safeMetadataValue(
  key: keyof NonNullable<ValidationIssue['metadata']>,
  value: string | undefined
): string | null {
  if (SECRET_VALUE_PATTERN.test(key)) {
    return null;
  }

  return compactOptionalText(value);
}

function collectIdentityMetadata(issue: ValidationIssue): Record<string, string> {
  const identity: Record<string, string> = {};

  for (const key of IDENTITY_METADATA_KEYS) {
    const value = safeMetadataValue(key, issue.metadata?.[key]);
    if (value) {
      identity[key] = value;
    }
  }

  return identity;
}

function formatIdentityMetadata(identity: Record<string, string>): string {
  const entries = Object.entries(identity);
  if (entries.length === 0) {
    return 'matched provider identity';
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function sourceForIssue(issue: ValidationIssue, runtime: AgentRuntimeState): KnowledgePackSource | null {
  const sources = runtime.knowledgeFacts?.sources ?? [];
  if (sources.length === 0) {
    return null;
  }

  const domain = issueDomain(issue);
  const primaryPath = runtime.preflight.primaryTarget?.path;
  const domainSources = domain ? sources.filter(source => source.domain === domain) : sources;
  const candidateSources = domainSources.length > 0 ? domainSources : sources;

  return candidateSources.find(source => primaryPath && (
    source.targetPath === primaryPath
    || source.targetPath.startsWith(`${primaryPath}/`)
    || primaryPath.startsWith(`${source.targetPath}/`)
  ))
    ?? candidateSources[0]
    ?? null;
}

function pushReview(reviews: string[], value: string | undefined): void {
  const text = compactOptionalText(value);
  if (text && !reviews.includes(text)) {
    reviews.push(text);
  }
}

function identityConflictSpecificReview(issue: ValidationIssue): string {
  switch (issue.metadata?.conflictFamily) {
    case 'aws-route':
      return 'Confirm route table ID, destination, and old/new route target before choosing moved/import/state repair or delete-before-create sequencing.';
    case 'aws-lb-listener-rule':
      return 'Confirm listener ARN and priority ownership; choose a free priority when old and new listener rules must coexist.';
    case 'aws-security-group-rule':
    case 'aws-vpc-security-group-rule':
      return 'Confirm direction, protocol, ports, security group ID, and peer because duplicate security permissions cannot coexist.';
    case 'aws-cloudfront-alias':
      return 'Confirm CloudFront alias ownership, certificate coverage, distribution ownership, and DNS cutover before transfer or import.';
    case 'aws-api-gateway-domain-name':
      return 'Confirm API Gateway custom domain ownership, certificate mapping, and base path mappings before import or replacement.';
    case 'aws-route53-record':
      return 'Confirm DNS record name, type, hosted zone ownership, and whether overwrite/import or DNS cutover is intended.';
    case 'aws-iam-oidc-provider':
      return 'Confirm IAM OIDC provider URL, account ownership, and downstream role trust policies before import or replacement.';
    case 'aws-s3-bucket':
      return 'Confirm physical bucket name, account ownership, region, retention, and data policies before import or replacement.';
    case 'aws-named-resource':
      return 'Confirm physical name, owning account or region, and service ownership before import, delete, or recreate sequencing.';
    case 'kubernetes-namespaced-object':
      return 'Confirm Kubernetes kind, metadata.name, metadata.namespace, and owning stack or release before alias/import/delete sequencing.';
    case 'kubernetes-namespace':
      return 'Confirm namespace name and cluster ownership before import, delete, or recreate sequencing.';
    default:
      return 'Confirm the matched provider-exclusive identity belongs to the intended resource, module, stack, and environment.';
  }
}

function identityConflictReview(issue: ValidationIssue): string[] {
  if (issue.kind !== 'terraform-create-before-delete-conflict'
    && issue.kind !== 'pulumi-create-before-delete-conflict') {
    return [];
  }

  const reviews: string[] = [];
  const label = compactOptionalText(issue.metadata?.conflictLabel)
    ?? compactOptionalText(issue.metadata?.conflictFamily)
    ?? 'provider-exclusive identity';
  const locator = issue.kind === 'terraform-create-before-delete-conflict'
    ? compactOptionalText(issue.metadata?.resourceAddress)
    : compactOptionalText(issue.metadata?.resourceName);
  const identity = formatIdentityMetadata(collectIdentityMetadata(issue));

  reviews.push(locator
    ? `Review ${label} conflict at ${locator}: ${identity}.`
    : `Review ${label} conflict: ${identity}.`);
  reviews.push(identityConflictSpecificReview(issue));
  pushReview(reviews, issue.metadata?.conflictSuggestedAction);
  reviews.push(issue.kind === 'terraform-create-before-delete-conflict'
    ? 'For logical Terraform renames, prefer reviewed moved blocks, import/state review, or address-preserving edits before retrying plan.'
    : 'For logical Pulumi renames, prefer reviewed aliases, import/state review, or bounded stack config changes before retrying preview.');

  return reviews;
}

function recommendedReview(issue: ValidationIssue): string[] {
  const guidance = compactText(issue.guidance, 'Review the validation issue and the selected target before applying changes.');
  const command = compactText(
    issue.sourceCommand,
    'Rerun the selected validator after reviewing the diagnostic.'
  );
  const reviews: string[] = [];

  pushReview(reviews, guidance);
  for (const review of identityConflictReview(issue)) {
    pushReview(reviews, review);
  }
  reviews.push(`Rerun validator: ${command}`);

  return reviews.slice(0, 7);
}

function diagnosticPath(issue: ValidationIssue, source: KnowledgePackSource): string {
  return metadataIdentity(issue)
    ?? source.targetPath
    ?? issue.kind;
}

function validationIssueToDiagnosticUnit(
  issue: ValidationIssue,
  runtime: AgentRuntimeState
): KnowledgePackDiagnosticUnit | null {
  const source = sourceForIssue(issue, runtime);
  if (!source) {
    return null;
  }

  const identity = metadataIdentity(issue);
  const signature = compactText(
    identity ? `${issue.kind}:${identity}` : issue.kind,
    issue.kind
  );

  return {
    unitType: 'diagnostic',
    path: diagnosticPath(issue, source),
    summary: compactText(issue.message, `Validation classifier detected ${issue.kind}.`),
    confidence: 'medium',
    extractionMethod: 'validation-diagnostic',
    sourceId: source.id,
    sourceLocator: `validation:${issue.kind}`,
    privacyScope: 'private-run',
    engine: diagnosticEngine(issue),
    signature,
    likelyCause: compactText(issue.guidance, `Validation classifier detected ${issue.kind}.`),
    recommendedReview: recommendedReview(issue)
  };
}

export function syncValidationDiagnosticKnowledgeUnits(runtime: AgentRuntimeState): AgentRuntimeState {
  if (!runtime.knowledgeFacts) {
    return runtime;
  }

  const previousDiagnostics = runtime.knowledgeFacts.units.filter(isValidationDiagnosticUnit);
  const baseUnits = runtime.knowledgeFacts.units.filter(unit => !isValidationDiagnosticUnit(unit));
  const baseUnitCount = Math.max(0, runtime.knowledgeFacts.unitCount - previousDiagnostics.length);
  const diagnosticUnits = runtime.validationIssues
    .slice(0, MAX_DIAGNOSTIC_UNITS)
    .map(issue => validationIssueToDiagnosticUnit(issue, runtime))
    .filter((unit): unit is KnowledgePackDiagnosticUnit => unit !== null);
  const units = [...baseUnits, ...diagnosticUnits];
  const unitCount = baseUnitCount + diagnosticUnits.length;

  return {
    ...runtime,
    knowledgeFacts: {
      ...runtime.knowledgeFacts,
      unitCount,
      includedUnitCount: units.length,
      omittedUnitCount: Math.max(0, unitCount - units.length),
      units
    }
  };
}
