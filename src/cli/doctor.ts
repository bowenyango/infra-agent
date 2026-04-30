import { cwd, version as nodeVersion } from 'node:process';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildValidationPreflight, buildValidatorAvailability } from '../validators/preflight.ts';
import { readPackageMetadata } from './package-metadata.ts';

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

export async function buildDoctorReport(workspacePath: string = cwd()): Promise<DoctorReport> {
  const packageMetadata = await readPackageMetadata();
  const checks: DoctorCheck[] = [
    {
      name: 'package',
      status: packageMetadata.version === 'unknown' ? 'warn' : 'pass',
      message: packageMetadata.version === 'unknown'
        ? 'Package version could not be resolved.'
        : `infra-agent package version ${packageMetadata.version} is readable.`,
      detail: null
    },
    {
      name: 'node',
      status: satisfiesNodeEngine(nodeVersion, packageMetadata.nodeEngine) ? 'pass' : 'fail',
      message: satisfiesNodeEngine(nodeVersion, packageMetadata.nodeEngine)
        ? `Node ${nodeVersion} satisfies ${packageMetadata.nodeEngine ?? 'the package engine requirement'}.`
        : `Node ${nodeVersion} does not satisfy required engine ${packageMetadata.nodeEngine}.`,
      detail: packageMetadata.nodeEngine
    }
  ];

  let workspaceRoot = workspacePath;
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

  for (const validator of buildValidatorAvailability()) {
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
