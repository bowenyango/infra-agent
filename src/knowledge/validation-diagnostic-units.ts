import type { AgentRuntimeState, ValidationIssue } from '../types/agent.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgePackDiagnosticUnit, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_DIAGNOSTIC_UNITS = 8;

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

function compactText(value: string | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || SECRET_VALUE_PATTERN.test(text)) {
    return fallback;
  }

  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function metadataIdentity(issue: ValidationIssue): string | null {
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

function recommendedReview(issue: ValidationIssue): string[] {
  const guidance = compactText(issue.guidance, 'Review the validation issue and the selected target before applying changes.');
  const command = compactText(
    issue.sourceCommand,
    'Rerun the selected validator after reviewing the diagnostic.'
  );

  return [
    guidance,
    `Rerun validator: ${command}`
  ];
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
