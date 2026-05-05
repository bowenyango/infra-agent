import { cwd, env as processEnv, version as nodeVersion } from 'node:process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { resolveLLMClientConfig, type LLMClientConfigOverrides, type LLMConfigEnvironment } from '../model/config.ts';
import { buildValidationPreflight, buildValidatorAvailability } from '../validators/preflight.ts';
import { readPackageMetadata, type InfraAgentPackageMetadata } from './package-metadata.ts';

export type DoctorCheckStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  name: string;
  status: DoctorCheckStatus;
  message: string;
  detail: string | null;
}

export interface DoctorReport {
  kind: 'infra-agent.doctor';
  schemaVersion: 1;
  version: string;
  node: {
    current: string;
    required: string | null;
  };
  workspaceRoot: string;
  summary: {
    status: DoctorCheckStatus;
    passCount: number;
    warnCount: number;
    failCount: number;
  };
  checks: DoctorCheck[];
}

function parseMajorVersion(value: string): number | null {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function satisfiesNodeEngine(current: string, required: string | null): boolean {
  if (!required) {
    return true;
  }

  const requiredMatch = required.match(/^>=\s*(\d+)/);
  const requiredMajor = requiredMatch ? Number(requiredMatch[1]) : null;
  const currentMajor = parseMajorVersion(current);
  if (requiredMajor === null || currentMajor === null) {
    return true;
  }

  return currentMajor >= requiredMajor;
}

function summarizeChecks(checks: DoctorCheck[]): DoctorReport['summary'] {
  const passCount = checks.filter(check => check.status === 'pass').length;
  const warnCount = checks.filter(check => check.status === 'warn').length;
  const failCount = checks.filter(check => check.status === 'fail').length;

  return {
    status: failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass',
    passCount,
    warnCount,
    failCount
  };
}

const REQUIRED_AGENT_SURFACE_PACKAGE_ENTRIES = [
  'bin/',
  'src/',
  'skills/',
  'AGENTS.md',
  'README.md',
  'docs/AGENT_RULES.md',
  'docs/CLAUDE_CODE_AGENT_PATTERNS.md',
  'docs/ROADMAP.md'
];

const EXCLUDED_AGENT_SURFACE_PACKAGE_ENTRIES = [
  'fixtures/',
  'test/',
  'tests/',
  'scripts/',
  'docs/HANDOFF.md'
];

const REQUIRED_AGENT_SURFACE_PATHS = [
  'bin/infra-agent.js',
  'src/cli/main.ts',
  'skills/infra-configuration/SKILL.md',
  'skills/infra-configuration/references/context-validation-and-impact.md',
  'AGENTS.md',
  'README.md',
  'docs/AGENT_RULES.md',
  'docs/CLAUDE_CODE_AGENT_PATTERNS.md',
  'docs/ROADMAP.md'
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function buildAgentSurfaceCheck(packageMetadata: InfraAgentPackageMetadata): Promise<DoctorCheck> {
  const missingPackageEntries = REQUIRED_AGENT_SURFACE_PACKAGE_ENTRIES.filter(
    entry => !packageMetadata.files.includes(entry)
  );
  const excludedPackageEntries = EXCLUDED_AGENT_SURFACE_PACKAGE_ENTRIES.filter(
    entry => packageMetadata.files.includes(entry)
  );
  const missingPaths: string[] = [];

  for (const relativePath of REQUIRED_AGENT_SURFACE_PATHS) {
    if (!await pathExists(resolve(packageMetadata.packageRoot, relativePath))) {
      missingPaths.push(relativePath);
    }
  }

  const missingDetails = [
    missingPackageEntries.length > 0 ? `missing package files entries: ${missingPackageEntries.join(', ')}` : null,
    excludedPackageEntries.length > 0 ? `unexpected non-surface package files entries: ${excludedPackageEntries.join(', ')}` : null,
    missingPaths.length > 0 ? `missing installed paths: ${missingPaths.join(', ')}` : null
  ].filter((detail): detail is string => Boolean(detail));

  return {
    name: 'agent-surface',
    status: missingDetails.length > 0 ? 'fail' : 'pass',
    message: missingDetails.length > 0
      ? 'Installed agent-facing package surface is incomplete.'
      : 'Installed agent-facing package surface includes CLI runtime, canonical AGENTS.md, infra skill, README, and durable docs.',
    detail: missingDetails.length > 0 ? missingDetails.join('; ') : REQUIRED_AGENT_SURFACE_PATHS.join(', ')
  };
}

export async function buildDoctorReport(
  workspacePath: string = cwd(),
  env: LLMConfigEnvironment = processEnv,
  plannerOptions: LLMClientConfigOverrides = {}
): Promise<DoctorReport> {
  const packageMetadata = await readPackageMetadata();
  const llmConfig = resolveLLMClientConfig(env, plannerOptions);
  const checks: DoctorCheck[] = [
    {
      name: 'package',
      status: packageMetadata.version === 'unknown' ? 'warn' : 'pass',
      message: packageMetadata.version === 'unknown'
        ? 'Package version could not be resolved.'
        : `infra-agent package version ${packageMetadata.version} is readable.`,
      detail: null
    },
    await buildAgentSurfaceCheck(packageMetadata),
    {
      name: 'node',
      status: satisfiesNodeEngine(nodeVersion, packageMetadata.nodeEngine) ? 'pass' : 'fail',
      message: satisfiesNodeEngine(nodeVersion, packageMetadata.nodeEngine)
        ? `Node ${nodeVersion} satisfies ${packageMetadata.nodeEngine ?? 'the package engine requirement'}.`
        : `Node ${nodeVersion} does not satisfy required engine ${packageMetadata.nodeEngine}.`,
      detail: packageMetadata.nodeEngine
    },
    {
      name: 'planner',
      status: llmConfig ? 'pass' : 'warn',
      message: llmConfig
        ? `LLM planner is configured for model ${llmConfig.model}.`
        : 'No LLM API key is configured; auto planner mode will use the rule-based fallback.',
      detail: llmConfig ? `model=${llmConfig.model}, baseUrl=${llmConfig.baseUrl}` : 'rule-based-fallback'
    }
  ];

  let workspaceRoot = workspacePath;
  let validatorAvailability = null as ReturnType<typeof buildValidatorAvailability> | null;
  try {
    const inspection = await inspectWorkspace(workspacePath);
    workspaceRoot = inspection.workspaceRoot;
    checks.push({
      name: 'workspace',
      status: 'pass',
      message: `Workspace inspection succeeded with ${inspection.domainCapabilities.length} detected domain(s).`,
      detail: inspection.domainCapabilities.map(domain => domain.id).join(', ') || 'no infra domains detected'
    });

    const validation = buildValidationPreflight(inspection);
    validatorAvailability = validation.validators;
    checks.push({
      name: 'validation-plan',
      status: validation.plan.length > 0 ? 'pass' : 'warn',
      message: validation.plan.length > 0
        ? `Validation preflight produced ${validation.plan.length} command group(s).`
        : 'No validation command groups were detected for this workspace.',
      detail: validation.plan.map(entry => `${entry.kind}:${entry.target}`).join(', ') || null
    });
  } catch (error) {
    checks.push({
      name: 'workspace',
      status: 'fail',
      message: 'Workspace inspection failed.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  for (const validator of validatorAvailability ?? buildValidatorAvailability()) {
    checks.push({
      name: `validator:${validator.name}`,
      status: validator.available ? 'pass' : 'warn',
      message: validator.available
        ? `${validator.name} is available.`
        : `${validator.name} is not available; related validation commands will be blocked.`,
      detail: validator.resolvedPath
    });
  }

  return {
    kind: 'infra-agent.doctor',
    schemaVersion: 1,
    version: packageMetadata.version,
    node: {
      current: nodeVersion,
      required: packageMetadata.nodeEngine
    },
    workspaceRoot,
    summary: summarizeChecks(checks),
    checks
  };
}
