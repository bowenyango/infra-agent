import type {
  HelmChartSummary,
  InfraDomainId,
  PulumiProjectSummary,
  TerraformRootSummary,
  WorkspaceInspection
} from '../types/repository.ts';
import type {
  InventoryEnvironmentSummary,
  InventoryFileReferences,
  InventoryReport,
  InventoryReportOptions,
  InventoryTarget
} from '../types/inventory.ts';

const DEFAULT_RELATED_FILE_LIMIT = 12;
const DOMAIN_ORDER = ['helm', 'pulumi', 'terraform'] as const satisfies readonly InfraDomainId[];

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '') || '.';
}

function joinRelative(root: string, child: string): string {
  return root === '.' ? child : `${root}/${child}`;
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

function uniquePreserveOrder(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function domainAllowed(domain: InfraDomainId, options: InventoryReportOptions): boolean {
  return !options.domains || options.domains.length === 0 || options.domains.includes(domain);
}

function targetAllowed(targetPath: string, options: InventoryReportOptions): boolean {
  return !options.targetPaths
    || options.targetPaths.length === 0
    || options.targetPaths.some(path => pathsIntersect(targetPath, normalizePath(path)));
}

function countSemanticFacts(inspection: WorkspaceInspection, kind: InventoryTarget['kind'], targetPath: string): number {
  return inspection.configSemantics
    .filter(item =>
      item.targetKind === kind
      && item.targetPath === targetPath
    )
    .reduce((sum, item) => sum + item.facts.length, 0);
}

function buildFileReferences(primary: string[], related: string[], limit: number): InventoryFileReferences {
  const primaryFiles = uniquePreserveOrder(primary.map(normalizePath));
  const primarySet = new Set(primaryFiles);
  const relatedFiles = uniqueSorted(related.map(normalizePath).filter(file => !primarySet.has(file)));
  const includedRelated = relatedFiles.slice(0, limit);

  return {
    primary: primaryFiles,
    related: includedRelated,
    omittedRelatedCount: Math.max(0, relatedFiles.length - includedRelated.length)
  };
}

function buildHelmTarget(
  inspection: WorkspaceInspection,
  chart: HelmChartSummary,
  relatedFileLimit: number
): InventoryTarget {
  const primary = [
    joinRelative(chart.chartRoot, 'Chart.yaml'),
    chart.hasValuesFile ? joinRelative(chart.chartRoot, 'values.yaml') : null,
    chart.valuesSchemaFile
  ].filter((file): file is string => Boolean(file));
  const related = chart.hasTemplatesDir ? [joinRelative(chart.chartRoot, 'templates')] : [];

  return {
    id: `helm-chart:${chart.chartRoot}`,
    domain: 'helm',
    kind: 'helm-chart',
    name: chart.chartName,
    path: chart.chartRoot,
    chartName: chart.chartName,
    hasValuesFile: chart.hasValuesFile,
    hasTemplatesDir: chart.hasTemplatesDir,
    valuesSchemaFile: chart.valuesSchemaFile,
    environmentHints: [...chart.environmentHints],
    files: buildFileReferences(primary, related, relatedFileLimit),
    validationTargets: [chart.chartRoot],
    semanticFactCount: countSemanticFacts(inspection, 'helm-chart', chart.chartRoot)
  };
}

function buildPulumiTarget(
  inspection: WorkspaceInspection,
  project: PulumiProjectSummary,
  relatedFileLimit: number
): InventoryTarget {
  return {
    id: `pulumi-project:${project.projectRoot}`,
    domain: 'pulumi',
    kind: 'pulumi-project',
    name: project.projectRoot,
    path: project.projectRoot,
    projectFile: project.projectFile,
    packageFileCount: project.packageFiles.length,
    stackFileCount: project.stackFiles.length,
    stackNames: [...project.stackNames],
    resourceTokenCount: project.resourceTokens.length,
    resourcePackages: uniqueSorted(project.resourceTokens.map(token => token.packageName)),
    environmentHints: [...project.environmentHints],
    files: buildFileReferences([project.projectFile], [...project.packageFiles, ...project.stackFiles], relatedFileLimit),
    validationTargets: [project.projectRoot, ...project.stackNames.map(stack => `${project.projectRoot}:${stack}`)],
    semanticFactCount: countSemanticFacts(inspection, 'pulumi-project', project.projectRoot)
  };
}

function lastPathSegment(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function terraformPrimaryFiles(root: TerraformRootSummary): string[] {
  const priority = ['versions.tf', 'providers.tf', 'main.tf', 'variables.tf', 'outputs.tf'];
  const tfFilesByName = new Map(root.tfFiles.map(file => [lastPathSegment(file), file]));

  return priority
    .map(fileName => tfFilesByName.get(fileName))
    .filter((file): file is string => Boolean(file));
}

function buildTerraformTarget(
  inspection: WorkspaceInspection,
  root: TerraformRootSummary,
  relatedFileLimit: number
): InventoryTarget {
  const primary = terraformPrimaryFiles(root);
  const primarySet = new Set(primary);
  const related = [
    ...root.tfFiles.filter(file => !primarySet.has(file)),
    ...root.tfvarsFiles,
    ...root.providerSchemaFiles
  ];

  return {
    id: `terraform-root:${root.rootPath}`,
    domain: 'terraform',
    kind: 'terraform-root',
    name: root.rootPath,
    path: root.rootPath,
    tfFileCount: root.tfFiles.length,
    tfvarsFileCount: root.tfvarsFiles.length,
    providerSchemaFileCount: root.providerSchemaFiles.length,
    moduleHints: [...root.moduleHints],
    environmentHints: [...root.environmentHints],
    files: buildFileReferences(primary, related, relatedFileLimit),
    validationTargets: [root.rootPath],
    semanticFactCount: countSemanticFacts(inspection, 'terraform-root', root.rootPath)
  };
}

function buildAllTargets(inspection: WorkspaceInspection, relatedFileLimit: number): InventoryTarget[] {
  return [
    ...inspection.helmCharts.map(chart => buildHelmTarget(inspection, chart, relatedFileLimit)),
    ...inspection.pulumiProjects.map(project => buildPulumiTarget(inspection, project, relatedFileLimit)),
    ...inspection.terraformRoots.map(root => buildTerraformTarget(inspection, root, relatedFileLimit))
  ].sort((left, right) => left.domain.localeCompare(right.domain) || left.path.localeCompare(right.path));
}

function collectEnvironments(targets: InventoryTarget[]): InventoryEnvironmentSummary[] {
  const summaries = new Map<string, {
    domains: Set<InfraDomainId>;
    targetPaths: Set<string>;
    targetCount: number;
  }>();

  for (const target of targets) {
    for (const environment of target.environmentHints) {
      const summary = summaries.get(environment) ?? {
        domains: new Set<InfraDomainId>(),
        targetPaths: new Set<string>(),
        targetCount: 0
      };
      summary.domains.add(target.domain);
      summary.targetPaths.add(target.path);
      summary.targetCount += 1;
      summaries.set(environment, summary);
    }
  }

  return Array.from(summaries.entries())
    .map(([name, summary]) => ({
      name,
      domains: uniqueSorted(summary.domains) as InfraDomainId[],
      targetPaths: uniqueSorted(summary.targetPaths),
      targetCount: summary.targetCount
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function selectedDomains(targets: InventoryTarget[]): InfraDomainId[] {
  return DOMAIN_ORDER.filter(domain => targets.some(target => target.domain === domain));
}

function countTargetsByDomain(targets: InventoryTarget[], domain: InfraDomainId): number {
  return targets.filter(target => target.domain === domain).length;
}

export function buildInventoryReport(
  inspection: WorkspaceInspection,
  options: InventoryReportOptions = {}
): InventoryReport {
  const relatedFileLimit = options.relatedFileLimit ?? DEFAULT_RELATED_FILE_LIMIT;
  const allTargets = buildAllTargets(inspection, relatedFileLimit);
  const targets = allTargets.filter(target =>
    domainAllowed(target.domain, options)
    && targetAllowed(target.path, options)
  );
  const omittedTargets = allTargets.filter(target => !targets.includes(target));
  const domains = selectedDomains(targets);
  const environments = collectEnvironments(targets);
  const capabilityByDomain = new Map(inspection.domainCapabilities.map(capability => [capability.id, capability]));

  return {
    kind: 'infra-agent.inventory',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    profile: inspection.profile,
    workspaceConfigPresent: Boolean(inspection.config),
    filters: {
      domains: options.domains ?? [],
      targetPaths: options.targetPaths ?? []
    },
    summary: {
      totalTargetCount: allTargets.length,
      includedTargetCount: targets.length,
      omittedTargetCount: omittedTargets.length,
      domains,
      environmentCount: environments.length,
      semanticFactCount: targets.reduce((sum, target) => sum + target.semanticFactCount, 0)
    },
    tools: domains.map(domain => {
      const capability = capabilityByDomain.get(domain);
      return {
        domain,
        label: capability?.label ?? domain,
        detectedTargetCount: capability?.detectedTargets ?? countTargetsByDomain(allTargets, domain),
        includedTargetCount: countTargetsByDomain(targets, domain),
        validatorCommands: capability?.validatorCommands ?? []
      };
    }),
    environments,
    targets,
    knowledgeCache: inspection.knowledgeCache,
    omitted: {
      filteredTargetsByDomain: DOMAIN_ORDER
        .map(domain => ({
          domain,
          count: countTargetsByDomain(omittedTargets, domain)
        }))
        .filter(item => item.count > 0)
    }
  };
}
