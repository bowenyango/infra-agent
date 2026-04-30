import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { buildRunPreflight } from '../src/agent/build-run-preflight.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { buildValidationPreflight } from '../src/validators/preflight.ts';
import { buildWorkspaceInfraGraph } from '../src/impact/workspace-graph.ts';
import { loadIdentityConflictIncidentReport } from '../src/cli/identity-report.ts';
import { exitCodeForRunPreflight, INFRA_AGENT_EXIT_CODES } from '../src/cli/exit-codes.ts';
import { buildDoctorReport } from '../src/cli/doctor.ts';

async function smokeInspect(workspacePath) {
  const inspection = await inspectWorkspace(workspacePath);
  assert.ok(inspection.workspaceRoot);
  return inspection;
}

async function smokeValidate(workspacePath) {
  const inspection = await smokeInspect(workspacePath);
  const validation = buildValidationPreflight(inspection);
  assert.ok(Array.isArray(validation.validators));
  assert.ok(Array.isArray(validation.plan));
  return validation;
}

async function smokeGraph(workspacePath) {
  const inspection = await smokeInspect(workspacePath);
  const graph = buildWorkspaceInfraGraph(inspection);
  assert.equal(graph.kind, 'infra-agent.infra-graph');
  assert.ok(graph.nodes.length > 0);
  return graph;
}

async function writeIdentityConflictFixture(path) {
  await writeFile(path, JSON.stringify({
    kind: 'infra-agent.agent-result',
    schemaVersion: 1,
    task: 'update terraform listener priority',
    workspaceRoot: '/workspace',
    outcome: 'validation-blocked',
    validation: {
      identityConflicts: [
        {
          engine: 'terraform',
          issueKind: 'terraform-create-before-delete-conflict',
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceName: null,
          resourceType: 'aws_lb_listener_rule',
          identity: {
            listenerRulePriorities: '100'
          },
          reviewSteps: [
            'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
          ],
          suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
          sourceCommand: 'terraform -chdir=terraform/payments-api plan'
        }
      ]
    }
  }), 'utf8');
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

    await smokeInspect('fixtures/sample-workspace');
    const doctorReport = await buildDoctorReport('fixtures/sample-workspace');
    assert.equal(doctorReport.kind, 'infra-agent.doctor');
    assert.equal(doctorReport.summary.failCount, 0);
    await smokeGraph('fixtures/sample-workspace');
    await smokeValidate('fixtures/sample-workspace');
    await smokeInspect('fixtures/scrawlr-infra-apps-workspace');
    await smokeInspect('fixtures/scrawlr-infra-cloud-workspace');
    await smokeInspect('fixtures/terraform-workspace');
    await smokeValidate('fixtures/terraform-workspace');
    await smokeInspect('fixtures/terraform-format-repair-workspace');
    await smokeValidate('fixtures/configured-workspace');
    const restrictedPreflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');
    assert.ok(restrictedPreflight.blockers.length > 0);
    assert.equal(exitCodeForRunPreflight(restrictedPreflight), INFRA_AGENT_EXIT_CODES.preflightBlocked);

    const identityResultPath = join(tempRoot, 'identity-agent-result.json');
    await writeIdentityConflictFixture(identityResultPath);
    const identityReport = await loadIdentityConflictIncidentReport(identityResultPath);
    assert.equal(identityReport.kind, 'infra-agent.identity-conflict-report');
    assert.equal(identityReport.incidents[0]?.mutationAllowed, false);

    await runSingleStep(
      'add ingress to payments-api dev chart',
      ingressWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const ingressValues = await readFile(join(ingressWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const ingressTemplate = await readFile(join(ingressWorkspaceRoot, 'charts/payments-api/templates/ingress.yaml'), 'utf8');
    assert.match(ingressValues, /ingress:/);
    assert.match(ingressTemplate, /kind: Ingress/);

    await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      probeWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const probeValues = await readFile(join(probeWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const deploymentTemplate = await readFile(join(probeWorkspaceRoot, 'charts/payments-api/templates/deployment.yaml'), 'utf8');
    assert.match(probeValues, /probes:/);
    assert.match(deploymentTemplate, /readinessProbe:/);

    await runSingleStep(
      'update pulumi dev stack for payments-api image tag to 1.2.3',
      pulumiWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const pulumiStack = await readFile(join(pulumiWorkspaceRoot, 'infra/payments-api/Pulumi.dev.yaml'), 'utf8');
    assert.match(pulumiStack, /payments-api:imageTag: 1\.2\.3/);

    await runSingleStep(
      'add ingress to payments-api dev chart',
      repairWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const repairedValues = await readFile(join(repairWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    assert.match(repairedValues, /service:\n  port: 8080/);

    await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      repairIngressWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const repairedIngressValues = await readFile(join(repairIngressWorkspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    assert.match(repairedIngressValues, /ingress:/);
    assert.match(repairedIngressValues, /enabled: true/);

    await runSingleStep(
      'update terraform payments-api dev image tag to 2.3.4',
      terraformRepairWorkspaceRoot,
      undefined,
      'rule-based'
    );
    const repairedTerraformMain = await readFile(join(terraformRepairWorkspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const repairedTerraformTfvars = await readFile(join(terraformRepairWorkspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    assert.match(repairedTerraformMain, /  image_tag   = var\.image_tag/);
    assert.match(repairedTerraformTfvars, /image_tag\s*=\s*"2\.3\.4"/);

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
