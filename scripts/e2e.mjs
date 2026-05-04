import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { buildCompactAgentRunResult } from '../src/cli/output.ts';
import { loadIdentityConflictIncidentReport } from '../src/cli/identity-report.ts';

async function main() {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-e2e-'));

  try {
    const workspaceRoot = join(tempRoot, 'sample-workspace');
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });

    const inspection = await inspectWorkspace(workspaceRoot);
    assert.ok(inspection.helmCharts.some(chart => chart.chartRoot === 'charts/payments-api'));
    assert.ok(inspection.pulumiProjects.some(project => project.projectRoot === 'infra/payments-api'));

    const agentState = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );
    const agentResult = buildCompactAgentRunResult(agentState);

    assert.equal(agentResult.kind, 'infra-agent.agent-result');
    assert.equal(agentResult.schemaVersion, 1);
    assert.equal(agentResult.outcome, 'completed');
    assert.equal(agentResult.validation.status, 'passed');
    assert.equal(agentResult.primaryTarget?.path, 'charts/payments-api');
    assert.ok(agentResult.changedFiles.some(path => path.endsWith('charts/payments-api/values.yaml')));
    assert.ok(agentResult.changedFiles.some(path => path.endsWith('charts/payments-api/templates/ingress.yaml')));

    const valuesContent = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const ingressTemplateContent = await readFile(join(workspaceRoot, 'charts/payments-api/templates/ingress.yaml'), 'utf8');
    assert.match(valuesContent, /ingress:\n\s+enabled: true/);
    assert.match(ingressTemplateContent, /kind: Ingress/);

    const resultPath = join(tempRoot, 'agent-result.json');
    await writeFile(resultPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'update terraform listener priority',
      workspaceRoot,
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
            riskCategory: 'create-before-delete-ordering',
            reviewSteps: [
              'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.',
              'Confirm listener ARN and priority match the existing listener rule.'
            ],
            suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
            sourceCommand: 'terraform -chdir=terraform/payments-api plan'
          }
        ]
      }
    }), 'utf8');

    const identityReport = await loadIdentityConflictIncidentReport(resultPath);
    assert.equal(identityReport.kind, 'infra-agent.identity-conflict-report');
    assert.equal(identityReport.sourceSchemaVersion, 1);
    assert.equal(identityReport.incidentCount, 1);
    assert.equal(identityReport.incidents[0]?.resourceLocator, 'aws_lb_listener_rule.api');
    assert.equal(identityReport.incidents[0]?.mutationAllowed, false);

    process.stdout.write(`e2e passed (${tempRoot})\n`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`e2e failed: ${message}\n`);
  process.exit(1);
});
