import { basename, join, relative, resolve } from 'node:path';
import {
  listDirectory,
  shouldIgnoreDirectory
} from '../tools/repository/repository-tools.ts';
import { detectRepoProfile } from './repo-profile.ts';
import { resolveDomainCapabilities } from './domain-capabilities.ts';
import { discoverArgoCdHelmApplicationLinks } from './argocd-application-linkage.ts';
import { readHelmChartMetadataSummary } from './helm-chart-context.ts';
import { extractHelmValuesSchemaSemanticsForCharts } from './helm-values-schema.ts';
import { extractPulumiStackConfigSemanticsForProjects } from './pulumi-stack-config.ts';
import { detectPulumiProjectResourceTokens } from './pulumi-resource-tokens.ts';
import {
  detectTerraformProviderSchemaFiles,
  extractTerraformProviderSchemaSemanticsForRoots
} from './terraform-provider-schema.ts';
import { detectTerraformResourceUsages } from './terraform-resource-usages.ts';
import { extractTerraformVariableSemanticsForRoots } from './terraform-variables.ts';
import { readWorkspaceConfig } from './workspace-config.ts';
import { resolveKnowledgeCacheRoot } from '../knowledge/cache-root.ts';
import type {
  HelmChartSummary,
  PulumiProjectSummary,
  TerraformRootSummary,
  WorkspaceInspection
} from '../types/repository.ts';

interface ScanState {
  helmCharts: HelmChartSummary[];
  pulumiProjects: PulumiProjectSummary[];
  terraformRoots: TerraformRootSummary[];
  chartFiles: number;
  pulumiProjectFiles: number;
  pulumiStackFiles: number;
  terraformRootFiles: number;
  terraformVariableFiles: number;
}

const ENVIRONMENT_PATTERN = /(non-prod|dev|development|stage|staging|prod|production|qa|test)/gi;

function isPulumiProjectFile(fileName: string): boolean {
  return fileName === 'Pulumi.yaml' || fileName === 'Pulumi.yml';
}

function isPulumiStackFile(fileName: string): boolean {
  return /^Pulumi\..+\.(yaml|yml)$/i.test(fileName);
}

function isPulumiPackageFile(fileName: string): boolean {
  return fileName === 'package.json';
}

function isTerraformFile(fileName: string): boolean {
  return /\.tf$/i.test(fileName);
}

function isTerraformVariableFile(fileName: string): boolean {
  return /\.tfvars(\.json)?$/i.test(fileName) || fileName === 'terraform.tfvars' || fileName === 'terraform.tfvars.json';
}

function extractEnvironmentHints(values: string[]): string[] {
  const hints = new Set<string>();

  for (const value of values) {
    const matches = value.match(ENVIRONMENT_PATTERN);
    if (!matches) {
      continue;
    }

    for (const match of matches) {
      hints.add(match.toLowerCase());
    }
  }

  return Array.from(hints).sort();
}

async function buildHelmChartSummary(dirPath: string, entryNames: Set<string>, workspaceRoot: string): Promise<HelmChartSummary | null> {
  if (!entryNames.has('Chart.yaml')) {
    return null;
  }

  const chartName = basename(dirPath);
  const chartRoot = relative(workspaceRoot, dirPath) || '.';
  const chartMetadata = await readHelmChartMetadataSummary(workspaceRoot, {
    chartRoot,
    chartName
  });

  return {
    chartRoot,
    chartName: chartMetadata.chartName,
    chartMetadata,
    deploymentLinks: [],
    hasValuesFile: entryNames.has('values.yaml'),
    hasTemplatesDir: entryNames.has('templates'),
    valuesSchemaFile: entryNames.has('values.schema.json')
      ? relative(workspaceRoot, join(dirPath, 'values.schema.json'))
      : null,
    environmentHints: extractEnvironmentHints([chartMetadata.chartName, chartRoot])
  };
}

function buildPulumiProjectSummary(
  dirPath: string,
  entryNames: string[],
  workspaceRoot: string
): PulumiProjectSummary | null {
  const projectFileName = entryNames.find(isPulumiProjectFile);
  if (!projectFileName) {
    return null;
  }

  const stackFiles = entryNames.filter(isPulumiStackFile).map(fileName => relative(workspaceRoot, join(dirPath, fileName)));
  const stackNames = stackFiles.map(filePath => {
    const fileName = filePath.split('/').at(-1) ?? filePath;
    return fileName.replace(/^Pulumi\./, '').replace(/\.(yaml|yml)$/i, '');
  });

  return {
    projectRoot: relative(workspaceRoot, dirPath) || '.',
    projectFile: relative(workspaceRoot, join(dirPath, projectFileName)),
    packageFiles: entryNames
      .filter(isPulumiPackageFile)
      .map(fileName => relative(workspaceRoot, join(dirPath, fileName))),
    resourceTokens: [],
    stackFiles,
    stackNames,
    environmentHints: extractEnvironmentHints([relative(workspaceRoot, dirPath) || '.', ...stackNames])
  };
}

function buildTerraformRootSummary(
  dirPath: string,
  entryNames: string[],
  workspaceRoot: string
): TerraformRootSummary | null {
  const tfFiles = entryNames.filter(isTerraformFile);
  if (tfFiles.length === 0) {
    return null;
  }

  const tfvarsFiles = entryNames.filter(isTerraformVariableFile);
  const moduleHints = new Set<string>();

  for (const fileName of tfFiles) {
    if (fileName === 'main.tf' || fileName === 'variables.tf' || fileName === 'outputs.tf' || fileName === 'providers.tf') {
      continue;
    }

    if (fileName.endsWith('.auto.tf')) {
      continue;
    }

    moduleHints.add(fileName.replace(/\.tf$/i, ''));
  }

  return {
    rootPath: relative(workspaceRoot, dirPath) || '.',
    tfFiles: tfFiles.map(fileName => relative(workspaceRoot, join(dirPath, fileName))),
    tfvarsFiles: tfvarsFiles.map(fileName => relative(workspaceRoot, join(dirPath, fileName))),
    providerSchemaFiles: [],
    resourceUsages: [],
    moduleHints: Array.from(moduleHints).sort(),
    environmentHints: extractEnvironmentHints([relative(workspaceRoot, dirPath) || '.', ...tfvarsFiles])
  };
}

async function scanDirectory(currentDir: string, workspaceRoot: string, state: ScanState): Promise<void> {
  const entries = await listDirectory(currentDir);
  const entryNames = entries.map(entry => entry.name);
  const entryNameSet = new Set(entryNames);

  const helmChart = await buildHelmChartSummary(currentDir, entryNameSet, workspaceRoot);
  if (helmChart) {
    state.helmCharts.push(helmChart);
    state.chartFiles += 1;
  }

  const pulumiProject = buildPulumiProjectSummary(currentDir, entryNames, workspaceRoot);
  if (pulumiProject) {
    state.pulumiProjects.push(pulumiProject);
    state.pulumiProjectFiles += 1;
    state.pulumiStackFiles += pulumiProject.stackFiles.length;
  }

  const terraformRoot = buildTerraformRootSummary(currentDir, entryNames, workspaceRoot);
  if (terraformRoot) {
    state.terraformRoots.push(terraformRoot);
    state.terraformRootFiles += 1;
    state.terraformVariableFiles += terraformRoot.tfvarsFiles.length;
  }

  for (const entry of entries) {
    if (entry.kind !== 'directory') {
      continue;
    }

    if (shouldIgnoreDirectory(entry.name)) {
      continue;
    }

    await scanDirectory(entry.path, workspaceRoot, state);
  }
}

export async function inspectWorkspace(inputPath: string): Promise<WorkspaceInspection> {
  const workspaceRoot = resolve(inputPath);
  const workspaceConfig = await readWorkspaceConfig(workspaceRoot);
  const knowledgeCache = resolveKnowledgeCacheRoot({
    workspaceRoot,
    workspaceConfig
  });
  const state: ScanState = {
    helmCharts: [],
    pulumiProjects: [],
    terraformRoots: [],
    chartFiles: 0,
    pulumiProjectFiles: 0,
    pulumiStackFiles: 0,
    terraformRootFiles: 0,
    terraformVariableFiles: 0
  };

  await scanDirectory(workspaceRoot, workspaceRoot, state);

  state.helmCharts.sort((left, right) => left.chartRoot.localeCompare(right.chartRoot));
  state.pulumiProjects.sort((left, right) => left.projectRoot.localeCompare(right.projectRoot));
  state.terraformRoots.sort((left, right) => left.rootPath.localeCompare(right.rootPath));
  const argoLinksByChartRoot = await discoverArgoCdHelmApplicationLinks(workspaceRoot, state.helmCharts);
  for (const chart of state.helmCharts) {
    chart.deploymentLinks = argoLinksByChartRoot.get(chart.chartRoot) ?? [];
  }
  for (const project of state.pulumiProjects) {
    project.resourceTokens = await detectPulumiProjectResourceTokens(workspaceRoot, project);
  }
  for (const root of state.terraformRoots) {
    root.providerSchemaFiles = await detectTerraformProviderSchemaFiles(workspaceRoot, root);
    root.resourceUsages = await detectTerraformResourceUsages(workspaceRoot, root);
  }
  const helmSemantics = await extractHelmValuesSchemaSemanticsForCharts(workspaceRoot, state.helmCharts);
  const pulumiSemantics = await extractPulumiStackConfigSemanticsForProjects(workspaceRoot, state.pulumiProjects);
  const terraformSemantics = await extractTerraformVariableSemanticsForRoots(workspaceRoot, state.terraformRoots);
  const terraformProviderSchemaSemantics = await extractTerraformProviderSchemaSemanticsForRoots(workspaceRoot, state.terraformRoots);
  const configSemantics = [...helmSemantics, ...pulumiSemantics, ...terraformSemantics, ...terraformProviderSchemaSemantics];

  return {
    workspaceRoot,
    config: workspaceConfig,
    profile: detectRepoProfile({
      workspaceConfig,
      helmCharts: state.helmCharts,
      pulumiProjects: state.pulumiProjects
    }),
    domainCapabilities: resolveDomainCapabilities({
      helmCharts: state.helmCharts,
      pulumiProjects: state.pulumiProjects,
      terraformRoots: state.terraformRoots
    }),
    knowledgeCache,
    configSemantics,
    helmCharts: state.helmCharts,
    pulumiProjects: state.pulumiProjects,
    terraformRoots: state.terraformRoots,
    fileCounts: {
      chartFiles: state.chartFiles,
      pulumiProjectFiles: state.pulumiProjectFiles,
      pulumiStackFiles: state.pulumiStackFiles,
      terraformRootFiles: state.terraformRootFiles,
      terraformVariableFiles: state.terraformVariableFiles
    }
  };
}

export function looksLikeInfraWorkspace(inspection: WorkspaceInspection): boolean {
  return inspection.helmCharts.length > 0 || inspection.pulumiProjects.length > 0 || inspection.terraformRoots.length > 0;
}

export function collectWorkspaceWarnings(inspection: WorkspaceInspection): string[] {
  const warnings: string[] = [];

  if (inspection.helmCharts.length === 0) {
    warnings.push('No Helm charts were detected in the workspace.');
  }

  if (inspection.pulumiProjects.length === 0) {
    warnings.push('No Pulumi projects were detected in the workspace.');
  }

  if (inspection.terraformRoots.length === 0) {
    warnings.push('No Terraform roots were detected in the workspace.');
  }

  for (const chart of inspection.helmCharts) {
    if (!chart.hasValuesFile) {
      warnings.push(`Helm chart ${chart.chartRoot} is missing values.yaml.`);
    }

    if (!chart.hasTemplatesDir) {
      warnings.push(`Helm chart ${chart.chartRoot} is missing templates/.`);
    }
  }

  for (const project of inspection.pulumiProjects) {
    if (project.stackFiles.length === 0) {
      warnings.push(`Pulumi project ${project.projectRoot} has no stack files.`);
    }
  }

  for (const root of inspection.terraformRoots) {
    if (root.tfvarsFiles.length === 0) {
      warnings.push(`Terraform root ${root.rootPath} has no tfvars file; bounded config updates may need to create terraform.auto.tfvars.`);
    }
  }

  return warnings;
}
