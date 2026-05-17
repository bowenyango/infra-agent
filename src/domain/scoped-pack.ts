import { buildInventoryReport } from './inventory.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { InventoryTarget } from '../types/inventory.ts';
import type {
  ChangedContextAffectedComponent,
  ChangedContextReport
} from '../types/changed-context.ts';
import type {
  ChangedScopedPackOptions,
  ScopedPackOptions,
  ScopedPackReport,
  ScopedPackScope,
  ScopedPackSource,
  ScopedPackTarget
} from '../types/scoped-pack.ts';

function normalizeScope(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase() || '.';
}

function pathIsWithin(path: string, root: string): boolean {
  if (root === '.') {
    return true;
  }

  return path === root || path.startsWith(`${root}/`);
}

function pathsIntersect(path: string, targetPath: string): boolean {
  return pathIsWithin(path, targetPath) || pathIsWithin(targetPath, path);
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function domainAllowed(target: InventoryTarget, domains: InfraDomainId[] | undefined): boolean {
  return !domains || domains.length === 0 || domains.includes(target.domain);
}

function targetMatchReasons(target: InventoryTarget, normalizedScope: string): string[] {
  const reasons = new Set<string>();
  const normalizedPath = normalizeScope(target.path);
  const normalizedId = normalizeScope(target.id);
  const normalizedName = normalizeScope(target.name);

  if (pathsIntersect(normalizedPath, normalizedScope)) {
    reasons.add('scope intersects target path');
  }
  if (normalizedScope === normalizedId) {
    reasons.add('scope matches target id');
  }
  if (normalizedScope === normalizedName || normalizedScope === normalizeScope(target.name.split('/').at(-1) ?? target.name)) {
    reasons.add('scope matches target name');
  }
  if (target.environmentHints.some(environment => normalizeScope(environment) === normalizedScope)) {
    reasons.add('scope matches environment hint');
  }
  if (target.kind === 'pulumi-project' && target.stackNames.some(stack => normalizeScope(stack) === normalizedScope)) {
    reasons.add('scope matches Pulumi stack name');
  }

  return Array.from(reasons).sort();
}

function scopeMatchKinds(targets: ScopedPackTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target =>
    target.matchReasons.map(reason => reason.replace(/^scope /, ''))
  ));
}

function collectSuggestedFiles(targets: ScopedPackTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => [
    ...target.files.primary,
    ...target.files.related
  ]));
}

function collectValidationTargets(targets: ScopedPackTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => target.validationTargets));
}

function collectEnvironmentHints(targets: ScopedPackTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => target.environmentHints));
}

function collectDomains(targets: ScopedPackTarget[]): InfraDomainId[] {
  const order = ['helm', 'pulumi', 'terraform'] as const satisfies readonly InfraDomainId[];
  return order.filter(domain => targets.some(target => target.domain === domain));
}

function buildScope(requestedScope: string, normalizedScope: string, targets: ScopedPackTarget[]): ScopedPackScope {
  return {
    requested: requestedScope,
    normalized: normalizedScope,
    matchKinds: scopeMatchKinds(targets)
  };
}

function buildReport(
  inspection: WorkspaceInspection,
  targets: ScopedPackTarget[],
  source: ScopedPackSource,
  requestedScope: string,
  normalizedScope: string,
  domains: InfraDomainId[] | undefined,
  filteredDomainCount: number
): ScopedPackReport {
  const suggestedFiles = collectSuggestedFiles(targets);
  const validationTargets = collectValidationTargets(targets);
  const environmentHints = collectEnvironmentHints(targets);
  const reportDomains = collectDomains(targets);

  return {
    kind: 'infra-agent.scoped-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    profile: inspection.profile,
    source,
    scope: buildScope(requestedScope, normalizedScope, targets),
    filters: {
      domains: domains ?? []
    },
    summary: {
      matchedTargetCount: targets.length,
      domains: reportDomains,
      environmentHints,
      suggestedFileCount: suggestedFiles.length,
      validationTargetCount: validationTargets.length,
      semanticFactCount: targets.reduce((sum, target) => sum + target.semanticFactCount, 0),
      recommendedAction: targets.length > 0 ? 'inspect-suggested-files' : 'narrow-scope'
    },
    targets,
    suggestedFiles,
    validationTargets,
    knowledgeCache: inspection.knowledgeCache,
    omitted: {
      unmatchedScope: targets.length === 0,
      filteredDomainCount,
      relatedFileCount: targets.reduce((sum, target) => sum + target.files.omittedRelatedCount, 0)
    }
  };
}

export function buildScopedPackReport(
  inspection: WorkspaceInspection,
  options: ScopedPackOptions
): ScopedPackReport {
  const normalizedScope = normalizeScope(options.scope);
  const inventory = buildInventoryReport(inspection);
  const candidates = inventory.targets.filter(target => domainAllowed(target, options.domains));
  const filteredDomainCount = inventory.targets.length - candidates.length;
  const targets = candidates
    .map(target => ({
      ...target,
      matchReasons: targetMatchReasons(target, normalizedScope)
    }))
    .filter((target): target is ScopedPackTarget => target.matchReasons.length > 0)
    .sort((left, right) => left.domain.localeCompare(right.domain) || left.path.localeCompare(right.path));

  return buildReport(
    inspection,
    targets,
    { kind: 'explicit-scope' },
    options.scope,
    normalizedScope,
    options.domains,
    filteredDomainCount
  );
}

function changedComponentKey(component: ChangedContextAffectedComponent): string {
  return `${component.domain}:${component.kind}:${component.targetPath}`;
}

function inventoryTargetChangedKey(target: InventoryTarget): string {
  return `${target.domain}:${target.kind}:${target.path}`;
}

export function buildChangedScopedPackReport(
  inspection: WorkspaceInspection,
  changedContext: ChangedContextReport,
  options: ChangedScopedPackOptions = {}
): ScopedPackReport {
  const inventory = buildInventoryReport(inspection);
  const candidates = inventory.targets.filter(target => domainAllowed(target, options.domains));
  const filteredDomainCount = inventory.targets.length - candidates.length;
  const componentsByKey = new Map(changedContext.affectedComponents.map(component => [
    changedComponentKey(component),
    component
  ]));
  const componentsById = new Map(changedContext.affectedComponents.map(component => [
    component.id,
    component
  ]));
  const targets = candidates
    .map(target => {
      const component = componentsById.get(target.id) ?? componentsByKey.get(inventoryTargetChangedKey(target));
      if (!component) {
        return null;
      }

      return {
        ...target,
        matchReasons: ['changed context affected component'],
        changedFiles: component.changedFiles,
        riskHints: component.riskHints
      };
    })
    .filter((target): target is ScopedPackTarget => target !== null)
    .sort((left, right) => left.domain.localeCompare(right.domain) || left.path.localeCompare(right.path));

  return buildReport(
    inspection,
    targets,
    {
      kind: 'changed-context',
      comparison: changedContext.comparison,
      changedFileCount: changedContext.summary.changedFileCount,
      affectedComponentCount: changedContext.summary.affectedComponentCount,
      unmappedFileCount: changedContext.omitted.unmappedFiles.length,
      riskLevel: changedContext.summary.riskLevel,
      recommendedAction: changedContext.summary.recommendedAction
    },
    'changed-context',
    'changed-context',
    options.domains,
    filteredDomainCount
  );
}

function markdownList(values: string[], emptyText: string): string {
  if (values.length === 0) {
    return `- ${emptyText}`;
  }

  return values.map(value => `- ${value}`).join('\n');
}

function summarizeTarget(target: ScopedPackTarget): string {
  const reasons = target.matchReasons.join('; ');
  const environments = target.environmentHints.length > 0 ? `; env=${target.environmentHints.join(', ')}` : '';
  const changed = target.changedFiles && target.changedFiles.length > 0 ? `; changed=${target.changedFiles.length}` : '';
  return `${target.domain} ${target.kind} ${target.path} (${reasons}${environments}${changed}; facts=${target.semanticFactCount})`;
}

function collectRiskHints(targets: ScopedPackTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => target.riskHints ?? []));
}

function renderSourceSummary(report: ScopedPackReport): string[] {
  if (report.source.kind === 'explicit-scope') {
    return ['Source: explicit-scope'];
  }

  return [
    'Source: changed-context',
    `Changed files: ${report.source.changedFileCount}`,
    `Affected components: ${report.source.affectedComponentCount}`,
    `Unmapped files: ${report.source.unmappedFileCount}`,
    `Changed risk: ${report.source.riskLevel}`,
    `Changed recommended action: ${report.source.recommendedAction}`
  ];
}

export function renderScopedPackMarkdown(report: ScopedPackReport): string {
  const riskHints = collectRiskHints(report.targets);
  const lines = [
    `# Context Pack: ${report.scope.requested}`,
    '',
    `Workspace: ${report.workspaceRoot}`,
    'Mutation allowed: no',
    ...renderSourceSummary(report),
    `Profile: ${report.profile.label} (${report.profile.id})`,
    `Matched targets: ${report.summary.matchedTargetCount}`,
    `Domains: ${report.summary.domains.join(', ') || 'none'}`,
    `Recommended action: ${report.summary.recommendedAction}`,
    `Knowledge cache: ${report.knowledgeCache.root} (${report.knowledgeCache.source})`,
    '',
    '## Targets',
    markdownList(report.targets.map(summarizeTarget), 'No matching infrastructure targets. Narrow the scope or check inventory.'),
    '',
    '## Suggested Files',
    markdownList(report.suggestedFiles, 'No files suggested.'),
    '',
    '## Validation Targets',
    markdownList(report.validationTargets, 'No validation targets suggested.'),
    '',
    '## Environment Hints',
    markdownList(report.summary.environmentHints, 'No environment hints detected.'),
    '',
    '## Risk Hints',
    markdownList(riskHints, 'No changed-context risk hints detected.'),
    '',
    '## Boundaries',
    '- Read-only context only.',
    '- No raw file content included.',
    '- Does not run plan, preview, apply, deploy, or state mutation commands.'
  ];

  if (report.omitted.relatedFileCount > 0 || report.omitted.filteredDomainCount > 0 || report.omitted.unmatchedScope) {
    lines.push(
      '',
      '## Omitted',
      `- Related files omitted by budget: ${report.omitted.relatedFileCount}`,
      `- Targets filtered by domain: ${report.omitted.filteredDomainCount}`,
      `- Unmatched scope: ${report.omitted.unmatchedScope ? 'yes' : 'no'}`
    );
  }

  return lines.join('\n');
}
