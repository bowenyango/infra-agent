import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildGraphSnapshotBaseGraph,
  buildGraphSnapshotTerraformPlan,
  buildGraphSnapshotPulumiPreview
} from '../support/graph-fixtures.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { summarizeInfraGraphImpact } from '../../src/cli/output.ts';
import { buildStableInfraGraphSnapshot } from '../../src/impact/graph-snapshot.ts';
import { normalizeInfraGraphImpactReviewTargets } from '../../src/impact/graph-impact-summary.ts';
import {
  buildWorkspaceInfraGraph,
  summarizeInfraGraph
} from '../../src/impact/workspace-graph.ts';
import {
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges
} from '../../src/impact/terraform-plan-graph.ts';
import {
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges
} from '../../src/impact/pulumi-preview-graph.ts';

test('inspect command detects fixture workspace assets', () => {
  const inspection = inspectWorkspace('fixtures/sample-workspace');

  return inspection.then(result => {
    assert.equal(result.profile.id, 'generic');
    assert.equal(result.helmCharts.length, 1);
    assert.equal(result.helmCharts[0]?.valuesSchemaFile, 'charts/payments-api/values.schema.json');
    assert.ok(result.configSemantics.some(summary =>
      summary.targetKind === 'helm-chart'
      && summary.targetPath === 'charts/payments-api'
      && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'image.repository')
    ));
    assert.equal(result.pulumiProjects.length, 1);
    assert.deepEqual(result.domainCapabilities.map(domain => domain.id), ['helm', 'pulumi']);
  });
});

test('workspace graph exposes inspected infra topology foundation', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);

  assert.equal(graph.kind, 'infra-agent.infra-graph');
  assert.equal(graph.mutationAllowed, false);
  assert.ok(graph.nodes.some(node =>
    node.kind === 'helm-chart'
    && node.path === 'charts/payments-api'
    && node.domain === 'helm'
  ));
  assert.ok(graph.nodes.some(node =>
    node.kind === 'helm-values-schema'
    && node.path === 'charts/payments-api/values.schema.json'
  ));
  assert.ok(graph.nodes.some(node =>
    node.kind === 'pulumi-project'
    && node.path === 'infra/payments-api'
  ));
  assert.ok(graph.edges.some(edge =>
    edge.kind === 'has-schema'
    && edge.from === 'helm-chart:charts/payments-api'
    && edge.to === 'helm-values-schema:charts/payments-api/values.schema.json'
  ));
  assert.equal(graph.summary.nodesByKind['workspace'], 1);
  assert.equal(graph.summary.edgesByKind['has-schema'], 1);
  assert.equal(graph.summary.sourceProvenance?.hasWorkspaceInspection, true);
  assert.equal(graph.summary.sourceProvenance?.hasTerraformPlan, false);
  assert.equal(graph.summary.sourceProvenance?.hasPulumiPreview, false);
  assert.deepEqual(graph.summary.sourceProvenance?.sources, [
    {
      source: 'workspace-inspection',
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      totalCount: graph.nodes.length + graph.edges.length
    }
  ]);
  assert.equal(graph.summary.impact?.plannedChanges, 0);
  assert.equal(graph.summary.impact?.mutationAllowed, false);
  assert.equal(graph.summary.impact?.omittedReviewTargets, 0);
  assert.deepEqual(graph.summary.impact?.reviewTargetBudget, {
    maxTargets: 5,
    totalTargets: 0,
    includedTargets: 0,
    omittedTargets: 0
  });
  assert.equal(graph.summary.impact?.riskLevel, 'none');
  assert.equal(graph.summary.impact?.primaryConcern, 'none');
  assert.equal(graph.summary.impact?.recommendedAction, 'none');
  assert.deepEqual(graph.summary.impact?.reviewSteps, []);
  assert.deepEqual(graph.summary.impact?.reviewTargets, []);
  assert.equal(graph.summary.nodeCount, graph.nodes.length);
  assert.equal(graph.summary.edgeCount, graph.edges.length);
});

test('infra graph stable snapshot covers cross-domain impact contract', async () => {
  const terraformGraph = attachTerraformPlanToGraph(
    buildGraphSnapshotBaseGraph(),
    buildGraphSnapshotTerraformPlan(),
    { targetPath: 'terraform/payments-api' }
  );
  const impactedGraph = attachPulumiPreviewToGraph(
    terraformGraph,
    buildGraphSnapshotPulumiPreview(),
    { targetPath: 'infra/payments-api' }
  );
  const snapshot = buildStableInfraGraphSnapshot(impactedGraph, {
    workspaceRoot: '<workspace>'
  });
  const expectedSnapshot = JSON.parse(await readFile(
    'fixtures/graph-snapshots/cross-domain-impact.snapshot.json',
    'utf8'
  ));

  assert.deepEqual(snapshot, expectedSnapshot);
  assert.equal(snapshot.summary.impact?.plannedChanges, 7);
  assert.equal(snapshot.summary.impact?.dependencyEdges, 4);
  assert.equal(snapshot.summary.impact?.possibleRenames, 1);
  assert.equal(snapshot.summary.impact?.replacementCascades, 2);
  assert.equal(snapshot.summary.impact?.createBeforeDeleteConflicts, 2);
  assert.equal(snapshot.summary.impact?.mutationAllowed, false);
  assert.equal(snapshot.summary.sourceProvenance?.hasWorkspaceInspection, true);
  assert.equal(snapshot.summary.sourceProvenance?.hasTerraformPlan, true);
  assert.equal(snapshot.summary.sourceProvenance?.hasPulumiPreview, true);
  assert.deepEqual(snapshot.summary.sourceProvenance?.sources.map(source => source.source), [
    'pulumi-preview',
    'terraform-plan',
    'workspace-inspection'
  ]);
  assert.equal(snapshot.summary.impact?.omittedReviewTargets, 0);
  assert.deepEqual(snapshot.summary.impact?.reviewTargetBudget, {
    maxTargets: 5,
    totalTargets: 5,
    includedTargets: 5,
    omittedTargets: 0
  });
  assert.equal(snapshot.summary.impact?.riskLevel, 'high');
  assert.equal(snapshot.summary.impact?.primaryConcern, 'create-before-delete-conflicts');
  assert.equal(snapshot.summary.impact?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.ok(snapshot.summary.impact?.reviewSteps.some(step => step.includes('logical rename')));
  assert.equal(snapshot.summary.impact?.reviewTargets.length, 5);
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.kind, 'create-before-delete-conflict');
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.mutationAllowed, false);
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.riskCategory, 'kubernetes-object-ownership');
  assert.ok(snapshot.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('exact pair')));
  assert.equal(snapshot.summary.impact?.reviewTargets[0]?.matchingIdentityKeys, 'metadata.name,metadata.namespace');
  assert.equal(snapshot.summary.impact?.reviewTargets[1]?.priority, 2);
  assert.equal(snapshot.summary.impact?.reviewTargets[1]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(snapshot.summary.impact?.reviewTargets[2]?.priority, 3);
  assert.equal(snapshot.summary.impact?.reviewTargets[2]?.recommendedAction, 'review-replacement-cascades');
  assert.equal(snapshot.summary.impact?.reviewTargets[2]?.riskCategory, 'replacement-cascade-review');
  assert.ok(snapshot.summary.impact?.reviewTargets[2]?.reviewSteps.some(step => step.includes('dependent change')));
  assert.equal(snapshot.summary.impact?.reviewTargets[4]?.priority, 5);
  assert.equal(snapshot.summary.impact?.reviewTargets[4]?.recommendedAction, 'review-possible-renames');
  assert.equal(snapshot.summary.impact?.reviewTargets[4]?.riskCategory, 'possible-rename-review');
  assert.ok(snapshot.summary.impact?.reviewTargets[4]?.reviewSteps.some(step => step.includes('matching identity keys')));
});

test('infra graph impact records omitted review target count when compact targets are capped', () => {
  const edges = Array.from({ length: 7 }, (_, index) => ({
    id: `create-before-delete-conflict:test-${index}`,
    from: `terraform-resource:old-${index}`,
    to: `terraform-resource:new-${index}`,
    kind: 'create-before-delete-conflict',
    confidence: 'high',
    source: 'terraform-plan',
    metadata: {
      reason: `exclusive identity conflict ${index}`,
      exclusiveIdentityValues: `name=resource-${index}`,
      matchingExclusiveIdentityKeys: 'name'
    }
  }));
  const graph = {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    workspaceRoot: '<workspace>',
    nodes: [],
    edges,
    summary: summarizeInfraGraph([], edges)
  };
  const impactLines = summarizeInfraGraphImpact(graph);

  assert.equal(graph.summary.impact?.reviewTargets.length, 5);
  assert.equal(graph.summary.impact?.omittedReviewTargets, 2);
  assert.deepEqual(graph.summary.impact?.reviewTargetBudget, {
    maxTargets: 5,
    totalTargets: 7,
    includedTargets: 5,
    omittedTargets: 2
  });
  assert.equal(graph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(graph.summary.impact?.reviewTargets[0]?.mutationAllowed, false);
  assert.equal(graph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(graph.summary.impact?.reviewTargets[0]?.riskCategory, 'create-before-delete-ordering');
  assert.ok(graph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('manual sequencing approval')));
  assert.match(impactLines[0] ?? '', /review targets=5, omitted review targets=2, review target budget=5\/7 included max=5/);
});

test('infra graph review target normalization infers per-target legacy guidance', () => {
  const targets = normalizeInfraGraphImpactReviewTargets([
    {
      edgeId: 'possible-rename:legacy',
      kind: 'possible-rename',
      from: 'terraform-resource:old',
      to: 'terraform-resource:new',
      confidence: 'medium',
      source: 'terraform-plan',
      priority: 99,
      mutationAllowed: true,
      matchingIdentityKeys: 'name'
    }
  ], []);

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.priority, 1);
  assert.equal(targets[0]?.mutationAllowed, false);
  assert.equal(targets[0]?.recommendedAction, 'review-possible-renames');
  assert.equal(targets[0]?.riskCategory, 'possible-rename-review');
  assert.ok(targets[0]?.reviewSteps.some(step => step.includes('matching identity keys')));
});

test('infra graph impact text infers risk posture for legacy impact summaries', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const legacyGraph = {
    ...graph,
    summary: {
      ...graph.summary,
      changesByAction: {
        replace: 1
      },
      impact: {
        dependencyEdges: 0,
        createBeforeDeleteConflicts: 0,
        mutationAllowed: true,
        omittedReviewTargets: 3,
        plannedChanges: 1,
        possibleRenames: 0,
        replacementCascades: 0
      }
    }
  };
  const impactLines = summarizeInfraGraphImpact(legacyGraph);

  assert.match(impactLines[0] ?? '', /risk=medium, primary concern=replacements, recommended action=review-replacements/);
  assert.match(impactLines[0] ?? '', /mutation allowed=false/);
  assert.match(impactLines[0] ?? '', /review targets=0, omitted review targets=3/);
  assert.ok(impactLines.some(line => line.includes('review step: Confirm whether any replacement is a logical rename')));
  assert.doesNotMatch(impactLines[0] ?? '', /undefined/);
});
