import type { HelmChartSummary, PulumiProjectSummary, RepoProfile } from '../types/repository.ts';

function isScrawlrInfraAppsChart(chart: HelmChartSummary): boolean {
  return chart.chartRoot.startsWith('charts/apps/') || chart.chartRoot.startsWith('charts/infra/');
}

function isScrawlrInfraCloudProject(project: PulumiProjectSummary): boolean {
  const stackLabels = project.stackNames.join(' ');
  return (
    project.projectRoot.length > 0 &&
    (stackLabels.includes('non-prod')
      || stackLabels.includes('prod')
      || stackLabels.includes('tenant-shared')
      || stackLabels.includes('global'))
  );
}

export function detectRepoProfile(params: {
  helmCharts: HelmChartSummary[];
  pulumiProjects: PulumiProjectSummary[];
}): RepoProfile {
  const reasons: string[] = [];

  const hasScrawlrInfraAppsLayout =
    params.helmCharts.length > 0 && params.helmCharts.every(isScrawlrInfraAppsChart);
  const hasAppTemplate = params.helmCharts.some(chart => chart.chartRoot === 'charts/apps/app-template');
  if (hasScrawlrInfraAppsLayout && hasAppTemplate) {
    reasons.push('Detected charts/apps and charts/infra Helm layout with app-template.');
    return {
      id: 'scrawlr-infra-apps',
      label: 'Scrawlr Infra Apps',
      reasons
    };
  }

  const hasScrawlrInfraCloudLayout =
    params.pulumiProjects.length > 0 && params.pulumiProjects.every(project => isScrawlrInfraCloudProject(project));
  if (hasScrawlrInfraCloudLayout) {
    reasons.push('Detected Pulumi projects with Scrawlr-style stack labels such as non-prod, prod, global, or tenant-shared.');
    return {
      id: 'scrawlr-infra-cloud',
      label: 'Scrawlr Infra Cloud',
      reasons
    };
  }

  reasons.push('No repository-specific profile matched; falling back to generic infrastructure heuristics.');
  return {
    id: 'generic',
    label: 'Generic Infrastructure Repo',
    reasons
  };
}
