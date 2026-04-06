import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

function runCommand(args, options = {}) {
  const result = spawnSync('node', args, {
    cwd: resolve('.'),
    encoding: 'utf8',
    ...options
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const output = [stdout, stderr].filter(Boolean).join('\n');
    throw new Error(`Command failed: node ${args.join(' ')}\n${output}`);
  }

  return result.stdout;
}

async function main() {
  const fixtureRoot = resolve('fixtures/sample-workspace');
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-smoke-'));

  try {
    const ingressWorkspaceRoot = join(tempRoot, 'ingress-workspace');
    const probeWorkspaceRoot = join(tempRoot, 'probe-workspace');
    const pulumiWorkspaceRoot = join(tempRoot, 'pulumi-workspace');

    await cp(fixtureRoot, ingressWorkspaceRoot, { recursive: true });
    await cp(fixtureRoot, probeWorkspaceRoot, { recursive: true });
    await cp(fixtureRoot, pulumiWorkspaceRoot, { recursive: true });

    runCommand(['--experimental-strip-types', 'src/cli/main.ts', '--help']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/sample-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'validate', 'fixtures/sample-workspace']);

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'add ingress to payments-api dev chart',
      '--workspace',
      ingressWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const ingressValues = await readFile(join(ingressWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const ingressTemplate = await readFile(join(ingressWorkspaceRoot, 'charts/payments-api/templates/ingress.yaml'), 'utf8');
    if (!ingressValues.includes('ingress:') || !ingressTemplate.includes('kind: Ingress')) {
      throw new Error('ingress smoke check did not materialize expected chart changes.');
    }

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'add readiness and liveness probes to payments-api dev chart',
      '--workspace',
      probeWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const probeValues = await readFile(join(probeWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const deploymentTemplate = await readFile(join(probeWorkspaceRoot, 'charts/payments-api/templates/deployment.yaml'), 'utf8');
    if (!probeValues.includes('probes:') || !deploymentTemplate.includes('readinessProbe:')) {
      throw new Error('probe smoke check did not materialize expected deployment changes.');
    }

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'update pulumi dev stack for payments-api image tag to 1.2.3',
      '--workspace',
      pulumiWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const pulumiStack = await readFile(join(pulumiWorkspaceRoot, 'infra/payments-api/Pulumi.dev.yaml'), 'utf8');
    if (!pulumiStack.includes('payments-api:imageTag: 1.2.3')) {
      throw new Error('Pulumi smoke check did not materialize expected stack config changes.');
    }

    process.stdout.write(`smoke passed (${tempRoot})\n`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`smoke failed: ${message}\n`);
  process.exit(1);
});
