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
    const repairWorkspaceRoot = join(tempRoot, 'repair-workspace');
    const repairIngressWorkspaceRoot = join(tempRoot, 'repair-ingress-values-workspace');
    const terraformRepairWorkspaceRoot = join(tempRoot, 'terraform-repair-workspace');

    await cp(fixtureRoot, ingressWorkspaceRoot, { recursive: true });
    await cp(fixtureRoot, probeWorkspaceRoot, { recursive: true });
    await cp(fixtureRoot, pulumiWorkspaceRoot, { recursive: true });
    await cp(resolve('fixtures/repair-workspace'), repairWorkspaceRoot, { recursive: true });
    await cp(resolve('fixtures/repair-ingress-values-workspace'), repairIngressWorkspaceRoot, { recursive: true });
    await cp(resolve('fixtures/terraform-format-repair-workspace'), terraformRepairWorkspaceRoot, { recursive: true });

    runCommand(['--experimental-strip-types', 'src/cli/main.ts', '--help']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/sample-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'graph', 'fixtures/sample-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'validate', 'fixtures/sample-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/scrawlr-infra-apps-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/scrawlr-infra-cloud-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/terraform-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'validate', 'fixtures/terraform-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'inspect', 'fixtures/terraform-format-repair-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'validate', 'fixtures/configured-workspace']);
    runCommand(['--experimental-strip-types', 'src/cli/main.ts', 'run', 'add ingress to payments-api dev chart', '--workspace', 'fixtures/restricted-workspace']);

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

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'add ingress to payments-api dev chart',
      '--workspace',
      repairWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const repairedValues = await readFile(join(repairWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    if (!repairedValues.includes('service:\n  port: 8080')) {
      throw new Error('repair smoke check did not add the expected service.port repair.');
    }

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'add readiness and liveness probes to payments-api dev chart',
      '--workspace',
      repairIngressWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const repairedIngressValues = await readFile(join(repairIngressWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    if (!repairedIngressValues.includes('ingress:') || !repairedIngressValues.includes('enabled: true')) {
      throw new Error('ingress repair smoke check did not add the expected ingress values repair.');
    }

    runCommand([
      '--experimental-strip-types',
      'src/cli/main.ts',
      'agent',
      'update terraform payments-api dev image tag to 2.3.4',
      '--workspace',
      terraformRepairWorkspaceRoot,
      '--planner',
      'rule-based'
    ]);
    const repairedTerraformMain = await readFile(join(terraformRepairWorkspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const repairedTerraformTfvars = await readFile(join(terraformRepairWorkspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    if (!repairedTerraformMain.includes('  image_tag   = var.image_tag') || !/image_tag\s*=\s*"2.3.4"/.test(repairedTerraformTfvars)) {
      throw new Error('terraform repair smoke check did not format Terraform files and update tfvars as expected.');
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
