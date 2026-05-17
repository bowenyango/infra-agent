import type {
  ChangedContextAffectedComponent,
  ChangedContextFile,
  ChangedContextFileInput,
  ChangedContextFileStatus,
  ChangedContextReport,
  ChangedContextReportOptions,
  ChangedContextRiskLevel
} from '../types/changed-context.ts';
import type {
  HelmChartSummary,
  InfraDomainId,
  PulumiProjectSummary,
  TerraformRootSummary,
  WorkspaceInspection
} from '../types/repository.ts';

type ComponentDraft = Omit<ChangedContextAffectedComponent, 'changedFiles' | 'evidence' | 'riskHints' | 'suggestedInspectFiles' | 'suggestedValidationTargets'> & {
  changedFiles: Map<string, ChangedContextFile>;
  evidence: Map<string, string>;
  riskHints: Set<string>;
  suggestedInspectFiles: Set<string>;
  suggestedValidationTargets: Set<string>;
};

const STATUS_RISK: Record<ChangedContextFileStatus, ChangedContextRiskLevel> = {
  added: 'medium',
  modified: 'low',
  deleted: 'high',
  renamed: 'medium',
  copied: 'low',
  unknown: 'low'
};

const RISK_WEIGHT: Record<ChangedContextRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '') || '.';
}

function normalizeChangedFile(input: ChangedContextFileInput): ChangedContextFile {
  const file: ChangedContextFile = {
    path: normalizePath(input.path),
    status: input.status ?? 'unknown'
  };

  if (input.previousPath) {
    file.previousPath = normalizePath(input.previousPath);
  }

  return file;
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

function fileTouchesRoot(file: ChangedContextFile, root: string): boolean {
  return pathIsWithin(file.path, root) || (file.previousPath ? pathIsWithin(file.previousPath, root) : false);
}

function fileTouchesAnyPath(file: ChangedContextFile, paths: string[]): boolean {
  return paths.some(path => file.path === path || file.previousPath === path);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function domainAllowed(domain: InfraDomainId, options: ChangedContextReportOptions): boolean {
  return !options.domains || options.domains.length === 0 || options.domains.includes(domain);
}

function targetAllowed(targetPath: string, options: ChangedContextReportOptions): boolean {
  return !options.targetPaths || options.targetPaths.length === 0 || options.targetPaths.some(path => pathsIntersect(targetPath, normalizePath(path)));
}

function addFileEvidence(draft: ComponentDraft, file: ChangedContextFile, reason: string): void {
  const key = `${file.status}:${file.previousPath ?? ''}:${file.path}`;
  draft.changedFiles.set(key, file);
  draft.evidence.set(file.previousPath ? `${file.previousPath}->${file.path}` : file.path, reason);
}

function addStatusRiskHints(draft: ComponentDraft, file: ChangedContextFile): void {
  if (file.status === 'deleted') {
    draft.riskHints.add('deleted infrastructure context file');
  } else if (file.status === 'renamed') {
    draft.riskHints.add('renamed infrastructure context file');
  } else if (file.status === 'added') {
    draft.riskHints.add('new infrastructure context file');
  }
}

function buildHelmDraft(chart: HelmChartSummary): ComponentDraft {
  const suggestedInspectFiles = new Set<string>([`${chart.chartRoot}/Chart.yaml`]);
  if (chart.hasValuesFile) {
    suggestedInspectFiles.add(`${chart.chartRoot}/values.yaml`);
  }
  if (chart.valuesSchemaFile) {
    suggestedInspectFiles.add(chart.valuesSchemaFile);
  }

  return {
    id: `helm-chart:${chart.chartRoot}`,
    domain: 'helm',
    kind: 'helm-chart',
    name: chart.chartName,
    targetPath: chart.chartRoot,
    changedFiles: new Map(),
    suggestedInspectFiles,
    suggestedValidationTargets: new Set([chart.chartRoot]),
    riskHints: new Set(),
    evidence: new Map()
  };
}

function mapHelmChart(chart: HelmChartSummary, files: ChangedContextFile[]): ComponentDraft | null {
  const draft = buildHelmDraft(chart);

  for (const file of files) {
    if (!fileTouchesRoot(file, chart.chartRoot)) {
      continue;
    }

    addFileEvidence(draft, file, 'changed file is inside Helm chart root');
    addStatusRiskHints(draft, file);

    if (file.path.endsWith('/templates') || file.path.includes('/templates/')) {
      draft.riskHints.add('Helm template rendering should be reviewed');
    }
    if (file.path.endsWith('values.schema.json')) {
      draft.riskHints.add('Helm values schema changed');
    }
    if (file.path.endsWith('Chart.yaml') || file.path.endsWith('Chart.lock')) {
      draft.riskHints.add('Helm chart metadata or dependency changed');
    }
  }

  return draft.changedFiles.size > 0 ? draft : null;
}

function buildPulumiDraft(project: PulumiProjectSummary): ComponentDraft {
  const suggestedInspectFiles = new Set<string>([project.projectFile, ...project.packageFiles, ...project.stackFiles]);

  return {
    id: `pulumi-project:${project.projectRoot}`,
    domain: 'pulumi',
    kind: 'pulumi-project',
    name: project.projectRoot,
    targetPath: project.projectRoot,
    changedFiles: new Map(),
    suggestedInspectFiles,
    suggestedValidationTargets: new Set([project.projectRoot]),
    riskHints: new Set(),
    evidence: new Map()
  };
}

function addPulumiStackValidationTargets(draft: ComponentDraft, project: PulumiProjectSummary, file: ChangedContextFile): void {
  for (const [index, stackFile] of project.stackFiles.entries()) {
    if (file.path !== stackFile && file.previousPath !== stackFile) {
      continue;
    }

    const stackName = project.stackNames[index];
    if (stackName) {
      draft.suggestedValidationTargets.add(`${project.projectRoot}:${stackName}`);
    }
  }
}

function mapPulumiProject(project: PulumiProjectSummary, files: ChangedContextFile[]): ComponentDraft | null {
  const draft = buildPulumiDraft(project);

  for (const file of files) {
    const touchesProject = fileTouchesRoot(file, project.projectRoot);
    const touchesKnownFile = fileTouchesAnyPath(file, [project.projectFile, ...project.packageFiles, ...project.stackFiles]);
    if (!touchesProject && !touchesKnownFile) {
      continue;
    }

    addFileEvidence(draft, file, touchesKnownFile ? 'changed file matches Pulumi project evidence' : 'changed file is inside Pulumi project root');
    addPulumiStackValidationTargets(draft, project, file);
    addStatusRiskHints(draft, file);

    if (file.path === project.projectFile || file.previousPath === project.projectFile) {
      draft.riskHints.add('Pulumi project metadata changed');
    }
    if (project.stackFiles.includes(file.path) || (file.previousPath ? project.stackFiles.includes(file.previousPath) : false)) {
      draft.riskHints.add('Pulumi stack config changed');
    }
    if (project.packageFiles.includes(file.path) || (file.previousPath ? project.packageFiles.includes(file.previousPath) : false)) {
      draft.riskHints.add('Pulumi package dependencies may have changed');
    }
  }

  return draft.changedFiles.size > 0 ? draft : null;
}

function buildTerraformDraft(root: TerraformRootSummary): ComponentDraft {
  return {
    id: `terraform-root:${root.rootPath}`,
    domain: 'terraform',
    kind: 'terraform-root',
    name: root.rootPath,
    targetPath: root.rootPath,
    changedFiles: new Map(),
    suggestedInspectFiles: new Set([...root.tfFiles, ...root.tfvarsFiles, ...root.providerSchemaFiles]),
    suggestedValidationTargets: new Set([root.rootPath]),
    riskHints: new Set(),
    evidence: new Map()
  };
}

function mapTerraformRoot(root: TerraformRootSummary, files: ChangedContextFile[]): ComponentDraft | null {
  const draft = buildTerraformDraft(root);
  const knownFiles = [...root.tfFiles, ...root.tfvarsFiles, ...root.providerSchemaFiles];

  for (const file of files) {
    const touchesRoot = fileTouchesRoot(file, root.rootPath);
    const touchesKnownFile = fileTouchesAnyPath(file, knownFiles);
    if (!touchesRoot && !touchesKnownFile) {
      continue;
    }

    addFileEvidence(draft, file, touchesKnownFile ? 'changed file matches Terraform root evidence' : 'changed file is inside Terraform root');
    addStatusRiskHints(draft, file);

    if (root.tfFiles.includes(file.path) || (file.previousPath ? root.tfFiles.includes(file.previousPath) : false)) {
      draft.riskHints.add('Terraform configuration changed');
    }
    if (root.tfvarsFiles.includes(file.path) || (file.previousPath ? root.tfvarsFiles.includes(file.previousPath) : false)) {
      draft.riskHints.add('Terraform variable values changed');
    }
    if (root.providerSchemaFiles.includes(file.path) || (file.previousPath ? root.providerSchemaFiles.includes(file.previousPath) : false)) {
      draft.riskHints.add('Terraform provider schema evidence changed');
    }
  }

  return draft.changedFiles.size > 0 ? draft : null;
}

function finalizeDraft(draft: ComponentDraft): ChangedContextAffectedComponent {
  const changedFiles = Array.from(draft.changedFiles.values()).sort(compareChangedFiles);
  const evidence = Array.from(draft.evidence.entries())
    .map(([path, reason]) => ({ path, reason }))
    .sort((left, right) => left.path.localeCompare(right.path) || left.reason.localeCompare(right.reason));

  return {
    id: draft.id,
    domain: draft.domain,
    kind: draft.kind,
    name: draft.name,
    targetPath: draft.targetPath,
    changedFiles,
    suggestedInspectFiles: uniqueSorted(draft.suggestedInspectFiles),
    suggestedValidationTargets: uniqueSorted(draft.suggestedValidationTargets),
    riskHints: uniqueSorted(draft.riskHints),
    evidence
  };
}

function compareChangedFiles(left: ChangedContextFile, right: ChangedContextFile): number {
  return left.path.localeCompare(right.path)
    || (left.previousPath ?? '').localeCompare(right.previousPath ?? '')
    || left.status.localeCompare(right.status);
}

function componentRisk(component: ChangedContextAffectedComponent): ChangedContextRiskLevel {
  let riskLevel: ChangedContextRiskLevel = 'none';

  for (const file of component.changedFiles) {
    if (RISK_WEIGHT[STATUS_RISK[file.status]] > RISK_WEIGHT[riskLevel]) {
      riskLevel = STATUS_RISK[file.status];
    }
  }

  if (component.riskHints.some(hint =>
    hint.includes('Terraform configuration')
    || hint.includes('Pulumi stack config')
    || hint.includes('Helm template')
    || hint.includes('metadata or dependency')
  ) && RISK_WEIGHT[riskLevel] < RISK_WEIGHT.medium) {
    return 'medium';
  }

  return riskLevel;
}

function summarizeRisk(components: ChangedContextAffectedComponent[], unmappedFiles: ChangedContextFile[]): ChangedContextRiskLevel {
  let riskLevel: ChangedContextRiskLevel = components.length > 0 || unmappedFiles.length > 0 ? 'low' : 'none';

  for (const component of components) {
    const risk = componentRisk(component);
    if (RISK_WEIGHT[risk] > RISK_WEIGHT[riskLevel]) {
      riskLevel = risk;
    }
  }

  for (const file of unmappedFiles) {
    const risk = STATUS_RISK[file.status];
    if (RISK_WEIGHT[risk] > RISK_WEIGHT[riskLevel]) {
      riskLevel = risk;
    }
  }

  return riskLevel;
}

function recommendedAction(
  riskLevel: ChangedContextRiskLevel,
  affectedComponentCount: number,
  changedFileCount: number
): ChangedContextReport['summary']['recommendedAction'] {
  if (changedFileCount === 0) {
    return 'none';
  }
  if (riskLevel === 'high' || riskLevel === 'medium') {
    return 'review-before-validation';
  }
  if (affectedComponentCount > 0) {
    return 'inspect-affected-components';
  }
  return 'inspect-changed-files';
}

function collectAffectedComponents(
  inspection: WorkspaceInspection,
  files: ChangedContextFile[],
  options: ChangedContextReportOptions
): ChangedContextAffectedComponent[] {
  const drafts: ComponentDraft[] = [];

  if (domainAllowed('helm', options)) {
    for (const chart of inspection.helmCharts) {
      if (!targetAllowed(chart.chartRoot, options)) {
        continue;
      }
      const draft = mapHelmChart(chart, files);
      if (draft) {
        drafts.push(draft);
      }
    }
  }

  if (domainAllowed('pulumi', options)) {
    for (const project of inspection.pulumiProjects) {
      if (!targetAllowed(project.projectRoot, options)) {
        continue;
      }
      const draft = mapPulumiProject(project, files);
      if (draft) {
        drafts.push(draft);
      }
    }
  }

  if (domainAllowed('terraform', options)) {
    for (const root of inspection.terraformRoots) {
      if (!targetAllowed(root.rootPath, options)) {
        continue;
      }
      const draft = mapTerraformRoot(root, files);
      if (draft) {
        drafts.push(draft);
      }
    }
  }

  return drafts
    .map(finalizeDraft)
    .sort((left, right) => left.domain.localeCompare(right.domain) || left.targetPath.localeCompare(right.targetPath));
}

function collectUnmappedFiles(files: ChangedContextFile[], components: ChangedContextAffectedComponent[]): ChangedContextFile[] {
  const mapped = new Set<string>();

  for (const component of components) {
    for (const file of component.changedFiles) {
      mapped.add(`${file.status}:${file.previousPath ?? ''}:${file.path}`);
    }
  }

  return files
    .filter(file => !mapped.has(`${file.status}:${file.previousPath ?? ''}:${file.path}`))
    .sort(compareChangedFiles);
}

export function buildChangedContextReport(
  inspection: WorkspaceInspection,
  options: ChangedContextReportOptions
): ChangedContextReport {
  const changedFiles = options.changedFiles
    .map(normalizeChangedFile)
    .sort(compareChangedFiles);
  const affectedComponents = collectAffectedComponents(inspection, changedFiles, options);
  const unmappedFiles = collectUnmappedFiles(changedFiles, affectedComponents);
  const domains = uniqueSorted(affectedComponents.map(component => component.domain)) as InfraDomainId[];
  const riskLevel = summarizeRisk(affectedComponents, unmappedFiles);

  return {
    kind: 'infra-agent.changed-context',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    comparison: options.comparison,
    changedFiles,
    affectedComponents,
    omitted: {
      unmappedFiles
    },
    summary: {
      changedFileCount: changedFiles.length,
      affectedComponentCount: affectedComponents.length,
      domains,
      riskLevel,
      recommendedAction: recommendedAction(riskLevel, affectedComponents.length, changedFiles.length)
    }
  };
}
