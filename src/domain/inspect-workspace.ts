import { basename, join, relative, resolve } from 'node:path';
import {
  listDirectory,
  shouldIgnoreDirectory
} from '../tools/repository/repository-tools.ts';
import type {
  HelmChartSummary,
  PulumiProjectSummary,
  WorkspaceInspection
} from '../types/repository.ts';

interface ScanState {
  helmCharts: HelmChartSummary[];
  pulumiProjects: PulumiProjectSummary[];
  chartFiles: number;
  pulumiProjectFiles: number;
  pulumiStackFiles: number;
}

const ENVIRONMENT_PATTERN = /(dev|development|stage|staging|prod|production|qa|test)/gi;

function isPulumiProjectFile(fileName: string): boolean {
  return fileName === 'Pulumi.yaml' || fileName === 'Pulumi.yml';
}

function isPulumiStackFile(fileName: string): boolean {
  return /^Pulumi\..+\.(yaml|yml)$/i.test(fileName);
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

function buildHelmChartSummary(dirPath: string, entryNames: Set<string>, workspaceRoot: string): HelmChartSummary | null {
  if (!entryNames.has('Chart.yaml')) {
    return null;
  }

  const chartName = basename(dirPath);

  return {
    chartRoot: relative(workspaceRoot, dirPath) || '.',
    chartName,
    hasValuesFile: entryNames.has('values.yaml'),
    hasTemplatesDir: entryNames.has('templates'),
    environmentHints: extractEnvironmentHints([chartName, relative(workspaceRoot, dirPath) || '.'])
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
    stackFiles,
    stackNames,
    environmentHints: extractEnvironmentHints([relative(workspaceRoot, dirPath) || '.', ...stackNames])
  };
}

async function scanDirectory(currentDir: string, workspaceRoot: string, state: ScanState): Promise<void> {
  const entries = await listDirectory(currentDir);
  const entryNames = entries.map(entry => entry.name);
  const entryNameSet = new Set(entryNames);

  const helmChart = buildHelmChartSummary(currentDir, entryNameSet, workspaceRoot);
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
  const state: ScanState = {
    helmCharts: [],
    pulumiProjects: [],
    chartFiles: 0,
    pulumiProjectFiles: 0,
    pulumiStackFiles: 0
  };

  await scanDirectory(workspaceRoot, workspaceRoot, state);

  state.helmCharts.sort((left, right) => left.chartRoot.localeCompare(right.chartRoot));
  state.pulumiProjects.sort((left, right) => left.projectRoot.localeCompare(right.projectRoot));

  return {
    workspaceRoot,
    helmCharts: state.helmCharts,
    pulumiProjects: state.pulumiProjects,
    fileCounts: {
      chartFiles: state.chartFiles,
      pulumiProjectFiles: state.pulumiProjectFiles,
      pulumiStackFiles: state.pulumiStackFiles
    }
  };
}

export function looksLikeInfraWorkspace(inspection: WorkspaceInspection): boolean {
  return inspection.helmCharts.length > 0 || inspection.pulumiProjects.length > 0;
}

export function collectWorkspaceWarnings(inspection: WorkspaceInspection): string[] {
  const warnings: string[] = [];

  if (inspection.helmCharts.length === 0) {
    warnings.push('No Helm charts were detected in the workspace.');
  }

  if (inspection.pulumiProjects.length === 0) {
    warnings.push('No Pulumi projects were detected in the workspace.');
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

  return warnings;
}
