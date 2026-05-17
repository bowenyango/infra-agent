import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import {
  buildScopedPackReport,
  renderScopedPackMarkdown
} from '../../src/domain/scoped-pack.ts';

test('buildScopedPackReport matches Helm chart path scopes', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildScopedPackReport(inspection, {
    scope: 'charts/payments-api'
  });

  assert.equal(report.kind, 'infra-agent.scoped-pack');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.scope.requested, 'charts/payments-api');
  assert.equal(report.scope.normalized, 'charts/payments-api');
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.recommendedAction, 'inspect-suggested-files');
  assert.ok(report.targets.some(target =>
    target.kind === 'helm-chart'
    && target.path === 'charts/payments-api'
    && target.matchReasons.includes('scope intersects target path')
  ));
  assert.ok(report.suggestedFiles.includes('charts/payments-api/Chart.yaml'));
  assert.ok(report.suggestedFiles.includes('charts/payments-api/values.yaml'));
  assert.ok(report.suggestedFiles.includes('charts/payments-api/values.schema.json'));
  assert.deepEqual(report.validationTargets, ['charts/payments-api']);
  assert.doesNotMatch(JSON.stringify(report), /example-api-secret/i);
});

test('buildScopedPackReport matches Pulumi stack and environment scopes', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const stackReport = buildScopedPackReport(inspection, {
    scope: 'dev'
  });

  assert.deepEqual(stackReport.summary.domains, ['pulumi']);
  assert.equal(stackReport.summary.matchedTargetCount, 1);
  assert.ok(stackReport.targets.some(target =>
    target.kind === 'pulumi-project'
    && target.path === 'infra/payments-api'
    && target.matchReasons.includes('scope matches Pulumi stack name')
  ));
  assert.ok(stackReport.targets[0]?.matchReasons.includes('scope matches environment hint'));
  assert.ok(stackReport.suggestedFiles.includes('infra/payments-api/Pulumi.yaml'));
  assert.ok(stackReport.suggestedFiles.includes('infra/payments-api/Pulumi.dev.yaml'));
  assert.deepEqual(stackReport.validationTargets, [
    'infra/payments-api',
    'infra/payments-api:dev'
  ]);
});

test('buildScopedPackReport applies domain filters', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildScopedPackReport(inspection, {
    scope: 'payments-api',
    domains: ['helm']
  });

  assert.deepEqual(report.filters.domains, ['helm']);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.omitted.filteredDomainCount, 1);
  assert.equal(report.targets[0]?.domain, 'helm');
});

test('buildScopedPackReport returns a read-only unmatched report', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildScopedPackReport(inspection, {
    scope: 'missing-service'
  });

  assert.equal(report.summary.matchedTargetCount, 0);
  assert.equal(report.summary.recommendedAction, 'narrow-scope');
  assert.deepEqual(report.targets, []);
  assert.deepEqual(report.suggestedFiles, []);
  assert.deepEqual(report.validationTargets, []);
  assert.equal(report.omitted.unmatchedScope, true);
});

test('renderScopedPackMarkdown emits compact agent handoff text', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildScopedPackReport(inspection, {
    scope: 'infra/payments-api'
  });
  const markdown = renderScopedPackMarkdown(report);

  assert.match(markdown, /^# Context Pack: infra\/payments-api/m);
  assert.match(markdown, /Mutation allowed: no/);
  assert.match(markdown, /pulumi pulumi-project infra\/payments-api/);
  assert.match(markdown, /infra\/payments-api\/Pulumi\.yaml/);
  assert.match(markdown, /No raw file content included/);
  assert.doesNotMatch(markdown, /example-api-secret/i);
});
