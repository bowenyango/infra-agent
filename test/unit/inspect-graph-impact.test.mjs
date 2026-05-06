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

test('Terraform plan impact attaches resource change nodes to the infra graph', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_instance.api',
        mode: 'managed',
        type: 'aws_instance',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['ami'], ['tags', 'Name']]
        },
        action_reason: 'replace_because_cannot_update'
      },
      {
        address: 'aws_security_group.api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['update']
        }
      },
      {
        address: 'data.aws_caller_identity.current',
        mode: 'data',
        type: 'aws_caller_identity',
        name: 'current',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['no-op']
        }
      }
    ]
  };

  const changes = parseTerraformPlanResourceChanges(planJson);
  assert.deepEqual(changes.map(change => change.action), ['replace', 'update', 'no-op']);

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const replacementNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_instance.api');

  assert.ok(replacementNode);
  assert.equal(replacementNode.kind, 'terraform-resource');
  assert.equal(replacementNode.source, 'terraform-plan');
  assert.equal(replacementNode.metadata?.action, 'replace');
  assert.equal(replacementNode.metadata?.replacePaths, 'ami,tags.Name');
  assert.equal(replacementNode.metadata?.replacementReasonCategories, 'provider-reported');
  assert.match(String(replacementNode.metadata?.replacementReasons), /Provider reported replacement for aws_instance\.ami/);
  assert.equal(impactedGraph.summary.changesByAction?.replace, 1);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.ok(impactedGraph.edges.some(edge =>
    edge.kind === 'planned-change'
    && edge.from === 'terraform-root:terraform/payments-api'
    && edge.to === 'terraform-resource:aws_instance.api'
  ));
});

test('Terraform plan impact marks matching delete and create resources as possible renames', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.old_name',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'old_name',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete'],
          before: {
            bucket: 'payments-artifacts',
            tags: {
              Name: 'payments-artifacts'
            }
          }
        }
      },
      {
        address: 'aws_s3_bucket.new_name',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'new_name',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            bucket: 'payments-artifacts',
            tags: {
              Name: 'payments-artifacts'
            }
          }
        }
      },
      {
        address: 'aws_s3_bucket.unrelated',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'unrelated',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            bucket: 'unrelated-artifacts'
          }
        }
      },
      {
        address: 'aws_security_group.old_api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'old_api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete'],
          before: {
            tags: {
              Name: 'api-shared'
            }
          }
        }
      },
      {
        address: 'aws_security_group.new_api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'new_api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            tags: {
              Name: 'api-shared'
            }
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const renameEdges = impactedGraph.edges.filter(edge => edge.kind === 'possible-rename');
  const bucketRename = renameEdges.find(edge => edge.from === 'terraform-resource:aws_s3_bucket.old_name');
  const tagOnlyRename = renameEdges.find(edge => edge.from === 'terraform-resource:aws_security_group.old_api');

  assert.equal(renameEdges.length, 2);
  assert.equal(bucketRename?.to, 'terraform-resource:aws_s3_bucket.new_name');
  assert.equal(bucketRename?.confidence, 'high');
  assert.equal(bucketRename?.metadata?.matchingIdentityKeys, 'bucket,tags.Name');
  assert.equal(bucketRename?.metadata?.score, 0.95);
  assert.match(String(bucketRename?.metadata?.reason), /same resource type; same provider/);
  assert.equal(tagOnlyRename?.to, 'terraform-resource:aws_security_group.new_api');
  assert.equal(tagOnlyRename?.confidence, 'medium');
  assert.equal(tagOnlyRename?.metadata?.matchingIdentityKeys, 'tags.Name');
});

test('Terraform plan impact marks exclusive identity create-before-destroy conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['force_destroy']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts',
            force_destroy: true
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.from, 'terraform-resource:aws_s3_bucket.artifacts');
  assert.equal(conflictEdges[0]?.to, 'terraform-resource:aws_s3_bucket.artifacts');
  assert.equal(conflictEdges[0]?.confidence, 'high');
  assert.equal(conflictEdges[0]?.metadata?.actionOrder, 'create,delete');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'bucket=payments-artifacts');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /create-before-destroy replacement can fail with BucketAlreadyExists/i);
  assert.equal(impactedGraph.summary.impact?.createBeforeDeleteConflicts, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.equal(impactedGraph.summary.impact?.omittedReviewTargets, 0);
  assert.equal(impactedGraph.summary.impact?.riskLevel, 'high');
  assert.equal(impactedGraph.summary.impact?.primaryConcern, 'create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('delete/create pair')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'create-before-delete-conflict');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'physical-name-ownership');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('logical rename')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.identity, 'bucket=payments-artifacts');
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('risk=high, primary concern=create-before-delete-conflicts, recommended action=review-create-before-delete-conflicts, mutation allowed=false, review targets=1, omitted review targets=0')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('review step: For logical renames, review Terraform moved blocks/state moves or Pulumi aliases/imports')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('create-before-delete conflict: aws_s3_bucket.artifacts -> aws_s3_bucket.artifacts [high]')
  ));
});

test('Terraform plan impact marks AWS listener rule priority conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_lb_listener_rule.payments',
        mode: 'managed',
        type: 'aws_lb_listener_rule',
        name: 'payments',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['condition']],
          before: {
            listener_arn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          },
          after: {
            listener_arn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.confidence, 'high');
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-lb-listener-rule');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'listenerArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2,priority=100'
  );
  assert.match(String(conflictEdge.metadata?.reason), /PriorityInUse/);
});

test('Terraform plan impact marks AWS security group rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_security_group_rule.api_https',
        mode: 'managed',
        type: 'aws_security_group_rule',
        name: 'api_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_blocks: ['10.0.0.0/16'],
            ipv6_cidr_blocks: ['2001:db8::/48']
          },
          after: {
            security_group_id: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_blocks: ['10.1.0.0/16'],
            ipv6_cidr_blocks: ['2001:db8::/48']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,type,protocol,fromPort,toPort,source');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,type=ingress,protocol=tcp,fromPort=443,toPort=443,source=10.0.0.0/16|2001:db8::/48'
  );
  assert.match(String(conflictEdge.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Terraform plan impact marks AWS VPC security group ingress rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_ingress_rule.api_https',
        mode: 'managed',
        type: 'aws_vpc_security_group_ingress_rule',
        name: 'api_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_ipv4: '10.0.0.0/16'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_ipv4: '10.0.0.0/16',
            description: 'managed https ingress'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,fromPort,toPort,peer');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=tcp,fromPort=443,toPort=443,peer=10.0.0.0/16'
  );
  assert.match(String(conflictEdge.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Terraform plan impact marks all-protocol VPC security group rules without ports', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_egress_rule.all_outbound',
        mode: 'managed',
        type: 'aws_vpc_security_group_egress_rule',
        name: 'all_outbound',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: '-1',
            cidr_ipv4: '0.0.0.0/0'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: '-1',
            cidr_ipv4: '0.0.0.0/0',
            description: 'managed all outbound'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,peer');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=-1,peer=0.0.0.0/0'
  );
});

test('Terraform plan impact keeps VPC security group TCP rules without ports incomplete', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_ingress_rule.incomplete_https',
        mode: 'managed',
        type: 'aws_vpc_security_group_ingress_rule',
        name: 'incomplete_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            cidr_ipv4: '10.0.0.0/16'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            cidr_ipv4: '10.0.0.0/16',
            description: 'missing ports should stay conservative'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 0);
});

test('Terraform plan impact marks CloudFront alias overlap conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_cloudfront_distribution.edge',
        mode: 'managed',
        type: 'aws_cloudfront_distribution',
        name: 'edge',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['viewer_certificate']],
          before: {
            aliases: ['api.example.com', 'old.example.com']
          },
          after: {
            aliases: ['api.example.com', 'new.example.com']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.confidence, 'high');
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-cloudfront-alias');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'aliases');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'aliases=api.example.com|old.example.com');
  assert.match(String(conflictEdge.metadata?.reason), /CNAMEAlreadyExists/);
});

test('Terraform plan impact marks Route53 ACM validation record conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_route53_record.acm_validation',
        mode: 'managed',
        type: 'aws_route53_record',
        name: 'acm_validation',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['records']],
          before: {
            zone_id: 'Z1234567890',
            name: '_abc.api.example.com',
            type: 'CNAME',
            records: ['_old.acm-validations.aws.']
          },
          after: {
            zone_id: 'Z1234567890',
            name: '_abc.api.example.com',
            type: 'CNAME',
            records: ['_new.acm-validations.aws.']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-route53-record');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'zoneId,name,type');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'zoneId=Z1234567890,name=_abc.api.example.com,type=CNAME');
  assert.match(String(conflictEdge.metadata?.reason), /InvalidChangeBatch/);
  assert.match(String(conflictEdge.metadata?.suggestedAction), /ACM validation CNAMEs/);
});

test('Terraform plan impact marks IAM OIDC provider URL conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_iam_openid_connect_provider.github',
        mode: 'managed',
        type: 'aws_iam_openid_connect_provider',
        name: 'github',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['thumbprint_list']],
          before: {
            url: 'https://token.actions.githubusercontent.com',
            client_id_list: ['sts.amazonaws.com'],
            thumbprint_list: ['oldthumbprint']
          },
          after: {
            url: 'https://token.actions.githubusercontent.com',
            client_id_list: ['sts.amazonaws.com'],
            thumbprint_list: ['newthumbprint']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-iam-oidc-provider');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'url=https://token.actions.githubusercontent.com');
  assert.match(String(conflictEdge.metadata?.reason), /EntityAlreadyExists/);
});

test('Terraform plan impact enriches replacement reasons from known replacement paths', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['bucket']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts-v2'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const bucketNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_s3_bucket.artifacts');

  assert.ok(bucketNode);
  assert.equal(bucketNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.equal(bucketNode.metadata?.replacementReasonPaths, 'bucket');
  assert.match(String(bucketNode.metadata?.replacementReasons), /AWS S3 Bucket: bucket is the globally unique physical bucket name/);
  assert.match(String(bucketNode.metadata?.replacementSuggestedActions), /bucket identity change/);
});

test('Terraform plan impact marks dependency edges and replacement cascades', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_s3_bucket.artifacts',
            depends_on: []
          },
          {
            address: 'aws_lambda_function.api',
            depends_on: ['aws_s3_bucket.artifacts']
          }
        ]
      }
    },
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['bucket']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts-v2'
          }
        }
      },
      {
        address: 'aws_lambda_function.api',
        mode: 'managed',
        type: 'aws_lambda_function',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['source_code_hash']],
          before: {
            function_name: 'payments-api'
          },
          after: {
            function_name: 'payments-api'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === 'terraform-resource:aws_lambda_function.api'
    && edge.to === 'terraform-resource:aws_s3_bucket.artifacts'
  );
  const cascadeEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'replacement-cascade'
    && edge.from === 'terraform-resource:aws_s3_bucket.artifacts'
    && edge.to === 'terraform-resource:aws_lambda_function.api'
  );

  assert.ok(dependencyEdge);
  assert.equal(dependencyEdge.source, 'terraform-plan');
  assert.equal(dependencyEdge.metadata?.dependentAction, 'replace');
  assert.ok(cascadeEdge);
  assert.equal(cascadeEdge.source, 'terraform-plan');
  assert.equal(cascadeEdge.confidence, 'high');
  assert.equal(cascadeEdge.metadata?.dependencyAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependentAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependencyReplacementReasonCategories, 'exclusive-identity');
  assert.match(String(cascadeEdge.metadata?.dependencyReplacementReasons), /bucket: AWS S3 Bucket/);
  assert.equal(impactedGraph.summary.edgesByKind['depends-on'], 1);
  assert.equal(impactedGraph.summary.impact?.replacementCascades, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.equal(impactedGraph.summary.impact?.omittedReviewTargets, 0);
  assert.equal(impactedGraph.summary.impact?.riskLevel, 'medium');
  assert.equal(impactedGraph.summary.impact?.primaryConcern, 'replacement-cascades');
  assert.equal(impactedGraph.summary.impact?.recommendedAction, 'review-replacement-cascades');
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('downstream blast radius')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'replacement-cascade');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-replacement-cascades');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'replacement-cascade-review');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('blast radius')));
  assert.match(String(impactedGraph.summary.impact?.reviewTargets[0]?.replacementReasons), /bucket: AWS S3 Bucket/);
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('replacement cascade: aws_s3_bucket.artifacts -> aws_lambda_function.api [high] replace -> replace')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('reason=bucket: AWS S3 Bucket')
  ));
});

test('Terraform plan impact adds unchanged dependency context nodes', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_s3_bucket.artifacts',
            mode: 'managed',
            type: 'aws_s3_bucket',
            name: 'artifacts',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            values: {
              bucket: 'payments-artifacts'
            }
          },
          {
            address: 'aws_lambda_function.api',
            mode: 'managed',
            type: 'aws_lambda_function',
            name: 'api',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            depends_on: ['aws_s3_bucket.artifacts'],
            values: {
              function_name: 'payments-api'
            }
          }
        ]
      }
    },
    resource_changes: [
      {
        address: 'aws_lambda_function.api',
        mode: 'managed',
        type: 'aws_lambda_function',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['update'],
          after: {
            function_name: 'payments-api'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const contextNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_s3_bucket.artifacts');
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === 'terraform-resource:aws_lambda_function.api'
    && edge.to === 'terraform-resource:aws_s3_bucket.artifacts'
  );

  assert.ok(contextNode);
  assert.equal(contextNode.source, 'terraform-plan');
  assert.equal(contextNode.metadata?.role, 'dependency-context');
  assert.equal(contextNode.metadata?.action, undefined);
  assert.equal(contextNode.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(contextNode.metadata?.exclusiveIdentityKeys, 'bucket');
  assert.ok(dependencyEdge);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.equal(impactedGraph.summary.impact?.plannedChanges, 1);
  assert.equal(impactedGraph.summary.impact?.dependencyEdges, 1);
});

test('Pulumi preview impact attaches resource change nodes to the infra graph', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api',
          type: 'kubernetes:apps/v1:Deployment',
          name: 'payments-api',
          diffs: ['spec.template.spec.containers[0].image']
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api',
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api',
          detailedDiff: {
            ingress: {
              kind: 'update'
            }
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: 'urn:pulumi:dev::payments-api::pulumi:pulumi:Stack::payments-api-dev',
          type: 'pulumi:pulumi:Stack',
          name: 'payments-api-dev'
        }
      }
    }
  ];

  const changes = parsePulumiPreviewResourceChanges(previewJson);
  assert.deepEqual(changes.map(change => change.action), ['create', 'replace', 'no-op']);

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const deploymentNode = impactedGraph.nodes.find(node =>
    node.id === 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api'
  );

  assert.ok(deploymentNode);
  assert.equal(deploymentNode.kind, 'pulumi-resource');
  assert.equal(deploymentNode.source, 'pulumi-preview');
  assert.equal(deploymentNode.metadata?.action, 'create');
  assert.equal(deploymentNode.metadata?.diffs, 'spec.template.spec.containers[0].image');
  assert.equal(impactedGraph.summary.changesByAction?.create, 1);
  assert.equal(impactedGraph.summary.changesByAction?.replace, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.ok(impactedGraph.edges.some(edge =>
    edge.kind === 'planned-change'
    && edge.source === 'pulumi-preview'
    && edge.from === 'pulumi-project:infra/payments-api'
    && edge.to === deploymentNode.id
  ));
});

test('Pulumi preview impact marks matching delete and create resources as possible renames', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::old-api',
          type: 'kubernetes:core/v1:Service',
          name: 'old-api',
          old: {
            metadata: {
              name: 'payments-api',
              namespace: 'default'
            }
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::new-api',
          type: 'kubernetes:core/v1:Service',
          name: 'new-api',
          new: {
            metadata: {
              name: 'payments-api',
              namespace: 'default'
            }
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::other-api',
          type: 'kubernetes:core/v1:Service',
          name: 'other-api',
          new: {
            metadata: {
              name: 'other-api',
              namespace: 'default'
            }
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const renameEdges = impactedGraph.edges.filter(edge => edge.kind === 'possible-rename');

  assert.equal(renameEdges.length, 1);
  assert.equal(renameEdges[0]?.from, 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::old-api');
  assert.equal(renameEdges[0]?.to, 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::new-api');
  assert.equal(renameEdges[0]?.source, 'pulumi-preview');
  assert.equal(renameEdges[0]?.confidence, 'high');
  assert.equal(renameEdges[0]?.metadata?.matchingIdentityKeys, 'metadata.name,metadata.namespace');
  assert.equal(renameEdges[0]?.metadata?.score, 1);
});

test('Pulumi preview impact enriches replacement reasons from detailed diff', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const bucketUrn = 'urn:pulumi:dev::payments-api::aws:s3/bucket:Bucket::artifacts';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: bucketUrn,
          type: 'aws:s3/bucket:Bucket',
          name: 'artifacts',
          detailedDiff: {
            bucket: {
              kind: 'update-replace'
            },
            tags: {
              kind: 'update'
            }
          },
          old: {
            bucket: 'payments-artifacts'
          },
          new: {
            bucket: 'payments-artifacts-v2'
          }
        }
      }
    }
  ];

  const changes = parsePulumiPreviewResourceChanges(previewJson);
  assert.deepEqual(changes[0]?.replacementPaths, ['bucket']);

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const bucketNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${bucketUrn}`);

  assert.ok(bucketNode);
  assert.equal(bucketNode.metadata?.replacementPaths, 'bucket');
  assert.equal(bucketNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.match(String(bucketNode.metadata?.replacementReasons), /AWS S3 Bucket: bucket is the globally unique physical bucket name/);
  assert.match(String(bucketNode.metadata?.replacementSuggestedActions), /bucket identity change/);
});

test('Pulumi preview impact enriches AWS listener rule priority replacement reasons', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const ruleUrn = 'urn:pulumi:dev::payments-api::aws:lb/listenerRule:ListenerRule::payments';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: ruleUrn,
          type: 'aws:lb/listenerRule:ListenerRule',
          name: 'payments',
          detailedDiff: {
            priority: {
              kind: 'update-replace'
            }
          },
          old: {
            listenerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          },
          new: {
            listenerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 200
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const ruleNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${ruleUrn}`);

  assert.ok(ruleNode);
  assert.equal(ruleNode.metadata?.replacementPaths, 'priority');
  assert.equal(ruleNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.match(String(ruleNode.metadata?.replacementReasons), /AWS Load Balancer Listener Rule: priority must be unique/);
  assert.match(String(ruleNode.metadata?.replacementSuggestedActions), /PriorityInUse/);
});

test('Pulumi preview impact enriches ACM certificate domain replacement reasons', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const certificateUrn = 'urn:pulumi:dev::payments-api::aws:acm/certificate:Certificate::api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: certificateUrn,
          type: 'aws:acm/certificate:Certificate',
          name: 'api',
          detailedDiff: {
            domainName: {
              kind: 'update-replace'
            },
            subjectAlternativeNames: {
              kind: 'update-replace'
            }
          },
          old: {
            domainName: 'api.example.com',
            subjectAlternativeNames: ['www.example.com']
          },
          new: {
            domainName: 'payments.example.com',
            subjectAlternativeNames: ['api.example.com']
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const certificateNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${certificateUrn}`);

  assert.ok(certificateNode);
  assert.equal(certificateNode.metadata?.replacementPaths, 'domainName,subjectAlternativeNames');
  assert.equal(certificateNode.metadata?.replacementReasonCategories, 'resource-address');
  assert.match(String(certificateNode.metadata?.replacementReasons), /AWS ACM Certificate: domain name defines the requested certificate identity/);
  assert.match(String(certificateNode.metadata?.replacementSuggestedActions), /DNS validation records/);
});

test('Pulumi preview impact marks AWS route create-before-delete replacement conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::networking::aws:ec2/route:Route::old-peer-route',
          type: 'aws:ec2/route:Route',
          name: 'old-peer-route',
          old: {
            routeTableId: 'rtb-0102177ec9e1ab465',
            destinationCidrBlock: '10.0.0.0/16',
            vpcPeeringConnectionId: 'pcx-01d08d08a5b09dc56'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::networking::aws:ec2/route:Route::new-peer-route',
          type: 'aws:ec2/route:Route',
          name: 'new-peer-route',
          new: {
            routeTableId: 'rtb-0102177ec9e1ab465',
            destinationCidrBlock: '10.0.0.0/16',
            vpcPeeringConnectionId: 'pcx-0881f5cc374f72a09'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.from, 'pulumi-resource:urn:pulumi:prod::networking::aws:ec2/route:Route::old-peer-route');
  assert.equal(conflictEdges[0]?.to, 'pulumi-resource:urn:pulumi:prod::networking::aws:ec2/route:Route::new-peer-route');
  assert.equal(conflictEdges[0]?.confidence, 'high');
  assert.equal(conflictEdges[0]?.metadata?.routeTableId, 'rtb-0102177ec9e1ab465');
  assert.equal(conflictEdges[0]?.metadata?.destinationValue, '10.0.0.0/16');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /RouteAlreadyExists/i);
  assert.equal(impactedGraph.summary.impact?.createBeforeDeleteConflicts, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('manual sequencing')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'create-before-delete-conflict');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'create-before-delete-ordering');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('delete-before-create')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.identity, 'routeTableId=rtb-0102177ec9e1ab465,destination=10.0.0.0/16');
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('create-before-delete conflict: pulumi:aws:ec2/route:Route::old-peer-route -> pulumi:aws:ec2/route:Route::new-peer-route [high]')
  ));
});

test('Pulumi preview impact marks generic exclusive identity create-before-delete conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::storage::aws:s3/bucket:Bucket::old-artifacts',
          type: 'aws:s3/bucket:Bucket',
          name: 'old-artifacts',
          old: {
            bucket: 'scrawlr-prod-artifacts'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::storage::aws:s3/bucket:Bucket::new-artifacts',
          type: 'aws:s3/bucket:Bucket',
          name: 'new-artifacts',
          new: {
            bucket: 'scrawlr-prod-artifacts'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'bucket=scrawlr-prod-artifacts');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /BucketAlreadyExists/i);
});

test('Pulumi preview impact marks AWS security group rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:ec2/securityGroupRule:SecurityGroupRule::old-api-https',
          type: 'aws:ec2/securityGroupRule:SecurityGroupRule',
          name: 'old-api-https',
          old: {
            securityGroupId: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['10.0.0.0/16']
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:ec2/securityGroupRule:SecurityGroupRule::new-api-https',
          type: 'aws:ec2/securityGroupRule:SecurityGroupRule',
          name: 'new-api-https',
          new: {
            securityGroupId: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['10.0.0.0/16']
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-security-group-rule');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,type=ingress,protocol=tcp,fromPort=443,toPort=443,source=10.0.0.0/16'
  );
  assert.match(String(conflictEdges[0]?.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Pulumi preview impact marks AWS VPC security group egress rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::old-api-egress',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'old-api-egress',
          old: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            referencedSecurityGroupId: 'sg-0987654321'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::new-api-egress',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'new-api-egress',
          new: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            referencedSecurityGroupId: 'sg-0987654321'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=tcp,fromPort=443,toPort=443,peer=sg-0987654321'
  );
  assert.match(String(conflictEdges[0]?.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Pulumi preview impact marks all-protocol VPC security group rules without ports', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::old-all-outbound',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'old-all-outbound',
          old: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: '-1',
            cidrIpv4: '0.0.0.0/0'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::new-all-outbound',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'new-all-outbound',
          new: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: '-1',
            cidrIpv4: '0.0.0.0/0'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdges[0]?.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,peer');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=-1,peer=0.0.0.0/0'
  );
});

test('Pulumi preview impact marks API Gateway custom domain conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::api::aws:apigateway/domainName:DomainName::old-api',
          type: 'aws:apigateway/domainName:DomainName',
          name: 'old-api',
          old: {
            domainName: 'api.example.com'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::api::aws:apigateway/domainName:DomainName::new-api',
          type: 'aws:apigateway/domainName:DomainName',
          name: 'new-api',
          new: {
            domainName: 'api.example.com'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-api-gateway-domain-name');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'domainName=api.example.com');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /ConflictException/);
});

test('Pulumi preview impact marks IAM OIDC provider URL conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::identity::aws:iam/openIdConnectProvider:OpenIdConnectProvider::old-github',
          type: 'aws:iam/openIdConnectProvider:OpenIdConnectProvider',
          name: 'old-github',
          old: {
            url: 'https://token.actions.githubusercontent.com'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::identity::aws:iam/openIdConnectProvider:OpenIdConnectProvider::new-github',
          type: 'aws:iam/openIdConnectProvider:OpenIdConnectProvider',
          name: 'new-github',
          new: {
            url: 'https://token.actions.githubusercontent.com'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-iam-oidc-provider');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'url=https://token.actions.githubusercontent.com');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /EntityAlreadyExists/);
});

test('Pulumi preview impact marks dependency edges and replacement cascades', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api'
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'update',
          urn: deploymentUrn,
          type: 'kubernetes:apps/v1:Deployment',
          name: 'payments-api',
          dependencies: [securityGroupUrn]
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === `pulumi-resource:${deploymentUrn}`
    && edge.to === `pulumi-resource:${securityGroupUrn}`
  );
  const cascadeEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'replacement-cascade'
    && edge.from === `pulumi-resource:${securityGroupUrn}`
    && edge.to === `pulumi-resource:${deploymentUrn}`
  );

  assert.ok(dependencyEdge);
  assert.equal(dependencyEdge.source, 'pulumi-preview');
  assert.equal(dependencyEdge.metadata?.dependentAction, 'update');
  assert.ok(cascadeEdge);
  assert.equal(cascadeEdge.source, 'pulumi-preview');
  assert.equal(cascadeEdge.confidence, 'medium');
  assert.equal(cascadeEdge.metadata?.dependencyAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependentAction, 'update');
  assert.equal(impactedGraph.summary.edgesByKind['depends-on'], 1);
  assert.equal(impactedGraph.summary.impact?.replacementCascades, 1);
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('replacement cascade: pulumi:aws:ec2/securityGroup:SecurityGroup::api -> pulumi:kubernetes:apps/v1:Deployment::payments-api [medium] replace -> update')
  ));
});

test('Pulumi preview impact adds unchanged dependency context nodes', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api'
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'update',
          urn: deploymentUrn,
          type: 'kubernetes:apps/v1:Deployment',
          name: 'payments-api',
          dependencies: [securityGroupUrn]
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const contextNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${securityGroupUrn}`);
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === `pulumi-resource:${deploymentUrn}`
    && edge.to === `pulumi-resource:${securityGroupUrn}`
  );

  assert.ok(contextNode);
  assert.equal(contextNode.source, 'pulumi-preview');
  assert.equal(contextNode.metadata?.role, 'dependency-context');
  assert.equal(contextNode.metadata?.action, undefined);
  assert.equal(contextNode.metadata?.operation, 'same');
  assert.ok(dependencyEdge);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.equal(impactedGraph.summary.impact?.plannedChanges, 1);
  assert.equal(impactedGraph.summary.impact?.dependencyEdges, 1);
});
