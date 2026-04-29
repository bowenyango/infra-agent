import type {
  RunPreflightState,
  TargetCandidate,
  WorkspaceInspection
} from '../types/repository.ts';
import { inferRequestedDomains } from './domain-focus.ts';

const ENVIRONMENT_KEYWORDS = ['dev', 'development', 'stage', 'staging', 'prod', 'production', 'qa', 'test'] as const;
const DOMAIN_KEYWORDS = [
  'helm',
  'chart',
  'pulumi',
  'stack',
  'terraform',
  'tf',
  'tfvars',
  'module',
  'variable',
  'variables',
  'service',
  'deployment',
  'ingress',
  'redis',
  'probe',
  'probes',
  'readiness',
  'liveness',
  'health',
  'healthcheck'
] as const;

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function tokenizeTask(task: string): string[] {
  return task
    .toLowerCase()
    .split(/[^a-z0-9-_.]+/i)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

export function detectRequestedEnvironment(task: string): string | null {
  const tokens = new Set(tokenizeTask(task));

  for (const keyword of ENVIRONMENT_KEYWORDS) {
    if (tokens.has(keyword)) {
      return keyword;
    }
  }

  return null;
}

export function detectRequestedService(task: string): string | null {
  const tokens = tokenizeTask(task);
  const ignoredTokens = new Set<string>([
    ...ENVIRONMENT_KEYWORDS,
    ...DOMAIN_KEYWORDS,
    'to',
    'for',
    'add',
    'update',
    'create',
    'and',
    'with',
    'image',
    'tag',
    'tags',
    'version',
    'config',
    'configs',
    'value',
    'values'
  ]);

  for (const token of tokens) {
    if (!ignoredTokens.has(token) && /[a-z]/.test(token)) {
      return token;
    }
  }

  return null;
}

function buildCandidateDetails(params: {
  candidateKind: 'helm-chart' | 'pulumi-project' | 'terraform-root';
  tfvarsFiles?: string[];
  providerSchemaFiles?: string[];
  moduleHints?: string[];
}): string[] {
  if (params.candidateKind !== 'terraform-root') {
    return [];
  }

  const details: string[] = [];
  if (params.tfvarsFiles && params.tfvarsFiles.length > 0) {
    details.push(`tfvars: ${params.tfvarsFiles.join(', ')}`);
  }

  if (params.providerSchemaFiles && params.providerSchemaFiles.length > 0) {
    details.push(`provider schema: ${params.providerSchemaFiles.join(', ')}`);
  }

  if (params.moduleHints && params.moduleHints.length > 0) {
    details.push(`module hints: ${params.moduleHints.join(', ')}`);
  }

  return details;
}

function domainIdForCandidate(kind: TargetCandidate['kind']): 'helm' | 'pulumi' | 'terraform' {
  switch (kind) {
    case 'helm-chart':
      return 'helm';
    case 'pulumi-project':
      return 'pulumi';
    case 'terraform-root':
      return 'terraform';
  }
}

function scoreCandidate(params: {
  task: string;
  candidateKind: 'helm-chart' | 'pulumi-project' | 'terraform-root';
  candidateName: string;
  candidatePath: string;
  candidateEnvironmentHints: string[];
  candidateHintTokens?: string[];
  profileId: WorkspaceInspection['profile']['id'];
  requestedService: string | null;
  requestedEnvironment: string | null;
}): { score: number; reasons: string[]; matchedEnvironmentHints: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const matchedEnvironmentHints: string[] = [];
  const normalizedName = normalizeToken(params.candidateName);
  const normalizedPath = normalizeToken(params.candidatePath);
  const taskMentionsAppLevelHelm = /\b(ingress|probe|probes|readiness|liveness|health|healthcheck)\b/i.test(params.task);

  if (params.requestedService) {
    const normalizedService = normalizeToken(params.requestedService);
    if (normalizedName.includes(normalizedService)) {
      score += 6;
      reasons.push(`name matched service token "${params.requestedService}"`);
    } else if (normalizedPath.includes(normalizedService)) {
      score += 4;
      reasons.push(`path matched service token "${params.requestedService}"`);
    } else if (params.candidateHintTokens?.some(token => normalizeToken(token).includes(normalizedService))) {
      score += 5;
      reasons.push(`repository hints matched service token "${params.requestedService}"`);
    }
  }

  if (params.requestedEnvironment) {
    const normalizedEnvironment = normalizeToken(params.requestedEnvironment);
    const acceptedEnvironmentHints = new Set<string>([normalizedEnvironment]);

    if (params.profileId === 'scrawlr-infra-cloud') {
      if (['dev', 'development', 'stage', 'staging', 'qa', 'test'].includes(normalizedEnvironment)) {
        acceptedEnvironmentHints.add('non-prod');
      }

      if (['prod', 'production'].includes(normalizedEnvironment)) {
        acceptedEnvironmentHints.add('prod');
      }
    }

    for (const hint of params.candidateEnvironmentHints) {
      if (acceptedEnvironmentHints.has(normalizeToken(hint))) {
        score += 5;
        matchedEnvironmentHints.push(hint);
      }
    }

    if (matchedEnvironmentHints.length > 0) {
      reasons.push(`environment matched ${matchedEnvironmentHints.join(', ')}`);
    }
  }

  const taskMentionsHelm = /\b(chart|helm|ingress|probe|probes|readiness|liveness)\b/i.test(params.task);
  const taskMentionsPulumi = /\b(stack|pulumi)\b/i.test(params.task);
  const taskMentionsTerraform = /\b(terraform|tfvars|module|variable|variables)\b/i.test(params.task);

  if (params.profileId === 'scrawlr-infra-apps' && params.candidateKind === 'helm-chart') {
    score += 3;
    reasons.push('workspace profile prefers Helm chart targets');

    if (!params.requestedService && taskMentionsAppLevelHelm) {
      if (normalizedPath.startsWith('charts/apps/')) {
        score += 4;
        reasons.push('app-level Helm task without explicit service prefers charts/apps');
      }

      if (normalizedPath.startsWith('charts/infra/')) {
        score -= 2;
        reasons.push('app-level Helm task without explicit service deprioritizes charts/infra');
      }
    }
  }

  if (params.profileId === 'scrawlr-infra-cloud' && params.candidateKind === 'pulumi-project') {
    score += 3;
    reasons.push('workspace profile prefers Pulumi project targets');
  }

  if (taskMentionsHelm && params.candidateKind === 'helm-chart') {
    score += 3;
    reasons.push('task vocabulary prefers Helm chart targets');
  }

  if (taskMentionsPulumi && params.candidateKind === 'pulumi-project') {
    score += 3;
    reasons.push('task vocabulary prefers Pulumi project targets');
  }

  if (taskMentionsTerraform && params.candidateKind === 'terraform-root') {
    score += 3;
    reasons.push('task vocabulary prefers Terraform root targets');
  }

  return {
    score,
    reasons,
    matchedEnvironmentHints
  };
}

export function buildTargetCandidates(task: string, inspection: WorkspaceInspection): {
  requestedEnvironment: string | null;
  requestedService: string | null;
  targetCandidates: TargetCandidate[];
} {
  const requestedEnvironment = detectRequestedEnvironment(task);
  const requestedService = detectRequestedService(task);
  const requestedDomains = inferRequestedDomains(task, inspection.domainCapabilities);
  const targetCandidates: TargetCandidate[] = [];

  for (const chart of inspection.helmCharts) {
    const scored = scoreCandidate({
      task,
      candidateKind: 'helm-chart',
      candidateName: chart.chartName,
      candidatePath: chart.chartRoot,
      candidateEnvironmentHints: chart.environmentHints,
      candidateHintTokens: [],
      profileId: inspection.profile.id,
      requestedService,
      requestedEnvironment
    });

    targetCandidates.push({
      kind: 'helm-chart',
      name: chart.chartName,
      path: chart.chartRoot,
      score: scored.score,
      reasons: scored.reasons,
      matchedEnvironmentHints: scored.matchedEnvironmentHints,
      details: []
    });
  }

  for (const project of inspection.pulumiProjects) {
    const scored = scoreCandidate({
      task,
      candidateKind: 'pulumi-project',
      candidateName: project.projectRoot,
      candidatePath: project.projectRoot,
      candidateEnvironmentHints: project.environmentHints,
      candidateHintTokens: [],
      profileId: inspection.profile.id,
      requestedService,
      requestedEnvironment
    });

    targetCandidates.push({
      kind: 'pulumi-project',
      name: project.projectRoot,
      path: project.projectRoot,
      score: scored.score,
      reasons: scored.reasons,
      matchedEnvironmentHints: scored.matchedEnvironmentHints,
      details: []
    });
  }

  for (const root of inspection.terraformRoots) {
    const scored = scoreCandidate({
      task,
      candidateKind: 'terraform-root',
      candidateName: root.rootPath,
      candidatePath: root.rootPath,
      candidateEnvironmentHints: root.environmentHints,
      candidateHintTokens: [...root.moduleHints, ...root.tfvarsFiles],
      profileId: inspection.profile.id,
      requestedService,
      requestedEnvironment
    });

    targetCandidates.push({
      kind: 'terraform-root',
      name: root.rootPath,
      path: root.rootPath,
      score: scored.score,
      reasons: scored.reasons,
      matchedEnvironmentHints: scored.matchedEnvironmentHints,
      details: buildCandidateDetails({
        candidateKind: 'terraform-root',
        tfvarsFiles: root.tfvarsFiles,
        providerSchemaFiles: root.providerSchemaFiles,
        moduleHints: root.moduleHints
      })
    });
  }

  targetCandidates.sort((left, right) => {
    const leftDomainRank = requestedDomains.indexOf(domainIdForCandidate(left.kind));
    const rightDomainRank = requestedDomains.indexOf(domainIdForCandidate(right.kind));
    const normalizedLeftRank = leftDomainRank === -1 ? Number.MAX_SAFE_INTEGER : leftDomainRank;
    const normalizedRightRank = rightDomainRank === -1 ? Number.MAX_SAFE_INTEGER : rightDomainRank;

    return normalizedLeftRank - normalizedRightRank
      || right.score - left.score
      || left.path.localeCompare(right.path);
  });

  return {
    requestedEnvironment,
    requestedService,
    targetCandidates
  };
}

export function buildTargetingWarnings(state: Pick<RunPreflightState, 'requestedEnvironment' | 'requestedService' | 'targetCandidates'>): string[] {
  const warnings: string[] = [];

  if (!state.requestedEnvironment) {
    warnings.push('Target environment was not explicitly detected in the task.');
  }

  if (!state.requestedService) {
    warnings.push('Target service or chart was not explicitly detected in the task.');
  }

  if (state.targetCandidates.length === 0) {
    warnings.push('No workspace targets were detected for the task.');
  } else if (state.targetCandidates[0]?.score === 0) {
    warnings.push('Task did not strongly match any detected Helm chart, Pulumi project, or Terraform root.');
  }

  const topCandidate = state.targetCandidates[0];
  if (topCandidate?.kind === 'terraform-root') {
    const topTerraformCandidates = state.targetCandidates.filter(candidate =>
      candidate.kind === 'terraform-root' && candidate.score === topCandidate.score && candidate.score > 0
    );

    if (topTerraformCandidates.length > 1) {
      warnings.push(
        `Multiple Terraform roots matched with similar confidence: ${topTerraformCandidates.map(candidate => candidate.path).join(', ')}.`
      );
    }

    if (!state.requestedEnvironment) {
      const tfvarsDetail = topCandidate.details.find(detail => detail.startsWith('tfvars: '));
      if (tfvarsDetail) {
        warnings.push(`Terraform environment was not explicit; top candidate offers ${tfvarsDetail.slice('tfvars: '.length)}.`);
      }
    }
  }

  return warnings;
}
