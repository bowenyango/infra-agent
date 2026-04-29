import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { executeDecision } from '../src/agent/execute-decision.ts';
import { buildTargetCandidates, detectRequestedService } from '../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../src/validators/preflight.ts';
import { classifyValidationIssues } from '../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../src/agent/rule-based-planner.ts';
import { parsePlannerDecision } from '../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from '../src/model/prompt.ts';
import { buildEditPlan } from '../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../src/agent/collect-approval-signals.ts';
import {
  buildCompactAgentRunResult,
  summarizeAgentSnapshot,
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizeInfraGraphImpact,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands
} from '../src/cli/output.ts';
import { parseArgs } from '../src/cli/main.ts';
import { executeTool } from '../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { SearchWorkspaceTool } from '../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { resolveEffectiveApprovalPolicy } from '../src/domain/workspace-policy.ts';
import { resolveEffectiveEditPolicy } from '../src/domain/edit-policy.ts';
import { inferRequestedDomains } from '../src/domain/domain-focus.ts';
import { prioritizeEditPlanKinds } from '../src/agent/edit-plan-priority.ts';
import { buildInspectionCandidateFiles, buildInspectionSearchPattern } from '../src/agent/inspection-priority.ts';
import { deriveConfigSemanticsFromValidationIssues, mergeConfigSemantics } from '../src/agent/config-semantics-state.ts';
import { resolveQueryLoopConfig } from '../src/query-config.ts';
import {
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from '../src/knowledge/cache.ts';
import { resolveKnowledgeCacheRoot } from '../src/knowledge/cache-root.ts';
import { fetchOfficialKnowledgeSource, retrieveKnowledgeContextPacket } from '../src/knowledge/retrieve.ts';
import {
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets
} from '../src/domain/terraform-registry-context.ts';
import {
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets
} from '../src/domain/helm-chart-context.ts';
import { prefetchWorkspaceKnowledge } from '../src/knowledge/prefetch.ts';
import { buildWorkspaceInfraGraph } from '../src/impact/workspace-graph.ts';
import {
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges
} from '../src/impact/terraform-plan-graph.ts';
import {
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges
} from '../src/impact/pulumi-preview-graph.ts';

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
  assert.equal(graph.summary.impact?.plannedChanges, 0);
  assert.equal(graph.summary.nodeCount, graph.nodes.length);
  assert.equal(graph.summary.edgeCount, graph.edges.length);
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
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('create-before-delete conflict: aws_s3_bucket.artifacts -> aws_s3_bucket.artifacts [high]')
  ));
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
  assert.equal(impactedGraph.summary.edgesByKind['depends-on'], 1);
  assert.equal(impactedGraph.summary.impact?.replacementCascades, 1);
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('replacement cascade: aws_s3_bucket.artifacts -> aws_lambda_function.api [high] replace -> replace')
  ));
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

test('inspectWorkspace extracts Helm values schema semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const helmSemantics = inspection.configSemantics.find(summary => summary.targetPath === 'charts/payments-api');

  assert.ok(helmSemantics);
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'required-field'
    && fact.path === 'service.port'
    && fact.source.kind === 'helm-values-schema'
  ));
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'defaulted-field'
    && fact.path === 'replicaCount'
    && fact.values?.includes('1')
  ));
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'enum'
    && fact.path === 'ingress.className'
    && fact.values?.includes('alb')
  ));
});

test('inspectWorkspace extracts Terraform variable semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const terraformSemantics = inspection.configSemantics.find(summary =>
    summary.targetKind === 'terraform-root'
    && summary.targetPath === 'terraform/payments-api'
  );

  assert.ok(terraformSemantics);
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'required-field'
    && fact.path === 'var.image_tag'
    && fact.source.kind === 'terraform-variable'
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'defaulted-field'
    && fact.path === 'var.service_name'
    && fact.values?.includes('payments-api')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'type-constraint'
    && fact.path === 'var.environment'
    && fact.values?.includes('string')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'enum'
    && fact.path === 'var.environment'
    && fact.values?.includes('dev')
    && fact.values?.includes('prod')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'validation-rule'
    && fact.path === 'var.environment'
    && fact.message.includes('dev, stage, or prod')
  ));
});

test('inspectWorkspace extracts Pulumi stack config semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pulumiSemantics = inspection.configSemantics.find(summary =>
    summary.targetKind === 'pulumi-project'
    && summary.targetPath === 'infra/payments-api'
  );

  assert.ok(pulumiSemantics);
  assert.ok(pulumiSemantics.facts.some(fact =>
    fact.kind === 'type-constraint'
    && fact.path === 'config.payments-api:environment'
    && fact.values?.includes('string')
    && fact.source.path === 'infra/payments-api/Pulumi.yaml'
  ));
  assert.ok(pulumiSemantics.facts.some(fact =>
    fact.kind === 'configured-field'
    && fact.path === 'config.payments-api:imageTag'
    && fact.values?.includes('latest')
    && fact.source.path === 'infra/payments-api/Pulumi.dev.yaml'
  ));
});

test('knowledge cache ids include version-sensitive source metadata', () => {
  const sourceV1 = {
    kind: 'terraform-registry',
    name: 'aws_instance',
    provider: 'hashicorp/aws',
    version: '5.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/5.0.0/docs/resources/instance'
  };
  const sourceV2 = {
    ...sourceV1,
    version: '6.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/6.0.0/docs/resources/instance'
  };

  assert.notEqual(buildKnowledgeCacheId(sourceV1), buildKnowledgeCacheId(sourceV2));
});

test('knowledge cache writes versioned entries and detects staleness', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-cache-'));

  try {
    const source = {
      kind: 'helm-docs',
      name: 'values.schema.json',
      chart: 'payments-api',
      version: '1.2.3',
      url: 'https://helm.sh/docs/topics/charts/'
    };
    const written = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Values Schema\nUse JSON Schema for chart values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z',
      summary: 'Helm chart values schema reference.',
      metadata: {
        sourceAuthority: 'official-docs'
      }
    });
    const readBack = await readKnowledgeCacheEntry(tempRoot, source);

    assert.ok(readBack);
    assert.equal(readBack?.id, written.id);
    assert.equal(readBack?.contentHash, written.contentHash);
    assert.equal(readBack?.source.version, '1.2.3');
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-05-01T00:00:00.000Z')), false);
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-06-01T00:00:00.000Z')), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge cache root resolver uses workspace config inside the workspace', () => {
  const workspaceRoot = resolve('/tmp/infra-agent-workspace');
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot,
    workspaceConfig: {
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    },
    env: {},
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve(workspaceRoot, '.infra-agent/knowledge-cache'));
  assert.equal(resolved.source, 'workspace-config: knowledgeCache.root');
});

test('knowledge cache root resolver lets explicit env override workspace config', () => {
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot: resolve('/tmp/infra-agent-workspace'),
    workspaceConfig: {
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    },
    env: {
      INFRA_AGENT_KNOWLEDGE_CACHE: '~/infra-agent-cache'
    },
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve('/home/tester/infra-agent-cache'));
  assert.equal(resolved.source, 'environment: INFRA_AGENT_KNOWLEDGE_CACHE');
});

test('knowledge cache root resolver defaults to user cache when unconfigured', () => {
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot: resolve('/tmp/infra-agent-workspace'),
    workspaceConfig: null,
    env: {
      XDG_CACHE_HOME: '/tmp/xdg-cache'
    },
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve('/tmp/xdg-cache/infra-agent/knowledge'));
  assert.equal(resolved.source, 'default: user cache');
});

test('knowledge cache root resolver rejects workspace config paths outside the workspace', () => {
  assert.throws(
    () => resolveKnowledgeCacheRoot({
      workspaceRoot: resolve('/tmp/infra-agent-workspace'),
      workspaceConfig: {
        knowledgeCache: {
          root: '../shared-cache'
        }
      },
      env: {},
      homeDir: '/home/tester'
    }),
    /must stay inside the workspace/
  );
});

test('knowledge context retrieval uses fresh cache entries before fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fresh-'));

  try {
    const source = {
      kind: 'pulumi-docs',
      name: 'config',
      packageName: '@pulumi/pulumi',
      version: '3.0.0',
      url: 'https://www.pulumi.com/docs/iac/concepts/config/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Pulumi Config\nUse stack config for environment-specific values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Pulumi stack config task',
      now: new Date('2026-05-01T00:00:00.000Z')
    });

    assert.ok(packet);
    assert.equal(packet.confidence, 'high');
    assert.match(packet.excerpt ?? '', /Pulumi Config/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge context retrieval fetches missing sources and writes cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fetch-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'aws_instance',
      provider: 'hashicorp/aws',
      version: '5.0.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
    };
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Terraform resource docs',
      fetcher: async fetchedSource => ({
        source: fetchedSource,
        contentType: 'text/markdown',
        content: '# aws_instance\nInstance docs.',
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });
    const cached = await readKnowledgeCacheEntry(tempRoot, source);

    assert.ok(packet);
    assert.equal(packet?.confidence, 'high');
    assert.match(packet?.excerpt ?? '', /aws_instance/);
    assert.ok(cached);
    assert.equal(cached?.content, '# aws_instance\nInstance docs.');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge context retrieval falls back to stale cache when refresh is unavailable', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-stale-'));

  try {
    const source = {
      kind: 'helm-docs',
      name: 'chart-template-guide',
      version: '3.14.0',
      url: 'https://helm.sh/docs/chart_template_guide/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Helm Templates\nStale but version-scoped docs.',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      staleAfter: '2026-02-01T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Helm template task',
      now: new Date('2026-04-28T00:00:00.000Z'),
      fetcher: async () => {
        throw new Error('network unavailable');
      }
    });

    assert.ok(packet);
    assert.equal(packet?.confidence, 'medium');
    assert.match(packet?.reason ?? '', /stale cached context/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('official knowledge fetcher normalizes response content type', async () => {
  const source = {
    kind: 'terraform-registry',
    name: 'aws_instance',
    provider: 'hashicorp/aws',
    version: '5.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
  };
  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-04-28T00:00:00.000Z',
    fetchImpl: async url => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/markdown; charset=utf-8' : null
      },
      text: async () => `# fetched from ${url}`
    })
  });

  assert.ok(fetched);
  assert.equal(fetched?.contentType, 'text/markdown');
  assert.match(fetched?.content ?? '', /fetched from/);
  assert.equal(fetched?.metadata?.retrieval, 'official-url');
});

test('Terraform Registry context sources use provider requirements and lockfile versions', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-sources-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {',
        '  ami           = "ami-123456"',
        '  instance_type = "t3.micro"',
        '}',
        '',
        'data "aws_ami" "ubuntu" {',
        '  most_recent = true',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version     = "5.37.0"',
        '  constraints = "~> 5.0"',
        '  hashes      = []',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const sources = await buildTerraformRegistryKnowledgeSources(tempRoot, root);
    const instanceSource = sources.find(source => source.name === 'resource:aws_instance');
    const amiSource = sources.find(source => source.name === 'data-source:aws_ami');

    assert.ok(instanceSource);
    assert.equal(instanceSource.provider, 'hashicorp/aws');
    assert.equal(instanceSource.version, '5.37.0');
    assert.match(instanceSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/resources\/instance$/);
    assert.ok(amiSource);
    assert.match(amiSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/data-sources\/ami$/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform Registry context packets retrieve selected source docs through the cache layer', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-retrieve-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-cache-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const packets = await retrieveTerraformRegistryContextPackets({
      workspaceRoot: tempRoot,
      root,
      cacheRoot,
      reason: 'Terraform AWS resource docs for selected root',
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nVersion ${source.version} docs for ${source.provider}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'terraform-registry');
    assert.equal(packets[0]?.confidence, 'high');
    assert.match(packets[0]?.excerpt ?? '', /Version 5\.37\.0 docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads cached Terraform Registry context for Terraform tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-context-runtime-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const source = (await buildTerraformRegistryKnowledgeSources(tempRoot, root))[0];
    assert.ok(source);
    await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: '# aws_instance\nCached docs for planning.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });

    const checkingModel = {
      name: 'context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'terraform-registry'
          && packet.source.name === 'resource:aws_instance'
          && packet.confidence === 'high'
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded cached Terraform Registry context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update terraform aws instance', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet => packet.source.name === 'resource:aws_instance'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include local schema and chart docs metadata', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-sources-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        'sources:',
        '  - https://example.com/api-chart/source',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","properties":{"service":{"type":"object"}}}\n',
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const schemaSource = sources.find(source => source.kind === 'chart-schema');
    const helmDocsSource = sources.find(source => source.kind === 'helm-docs');
    const chartDocsSource = sources.find(source => source.kind === 'chart-docs' && source.name === 'api:home');

    assert.ok(schemaSource);
    assert.equal(schemaSource.localPath, 'charts/api/values.schema.json');
    assert.equal(schemaSource.version, '0.2.0');
    assert.ok(helmDocsSource);
    assert.match(helmDocsSource.url ?? '', /helm\.sh\/docs\/topics\/charts/);
    assert.ok(chartDocsSource);
    assert.equal(chartDocsSource.url, 'https://example.com/api-chart');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include chart lock and dependency repositories', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-context-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: local-helper',
        '    version: 0.1.0',
        '    repository: file://../local-helper',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const lockSource = sources.find(source => source.kind === 'chart-lock');
    const redisSource = sources.find(source => source.name === 'api:dependency:redis');
    const postgresqlSource = sources.find(source => source.name === 'api:dependency:postgresql');
    const localSource = sources.find(source => source.name === 'api:dependency:local-helper');

    assert.ok(lockSource);
    assert.equal(lockSource.localPath, 'charts/api/Chart.lock');
    assert.equal(lockSource.version, '0.2.0');
    assert.ok(redisSource);
    assert.equal(redisSource.chart, 'redis');
    assert.equal(redisSource.module, 'api');
    assert.equal(redisSource.packageName, 'redis');
    assert.equal(redisSource.version, '17.3.0');
    assert.equal(redisSource.url, 'https://charts.bitnami.com/bitnami');
    assert.ok(postgresqlSource);
    assert.equal(postgresqlSource.version, '12.1.0');
    assert.equal(localSource, undefined);

    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm dependency docs for selected chart',
      maxExternalSources: 0
    });
    const lockPacket = packets.find(packet => packet.source.kind === 'chart-lock');

    assert.ok(lockPacket);
    assert.equal(lockPacket.contentType, 'application/yaml');
    assert.match(lockPacket.excerpt ?? '', /postgresql/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('Helm chart context packets include local schema and cached external docs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-packets-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","required":["image"]}\n',
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm chart docs for selected chart',
      maxExternalSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nExternal Helm docs.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 2);
    assert.equal(packets[0]?.source.kind, 'chart-schema');
    assert.equal(packets[0]?.contentType, 'application/json');
    assert.match(packets[0]?.excerpt ?? '', /required/);
    assert.equal(packets[1]?.source.kind, 'helm-docs');
    assert.match(packets[1]?.excerpt ?? '', /External Helm docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Helm chart schema context for Helm tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-runtime-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      [
        '{',
        '  "type": "object",',
        '  "required": ["image"],',
        '  "properties": {',
        '    "image": {',
        '      "type": "object",',
        '      "required": ["repository", "tag"]',
        '    }',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'helm-context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'chart-schema'
          && packet.source.localPath === 'charts/api/values.schema.json'
          && packet.confidence === 'high'
          && packet.contentType === 'application/json'
          && packet.excerpt.includes('"repository"')
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded local Helm chart schema context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update helm chart image repository', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet =>
      packet.source.kind === 'chart-schema'
      && packet.source.name === 'api:values.schema.json'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge prefetch fetches bounded external docs and skips local schema', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-prefetch-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(terraformRoot, { recursive: true });
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","required":["image"]}\n',
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform', 'helm'],
      targetPaths: ['terraform/app', 'charts/api'],
      maxSources: 2,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nPrefetched docs for ${source.kind}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
    assert.equal(result.summary.fetched, 2);
    assert.equal(result.summary.local, 1);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.cacheRoot, join(tempRoot, '.infra-agent/knowledge-cache'));
    assert.ok(result.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'chart-schema'
      && source.source.localPath === 'charts/api/values.schema.json'
    ));
    const fetchedTerraform = result.sources.find(source =>
      source.status === 'fetched'
      && source.source.kind === 'terraform-registry'
    );
    assert.ok(fetchedTerraform);
    const cachedTerraform = await readKnowledgeCacheEntry(result.cacheRoot, fetchedTerraform.source);
    assert.match(cachedTerraform?.content ?? '', /Prefetched docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('inspectWorkspace detects scrawlr infra-apps profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-apps');
  assert.match(inspection.profile.label, /Scrawlr/);
});

test('inspectWorkspace detects scrawlr infra-cloud profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.match(inspection.profile.label, /Scrawlr/);
  const networkingProject = inspection.pulumiProjects.find(project => project.projectRoot === 'networking');
  assert.ok(networkingProject?.environmentHints.includes('non-prod'));
});

test('workspace config can pin the repo profile', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.equal(inspection.config?.profileId, 'scrawlr-infra-cloud');
  assert.equal(inspection.knowledgeCache.root, resolve('fixtures/configured-workspace/.infra-agent/knowledge-cache'));
  assert.equal(inspection.knowledgeCache.source, 'workspace-config: knowledgeCache.root');
});

test('search workspace tool finds chart and Pulumi files under the selected root', async () => {
  const result = await executeTool(
    SearchWorkspaceTool,
    {
      rootPath: 'fixtures/sample-workspace',
      fileNamePattern: '^(Chart\\.ya?ml|Pulumi(\\..+)?\\.(yaml|yml))$',
      maxResults: 10
    },
    {
      workspaceRoot: resolve('.'),
      workspaceConfig: null
    }
  );

  const matchedPaths = result.output.matches.map(match => match.path);
  assert.ok(matchedPaths.some(path => path.endsWith('fixtures/sample-workspace/charts/payments-api/Chart.yaml')));
  assert.ok(matchedPaths.some(path => path.endsWith('fixtures/sample-workspace/infra/payments-api/Pulumi.yaml')));
});

test('profile-aware targeting prefers Helm charts inside scrawlr infra-apps fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');
  const targeting = buildTargetCandidates('update reloader chart for dev', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/infra/reloader');
});

test('profile-aware targeting prefers charts/apps for app-level Helm tasks without explicit service in scrawlr infra-apps fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');
  const targeting = buildTargetCandidates('add ingress for dev chart', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/apps/app-template');
});

test('profile-aware targeting prefers Pulumi projects inside scrawlr infra-cloud fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');
  const targeting = buildTargetCandidates('update networking non-prod stack', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'pulumi-project');
  assert.equal(targeting.targetCandidates[0]?.path, 'networking');
});

test('profile-aware targeting maps dev requests onto non-prod Pulumi environment hints in infra-cloud fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');
  const targeting = buildTargetCandidates('update networking dev stack', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'pulumi-project');
  assert.equal(targeting.targetCandidates[0]?.path, 'networking');
  assert.ok(targeting.targetCandidates[0]?.matchedEnvironmentHints.includes('non-prod'));
});

test('profile-aware validation selection filters to Pulumi commands for infra-cloud fixtures', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'networking/Pulumi.non-prod.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.every(command => command.includes('pulumi preview')));
});

test('domain-aware validation selection keeps only Pulumi commands in mixed workspaces for Pulumi tasks', async () => {
  const preflight = await buildRunPreflight('update pulumi stack config for payments-api dev', 'fixtures/sample-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'infra/payments-api/Pulumi.dev.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.every(command => command.includes('pulumi preview')));
  assert.ok(commands.every(command => !command.includes('helm ')));
});

test('domain-aware validation selection keeps only Helm commands in mixed workspaces for Helm tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'charts/payments-api/values.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.some(command => command.includes('helm lint')));
  assert.ok(commands.every(command => !command.includes('pulumi preview')));
});

test('workspace config overrides validation plan entries', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');
  const validation = buildValidationPreflight(inspection);

  assert.equal(validation.usedWorkspaceConfig, true);
  assert.equal(validation.plan.length, 1);
  assert.equal(validation.plan[0]?.commands[0], 'echo custom networking validation');
});

test('buildRunPreflight records explicit approval scope', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });

  assert.deepEqual(preflight.approval.approvedWriteRisks, ['high']);
  assert.deepEqual(preflight.approval.approvedWritePaths, ['charts/payments-api']);
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write risks')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write paths')));
});

test('summarizePreflightSnapshot highlights primary target and top ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const snapshot = summarizePreflightSnapshot(preflight);

  assert.ok(snapshot.some(line => /Detected domains: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Requested domains: terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Planned domain path: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Primary target: terraform-root terraform\/network-stack/i.test(line)));
  assert.ok(snapshot.some(line => /Requested service: undetected/i.test(line)));
  assert.ok(snapshot.some(line => /Approval posture: writes with risk high require approval/i.test(line)));
  assert.ok(snapshot.some(line => /Validation readiness:/i.test(line)));
});

test('summarizePreflightSnapshot prefers the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizePreflightSnapshot(preflight);

  assert.ok(snapshot.some(line => /Primary target: helm-chart charts\/payments-api/i.test(line)));
});

test('inferRequestedDomains detects task domain focus from available domain capabilities', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');

  assert.deepEqual(
    inferRequestedDomains('add ingress to payments-api chart', inspection.domainCapabilities),
    ['helm']
  );
  assert.deepEqual(
    inferRequestedDomains('update pulumi stack config for payments-api', inspection.domainCapabilities),
    ['pulumi']
  );
});

test('buildRunPreflight records requested domains and warns when task spans multiple domains', async () => {
  const preflight = await buildRunPreflight(
    'update helm and pulumi config for payments-api dev',
    'fixtures/sample-workspace'
  );

  assert.deepEqual(preflight.requestedDomains, ['helm', 'pulumi']);
  assert.ok(preflight.assumptions.some(assumption => /multiple infrastructure domains/i.test(assumption)));
});

test('buildRunPreflight records a single requested domain for terraform-only workspaces', async () => {
  const preflight = await buildRunPreflight(
    'update terraform config for payments-api dev',
    'fixtures/terraform-workspace'
  );

  assert.deepEqual(preflight.requestedDomains, ['terraform']);
});

test('prioritizeEditPlanKinds prefers requested Terraform domain before Helm and Pulumi families', () => {
  assert.deepEqual(
    prioritizeEditPlanKinds(['terraform']),
    [
      'terraform-missing-required-argument-repair',
      'terraform-tfvars-config',
      'helm-service-port-repair',
      'helm-ingress-values-repair',
      'helm-ingress',
      'helm-probes',
      'pulumi-missing-config-repair',
      'pulumi-stack-config'
    ]
  );
});

test('prioritizeEditPlanKinds preserves requested domain order for mixed-domain tasks', () => {
  assert.deepEqual(
    prioritizeEditPlanKinds(['pulumi', 'helm']),
    [
      'pulumi-missing-config-repair',
      'pulumi-stack-config',
      'helm-service-port-repair',
      'helm-ingress-values-repair',
      'helm-ingress',
      'helm-probes',
      'terraform-missing-required-argument-repair',
      'terraform-tfvars-config'
    ]
  );
});

test('buildInspectionCandidateFiles prioritizes only Terraform files for Terraform-focused inspection', () => {
  const candidateFiles = buildInspectionCandidateFiles({
    dirName: 'terraform/payments-api',
    listedFiles: ['main.tf', 'variables.tf', 'dev.auto.tfvars', 'Pulumi.dev.yaml', 'Chart.yaml', 'values.yaml'],
    requestedDomains: ['terraform']
  });

  assert.ok(candidateFiles.some(path => path.endsWith('main.tf')));
  assert.ok(candidateFiles.some(path => path.endsWith('dev.auto.tfvars')));
  assert.ok(candidateFiles.every(path => !path.endsWith('Chart.yaml')));
  assert.ok(candidateFiles.every(path => !path.endsWith('values.yaml')));
  assert.ok(candidateFiles.every(path => !path.endsWith('Pulumi.dev.yaml')));
});

test('buildInspectionSearchPattern narrows search to requested domains', () => {
  assert.match(buildInspectionSearchPattern(['terraform']), /\.\*\\\.tf/);
  assert.doesNotMatch(buildInspectionSearchPattern(['terraform']), /Chart/);
  assert.match(buildInspectionSearchPattern(['pulumi', 'helm']), /Pulumi/);
  assert.match(buildInspectionSearchPattern(['pulumi', 'helm']), /Chart/);
  assert.doesNotMatch(buildInspectionSearchPattern(['pulumi', 'helm']), /\.\*\\\.tf/);
});

test('inspectWorkspace resolves specialized domain capabilities for mixed infra workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');

  assert.deepEqual(
    inspection.domainCapabilities.map(domain => domain.id),
    ['helm', 'pulumi']
  );
  const helmCapability = inspection.domainCapabilities.find(domain => domain.id === 'helm');
  const pulumiCapability = inspection.domainCapabilities.find(domain => domain.id === 'pulumi');
  assert.ok(helmCapability?.boundedEditKinds.includes('helm-ingress'));
  assert.ok(helmCapability?.validatorCommands.includes('helm lint'));
  assert.ok(pulumiCapability?.boundedEditKinds.includes('pulumi-stack-config'));
  assert.ok(pulumiCapability?.supportedTaskKinds.some(kind => /stack config/i.test(kind)));
});

test('inspectWorkspace resolves Terraform domain capability for terraform-only workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');

  assert.deepEqual(inspection.domainCapabilities.map(domain => domain.id), ['terraform']);
  assert.equal(inspection.domainCapabilities[0]?.detectedTargets, 1);
  assert.ok(inspection.domainCapabilities[0]?.validatorCommands.includes('terraform validate'));
});

test('summarizePreflightSuggestedCommands recommends inspect and rerun when preflight has ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(!commands.some(command => /validate/.test(command)));
  assert.ok(!commands.some(command => /main\.ts agent /.test(command)));
});

test('summarizePreflightSuggestedCommands recommends agent when preflight is ready to proceed', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /agent/.test(command)));
});

test('summarizeFocusedDomainCapabilities prioritizes requested domains', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const lines = summarizeFocusedDomainCapabilities(inspection.domainCapabilities, ['helm']);

  assert.match(lines[0] ?? '', /^Helm:/);
  assert.match(lines[0] ?? '', /\[requested\]$/);
  assert.match(lines[1] ?? '', /^Pulumi:/);
});

test('summarizeFocusedValidationPlan prioritizes requested domain entries', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const lines = summarizeFocusedValidationPlan(preflight.validation.plan, ['helm']);

  assert.match(lines[0] ?? '', /^helm charts\/payments-api:/);
  assert.match(lines[0] ?? '', /\[requested\]$/);
  assert.match(lines[1] ?? '', /^helm charts\/payments-api:/);
  assert.match(lines[2] ?? '', /^pulumi infra\/payments-api:/);
});

test('buildRunPreflight filters unrelated domain blockers for Helm-only tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(preflight.blockers.every(blocker => !blocker.includes('Terraform')));
  assert.ok(preflight.blockers.every(blocker => !blocker.includes('Pulumi')));
});

test('summarizePreflightSuggestedCommands recommends agent for ready Helm-only workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /agent/.test(command)));
});

test('buildRunPreflight filters unrelated domain next actions for Helm-only tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(preflight.nextActions.some(action => /Read the target Helm chart files/i.test(action)));
  assert.ok(preflight.nextActions.some(action => /Use Helm validators as the mandatory refinement loop/i.test(action)));
  assert.ok(preflight.nextActions.every(action => !action.includes('Pulumi project')));
  assert.ok(preflight.nextActions.every(action => !action.includes('Terraform root')));
});

test('buildRunPreflight exposes effective approval policy from profile defaults', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');

  assert.equal(preflight.profile.id, 'scrawlr-infra-cloud');
  assert.deepEqual(preflight.effectiveApprovalPolicy.requiredWriteRisks, ['medium', 'high']);
  assert.equal(preflight.effectiveApprovalPolicy.pathRules.length, 0);
  assert.ok(preflight.effectiveApprovalPolicy.sources.some(source => source.includes('profile-default')));
});

test('resolveEffectiveApprovalPolicy exposes workspace config overrides', () => {
  const effectivePolicy = resolveEffectiveApprovalPolicy(
    {
      approvalPolicy: {
        requiredWriteRisks: ['medium'],
        pathRules: [
          {
            path: './charts/payments-api/',
            requiredWriteRisks: ['high']
          }
        ]
      }
    },
    'generic'
  );

  assert.deepEqual(effectivePolicy.requiredWriteRisks, ['medium']);
  assert.deepEqual(effectivePolicy.pathRules, [
    {
      path: 'charts/payments-api',
      requiredWriteRisks: ['high']
    }
  ]);
  assert.deepEqual(effectivePolicy.sources, ['workspace-config: approvalPolicy']);
});

test('buildRunPreflight exposes effective edit policy from profile defaults', async () => {
  const preflight = await buildRunPreflight('update app-template chart for dev', 'fixtures/scrawlr-infra-apps-workspace');

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.deepEqual(preflight.effectiveEditPolicy.allowedEditPlanKinds, [
    'helm-ingress',
    'helm-probes',
    'helm-service-port-repair',
    'helm-ingress-values-repair'
  ]);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixes, ['charts/apps', 'charts/infra']);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixesByKind, {
    'helm-ingress': ['charts/apps'],
    'helm-probes': ['charts/apps'],
    'helm-service-port-repair': ['charts/apps'],
    'helm-ingress-values-repair': ['charts/apps']
  });
  assert.ok(preflight.effectiveEditPolicy.sources.some(source => source.includes('profile-default')));
});

test('buildRunPreflight constrains generic terraform-only workspaces to tfvars edit plans', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');

  assert.equal(preflight.profile.id, 'generic');
  assert.deepEqual(preflight.effectiveEditPolicy.allowedEditPlanKinds, [
    'terraform-missing-required-argument-repair',
    'terraform-tfvars-config'
  ]);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixes, ['terraform/payments-api']);
  assert.ok(preflight.effectiveEditPolicy.sources.some(source => source.includes('terraform-only generic workspace')));
});

test('buildRunPreflight asks for clarification before creating tfvars in generic terraform-only workspaces', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-no-tfvars-workspace');

  assert.ok(preflight.assumptions.some(assumption => /has no existing tfvars file/i.test(assumption)));
});

test('buildRunPreflight asks for clarification before selecting among multiple tfvars files without an explicit environment', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api image tag to 2.3.4', 'fixtures/terraform-multi-tfvars-workspace');

  assert.ok(preflight.assumptions.some(assumption => /multiple tfvars files/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /which environment or tfvars file should be updated/i.test(assumption)));
});

test('buildRunPreflight asks for clarification when requested Terraform environment violates enum semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api qa image tag to 2.3.4', 'fixtures/terraform-workspace');

  assert.ok(preflight.assumptions.some(assumption =>
    /Requested Terraform environment is not allowed/i.test(assumption)
    && /var\.environment allows dev, stage, prod/i.test(assumption)
    && /requested value is qa/i.test(assumption)
  ));
});

test('resolveEffectiveEditPolicy exposes workspace config overrides', () => {
  const effectivePolicy = resolveEffectiveEditPolicy(
    {
      editPolicy: {
        allowedEditPlanKinds: ['pulumi-stack-config'],
        allowedTargetPrefixes: ['./networking/'],
        allowedTargetPrefixesByKind: {
          'pulumi-stack-config': ['./networking/']
        }
      }
    },
    'scrawlr-infra-apps'
  );

  assert.deepEqual(effectivePolicy.allowedEditPlanKinds, ['pulumi-stack-config']);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixes, ['networking']);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixesByKind, {
    'pulumi-stack-config': ['networking']
  });
  assert.deepEqual(effectivePolicy.sources, ['workspace-config: editPolicy']);
});

test('resolveEffectiveEditPolicy derives terraform root prefixes for generic terraform-only inspections', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const effectivePolicy = resolveEffectiveEditPolicy(null, 'generic', inspection);

  assert.deepEqual(effectivePolicy.allowedEditPlanKinds, [
    'terraform-missing-required-argument-repair',
    'terraform-tfvars-config'
  ]);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixes, [
    'terraform/network-stack',
    'terraform/worker-stack'
  ]);
});

test('buildEditPlan filters write modes disallowed by workspace policy', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const deploymentPath = resolve('fixtures/sample-workspace/charts/payments-api/templates/deployment.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          writePolicy: {
            allowedModes: ['append', 'create']
          }
        }
      }
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: deploymentPath,
          content: await readFile(deploymentPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.ok(editPlan?.writes.every(write => write.mode !== 'replace' && write.mode !== 'rewrite'));
  assert.ok(editPlan?.writes.some(write => write.path.endsWith('values.yaml')));
});

test('buildEditPlan classifies ingress writes as append and create', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
          content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  const ingressWrite = editPlan?.writes.find(write => write.path.endsWith('templates/ingress.yaml'));
  assert.equal(valuesWrite?.mode, 'append');
  assert.equal(ingressWrite?.mode, 'create');
});

test('buildEditPlan blocks Helm plans outside profile-scoped target prefixes', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      profile: {
        id: 'scrawlr-infra-apps',
        label: 'Scrawlr Infra Apps',
        reasons: ['synthetic edit-policy test']
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(null, 'scrawlr-infra-apps')
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan blocks scrawlr infra-apps ingress plans for charts/infra targets', async () => {
  const preflight = await buildRunPreflight('add ingress to reloader dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/infra/reloader/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.equal(preflight.targetCandidates[0]?.path, 'charts/infra/reloader');
  assert.equal(editPlan, null);
});

test('buildEditPlan allows scrawlr infra-apps ingress plans for charts/apps targets', async () => {
  const preflight = await buildRunPreflight('add ingress to app-template dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/apps/app-template/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'helm-ingress');
  assert.ok(editPlan?.writes.every(write => write.path.startsWith('charts/apps/app-template/')));
  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  assert.match(valuesWrite?.content ?? '', /\nservice:\n  port: 8080\ningress:\n/);
  assert.match(valuesWrite?.reason ?? '', /service\.port/);
});

test('buildEditPlan does not inject a default service.port into generic ingress plans when one already exists or the profile is not infra-apps', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  assert.ok(valuesWrite);
  assert.doesNotMatch(valuesWrite?.content ?? '', /\nservice:\n  port: 8080\n\ningress:\n/);
});

test('buildEditPlan uses Helm values schema enum facts for ingress className', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-schema-enum-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await writeFile(
      join(workspaceRoot, 'charts/payments-api/values.schema.json'),
      JSON.stringify({
        type: 'object',
        properties: {
          ingress: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                enum: ['alb']
              }
            }
          }
        }
      }, null, 2),
      'utf8'
    );

    const preflight = await buildRunPreflight('add ingress to payments-api dev chart', workspaceRoot);
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const editPlan = buildEditPlan({
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: valuesPath,
            content: await readFile(valuesPath, 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    });

    const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
    assert.match(valuesWrite?.content ?? '', /\n  className: alb\n/);
    assert.match(editPlan?.rationale ?? '', /allows alb/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildEditPlan respects workspace-config kind-scoped target prefix overrides', async () => {
  const preflight = await buildRunPreflight('add ingress to app-template dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/apps/app-template/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          editPolicy: {
            allowedEditPlanKinds: ['helm-ingress'],
            allowedTargetPrefixes: ['charts/apps'],
            allowedTargetPrefixesByKind: {
              'helm-ingress': ['charts/apps/other-service']
            }
          }
        }
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(
        {
          editPolicy: {
            allowedEditPlanKinds: ['helm-ingress'],
            allowedTargetPrefixes: ['charts/apps'],
            allowedTargetPrefixesByKind: {
              'helm-ingress': ['charts/apps/other-service']
            }
          }
        },
        'scrawlr-infra-apps'
      )
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan blocks Pulumi plans under scrawlr infra-apps profile defaults', async () => {
  const preflight = await buildRunPreflight(
    'update pulumi dev stack for payments-api image tag to 1.2.3',
    'fixtures/sample-workspace'
  );
  const stackPath = resolve('fixtures/sample-workspace/infra/payments-api/Pulumi.dev.yaml');
  const projectPath = resolve('fixtures/sample-workspace/infra/payments-api/Pulumi.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      profile: {
        id: 'scrawlr-infra-apps',
        label: 'Scrawlr Infra Apps',
        reasons: ['synthetic kind restriction test']
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(null, 'scrawlr-infra-apps')
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan maps scrawlr infra-cloud dev requests to existing non-prod stack files', async () => {
  const preflight = await buildRunPreflight(
    'update networking dev stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'pulumi-stack-config');
  assert.equal(editPlan?.writes[0]?.path, 'networking/Pulumi.non-prod.yaml');
});

test('buildEditPlan does not create new scrawlr infra-cloud prod stack files when no matching stack exists', async () => {
  const preflight = await buildRunPreflight(
    'update networking prod stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan reuses existing scrawlr infra-cloud config namespace from stack file', async () => {
  const preflight = await buildRunPreflight(
    'update networking dev stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: 'name: shared-networking\nruntime: yaml\ndescription: Synthetic project name drift\nresources: {}\n',
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  const writeContent = editPlan?.writes[0]?.content ?? '';
  assert.match(writeContent, /networking:imageTag:\s+1\.2\.3/);
  assert.doesNotMatch(writeContent, /shared-networking:imageTag:/);
});

test('buildEditPlan reuses Pulumi config semantics before project-name fallback', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-semantics-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await writeFile(
      join(workspaceRoot, 'infra/payments-api/Pulumi.yaml'),
      [
        'name: shared-payments',
        'runtime: yaml',
        'description: Synthetic project name drift',
        'config:',
        '  payments-api:environment:',
        '    type: string',
        '  payments-api:imageTag:',
        '    type: string',
        'resources: {}',
        ''
      ].join('\n'),
      'utf8'
    );

    const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 3.4.5', workspaceRoot);
    const projectPath = join(workspaceRoot, 'infra/payments-api/Pulumi.yaml');
    const stackPath = join(workspaceRoot, 'infra/payments-api/Pulumi.dev.yaml');
    const editPlan = buildEditPlan({
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: projectPath,
            content: await readFile(projectPath, 'utf8'),
            truncated: false
          }
        },
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: stackPath,
            content: await readFile(stackPath, 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    });

    assert.ok(editPlan);
    const writeContent = editPlan?.writes[0]?.content ?? '';
    assert.match(editPlan?.rationale ?? '', /payments-api:environment and payments-api:imageTag/);
    assert.match(writeContent, /payments-api:imageTag:\s+3\.4\.5/);
    assert.doesNotMatch(writeContent, /shared-payments:imageTag:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildEditPlan normalizes scrawlr infra-cloud environment config values away from full stack names', async () => {
  const preflight = await buildRunPreflight(
    'update eks non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  const writeContent = editPlan?.writes[0]?.content ?? '';
  assert.match(writeContent, /eks:environment:\s+non-prod/);
  assert.doesNotMatch(writeContent, /eks:environment:\s+tenant-shared\.non-prod/);
});

test('buildEditPlan prefers qualifier-specific scrawlr infra-cloud stacks when task requests tenant-shared', async () => {
  const preflight = await buildRunPreflight(
    'update eks tenant-shared non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.writes[0]?.path, 'eks/Pulumi.tenant-shared.non-prod.yaml');
});

test('buildEditPlan does not fall back to unrelated scrawlr infra-cloud qualifier stacks', async () => {
  const preflight = await buildRunPreflight(
    'update eks global non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan classifies probe deployment update as replace', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const deploymentPath = resolve('fixtures/sample-workspace/charts/payments-api/templates/deployment.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: deploymentPath,
          content: await readFile(deploymentPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  const deploymentWrite = editPlan?.writes.find(write => write.path.endsWith('templates/deployment.yaml'));
  assert.equal(deploymentWrite?.mode, 'replace');
  assert.ok(deploymentWrite?.replacePatch?.before);
  assert.ok(deploymentWrite?.replacePatch?.after);
});

test('workspace write policy blocks non-allowed chart edits during preflight', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');

  assert.ok(
    preflight.blockers.some(blocker => blocker.includes('Workspace write policy does not allow edits under charts/payments-api'))
  );
});

test('rule-based agent asks for clarification when write policy blocks the top target', async () => {
  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/restricted-workspace',
    undefined,
    'rule-based'
  );

  assert.equal(result.turns[0]?.decision.action.kind, 'ask-for-clarification');
  assert.match(result.turns[0]?.decision.action.summary ?? '', /writable target boundaries/i);
});

test('rule-based planner asks for clarification before high-risk rewrite edits', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'The planned rewrite change at charts/payments-api/values.yaml has risk=high. Approval is required before applying this edit.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /high-risk rewrite/i);
  assert.equal(decision.action.payload?.clarificationKind, 'approval-required');
});

test('collectApprovalSignals respects workspace approval policy overrides', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: []
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-ingress',
      summary: 'Rewrite values file.',
      rationale: 'Synthetic rewrite test.',
      writes: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Rewrite test',
          mode: 'rewrite',
          risk: 'high'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
});

test('collectApprovalSignals applies path-scoped approval rules for medium-risk writes', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            pathRules: [
              {
                path: 'charts/payments-api',
                requiredWriteRisks: ['medium']
              }
            ]
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Update deployment template and values.',
      rationale: 'Synthetic path-scoped approval test.',
      writes: [
        {
          path: 'charts/payments-api/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Scoped replace',
          mode: 'replace',
          risk: 'medium'
        },
        {
          path: 'charts/other-service/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Unscoped replace',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'charts/payments-api/templates/deployment.yaml');
  assert.equal(signals[0]?.risk, 'medium');
});

test('scrawlr infra-apps profile applies default medium-risk approval on app-template and charts/infra paths', async () => {
  const preflight = await buildRunPreflight('update app-template chart for dev', 'fixtures/scrawlr-infra-apps-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Synthetic medium-risk edits in infra-apps profile.',
      rationale: 'Default profile approval policy test.',
      writes: [
        {
          path: 'charts/apps/app-template/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Profile-scoped replace in app-template',
          mode: 'replace',
          risk: 'medium'
        },
        {
          path: 'charts/infra/reloader/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Profile-scoped replace in charts/infra',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.equal(signals.length, 2);
  assert.ok(signals.some(signal => signal.path === 'charts/apps/app-template/templates/deployment.yaml'));
  assert.ok(signals.some(signal => signal.path === 'charts/infra/reloader/templates/deployment.yaml'));
});

test('scrawlr infra-cloud profile applies default medium-risk approval globally', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'pulumi-stack-config',
      summary: 'Synthetic medium-risk edit in infra-cloud profile.',
      rationale: 'Default profile approval policy test.',
      writes: [
        {
          path: 'networking/Pulumi.non-prod.yaml',
          content: 'config:\n  networking:test: value\n',
          reason: 'Profile-scoped replace in infra-cloud',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(preflight.profile.id, 'scrawlr-infra-cloud');
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'networking/Pulumi.non-prod.yaml');
  assert.equal(signals[0]?.risk, 'medium');
});

test('collectApprovalSignals suppresses matching explicit approval grants only for the approved path scope', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-ingress',
      summary: 'Rewrite values file.',
      rationale: 'Synthetic rewrite test.',
      writes: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Approved rewrite',
          mode: 'rewrite',
          risk: 'high'
        },
        {
          path: 'charts/other-service/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Unapproved rewrite',
          mode: 'rewrite',
          risk: 'high'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'charts/other-service/values.yaml');
});

test('explicit approval scope can suppress path-scoped medium-risk approval signals', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['medium'],
    approvedWritePaths: ['charts/payments-api']
  });
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            pathRules: [
              {
                path: 'charts/payments-api',
                requiredWriteRisks: ['medium']
              }
            ]
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Update deployment template and values.',
      rationale: 'Synthetic explicit approval test for path-scoped rules.',
      writes: [
        {
          path: 'charts/payments-api/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Scoped replace',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
});

test('rule-based planner proceeds with apply-edit-plan after explicit approval covers a high-risk rewrite', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval continuation test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite continuation test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'apply-edit-plan');
});

test('rule-based agent repairs missing service.port after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-service-port-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution emits diff preview before write', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-diff-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply bounded values update.',
          rationale: 'Test diff preview output.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 2\n',
                reason: 'Test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax', 'write_file', 'validate_yaml_syntax']
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan validates YAML syntax before writing YAML files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-preflight-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply invalid YAML.',
          rationale: 'Test YAML syntax gate.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'ingress:\n  hosts: [\n',
                reason: 'Invalid YAML test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax']
    );
    assert.equal(execution?.executedTools[1]?.output.result.exitCode, 1);
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep preserves YAML syntax failures found during apply-edit-plan', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-runtime-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'write invalid YAML to payments-api values',
      workspaceRoot,
      {
        name: 'invalid-yaml-test-planner',
        async decideNextAction({ runtime }) {
          if (runtime.validationIssues.length > 0) {
            return {
              confidence: 'high',
              action: {
                kind: 'stop',
                summary: 'Stop after YAML validation failure.',
                rationale: 'The runtime preserved the YAML syntax blocker.',
                payload: {
                  stopReason: 'validation-blocked'
                }
              }
            };
          }

          return {
            confidence: 'high',
            action: {
              kind: 'apply-edit-plan',
              summary: 'Apply invalid YAML.',
              rationale: 'Synthetic planner output for YAML validation.',
              payload: {
                writes: [
                  {
                    path: 'charts/payments-api/values.yaml',
                    content: 'ingress:\n  hosts: [\n',
                    reason: 'Invalid YAML test write'
                  }
                ]
              }
            }
          };
        }
      },
      'rule-based'
    );

    assert.equal(result.outcome, 'validation-blocked');
    assert.equal(result.runtime.validationIssues[0]?.kind, 'yaml-syntax-failure');
    assert.ok(result.runtime.validationResults.some(entry => entry.command.includes('yaml-parse')));
    assert.equal(result.runtime.appliedWrites.length, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep records deterministic tool execution summaries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-tool-summary-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Loaded Helm values for charts/payments-api')));
    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Previewed diff for charts/payments-api/values.yaml')));
    assert.ok(result.runtime.toolSummaries.every(summary => typeof summary.turnIndex === 'number'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveQueryLoopConfig keeps bounded defaults and normalizes overrides', () => {
  assert.equal(resolveQueryLoopConfig().maxTurns, 6);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 2.8 }).maxTurns, 2);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 0 }).maxTurns, 1);
});

test('runSingleStep respects the configured maximum turn count', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-turn-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      { maxTurns: 1 }
    );

    assert.equal(result.turns.length, 1);
    assert.equal(result.outcome, 'no-safe-action');
    assert.ok(result.runtime.toolSummaries.some(summary => summary.actionKind === 'inspect-target-files'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent CLI args accept --max-turns for bounded loop control', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--planner',
    'rule-based',
    '--max-turns',
    '1',
    '--json'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.task, 'add ingress to payments-api dev chart');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.planner, 'rule-based');
  assert.equal(parsed.maxTurns, 1);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, false);
});

test('agent CLI args accept --json-full for full debug state output', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--json-full'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, true);
});

test('prefetch CLI args accept bounded source selection flags', () => {
  const parsed = parseArgs([
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '2',
    '--json'
  ]);

  assert.equal(parsed.command, 'prefetch');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.maxSources, 2);
  assert.equal(parsed.json, true);
});

test('graph CLI args accept workspace and json flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Terraform plan impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/terraform-workspace',
    '--terraform-plan',
    'plan.json',
    '--target',
    'terraform/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/terraform-workspace');
  assert.deepEqual(parsed.terraformPlanPaths, ['plan.json']);
  assert.deepEqual(parsed.targetPaths, ['terraform/payments-api']);
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Pulumi preview impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--pulumi-preview',
    'preview.json',
    '--target',
    'infra/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.pulumiPreviewPaths, ['preview.json']);
  assert.deepEqual(parsed.targetPaths, ['infra/payments-api']);
  assert.equal(parsed.json, true);
});

test('apply-edit-plan execution uses append_file for append-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-append-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const existingValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Append bounded values update.',
          rationale: 'Test append tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: `${existingValues.trimEnd()}\n\nfeatureFlag:\n  enabled: true\n`,
                reason: 'Append test block',
                mode: 'append'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'validate_yaml_syntax');
    assert.equal(execution?.executedTools[2]?.toolName, 'append_file');
    assert.equal(execution?.executedTools[3]?.toolName, 'validate_yaml_syntax');
    const updatedValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    assert.match(updatedValues, /featureFlag:\n  enabled: true/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses replace_file for replace-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-replace-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const deploymentPath = join(workspaceRoot, 'charts/payments-api/templates/deployment.yaml');
    const existingDeployment = await readFile(deploymentPath, 'utf8');
    const before = '          resources:\n';
    const after = [
      '          readinessProbe:',
      '            httpGet:',
      '              path: /healthz',
      '              port: http',
      '          resources:\n'
    ].join('\n');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Replace bounded deployment segment.',
          rationale: 'Test replace tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/templates/deployment.yaml',
                content: existingDeployment.replace(before, after),
                reason: 'Insert readiness probe block',
                mode: 'replace',
                replacePatch: {
                  before,
                  after
                }
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'replace_file');
    const updatedDeployment = await readFile(deploymentPath, 'utf8');
    assert.match(updatedDeployment, /readinessProbe:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('PulumiConfigSetTool applies bounded stack config updates through the Pulumi CLI', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-config-set-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await executeTool(
      PulumiConfigSetTool,
      {
        projectRoot: 'infra/payments-api',
        stackName: 'dev',
        key: 'payments-api:imageTag',
        value: '9.9.9'
      },
      {
        workspaceRoot,
        workspaceConfig: null
      }
    );

    assert.equal(result.toolName, 'pulumi_config_set');
    assert.equal(result.output.exitCode, 0);
    assert.equal(result.output.stackFilePath, 'infra/payments-api/Pulumi.dev.yaml');
    assert.match(result.output.content, /payments-api:imageTag: 9\.9\.9/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses pulumi_config_set for Pulumi stack config plans', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-apply-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply Pulumi stack configuration updates.',
          rationale: 'Use the native Pulumi CLI for bounded stack config writes.',
          payload: {
            editPlan: {
              kind: 'pulumi-stack-config',
              summary: 'Apply Pulumi stack configuration updates to infra/payments-api/Pulumi.dev.yaml.',
              rationale: 'Synthetic Pulumi config write.',
              pulumiConfigOperations: [
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:environment',
                  value: 'dev'
                },
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:imageTag',
                  value: '2.4.6'
                }
              ],
              writes: [
                {
                  path: 'infra/payments-api/Pulumi.dev.yaml',
                  content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                  reason: 'Synthetic Pulumi stack config write.'
                }
              ]
            },
            writes: [
              {
                path: 'infra/payments-api/Pulumi.dev.yaml',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                reason: 'Synthetic Pulumi stack config write.'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.ok(execution?.executedTools.some(tool => tool.toolName === 'pulumi_config_set'));
    assert.ok(execution?.executedTools.every(tool => tool.toolName !== 'write_file'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution blocks writes disallowed by workspace mode policy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-mode-policy-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Blocked rewrite write.',
          rationale: 'Test workspace mode policy.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 3\n',
                reason: 'Rewrite test',
                mode: 'rewrite'
              }
            ]
          }
        }
      },
      workspaceRoot,
      {
        writePolicy: {
          allowedModes: ['append', 'create', 'replace']
        }
      }
    );

    assert.ok(execution);
    assert.equal(execution?.status, 'skipped');
    assert.match(execution?.reason ?? '', /write mode/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('classifyValidationIssues marks ingress.enabled failures as repairable', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-ingress-values');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define the ingress block in values\.yaml/i);
});

test('classifyValidationIssues adds actionable guidance for missing Helm service.port', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-service-port');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define service\.port in values\.yaml/i);
});

test('classifyValidationIssues marks YAML syntax failures as blockers', () => {
  const issues = classifyValidationIssues([
    {
      command: 'infra-agent yaml-parse charts/payments-api/values.yaml',
      exitCode: 1,
      stdout: 'parser: python:pyyaml',
      stderr: 'while parsing a flow sequence'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'yaml-syntax-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.yamlPath, 'charts/payments-api/values.yaml');
  assert.equal(issues[0]?.metadata?.yamlParser, 'python:pyyaml');
  assert.match(issues[0]?.guidance ?? '', /Fix the planned YAML content/i);
});

test('planner system prompt documents explicit stop reasons', () => {
  const prompt = buildPlannerSystemPrompt();

  assert.match(prompt, /Allowed stop payload\.stopReason values:/);
  assert.match(prompt, /Allowed ask-for-clarification payload\.clarificationKind values:/);
  assert.match(prompt, /repair-budget-exhausted/);
  assert.match(prompt, /validation-succeeded/);
});

test('planner user prompt includes focused config semantics', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'charts/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'service.port')
  ));
});

test('planner user prompt includes focused Terraform variable semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'terraform/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'var.image_tag')
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'terraform/payments-api'
    && summary.facts.some(fact => fact.kind === 'enum' && fact.path === 'var.environment')
  ));
});

test('planner user prompt includes compact retrieved context packets', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    retrievedContext: [
      {
        id: 'terraform-registry-aws-instance',
        source: {
          kind: 'terraform-registry',
          name: 'resource:aws_instance',
          provider: 'hashicorp/aws',
          version: '5.37.0',
          url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
        },
        confidence: 'high',
        reason: 'Terraform Registry docs for selected root terraform/payments-api',
        contentType: 'text/markdown',
        excerpt: '# aws_instance\nUse instance_type for EC2 shape.',
        tokenEstimate: 12
      }
    ],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.retrievedContext[0]?.source.name, 'resource:aws_instance');
  assert.equal(parsed.retrievedContext[0]?.source.version, '5.37.0');
  assert.match(parsed.retrievedContext[0]?.excerpt ?? '', /instance_type/);
});

test('planner user prompt includes focused Pulumi config semantics', async () => {
  const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 2.3.4', 'fixtures/sample-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'configured-field' && fact.path === 'config.payments-api:imageTag')
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'type-constraint' && fact.path === 'config.payments-api:environment')
  ));
});

test('Pulumi missing-config validation issues are promoted into config semantics', async () => {
  const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 2.3.4', 'fixtures/sample-workspace');
  const sourceCommand = preflight.validation.plan
    .find(entry => entry.kind === 'pulumi' && entry.target === 'infra/payments-api' && entry.commands.some(command => /--stack dev\b/.test(command)))
    ?.commands[0];
  assert.ok(sourceCommand);
  const runtime = {
    task: preflight.task,
    preflight,
    configSemantics: [...preflight.inspection.configSemantics],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand,
        message: 'missing required configuration variable "payments-api:imageTag"',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const derivedSemantics = deriveConfigSemanticsFromValidationIssues(runtime);
  const mergedSemantics = mergeConfigSemantics(runtime.configSemantics, derivedSemantics);
  const prompt = buildPlannerUserPrompt({
    ...runtime,
    configSemantics: mergedSemantics
  });
  const parsed = JSON.parse(prompt);

  assert.ok(derivedSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'config.payments-api:imageTag'
      && fact.source.kind === 'pulumi-preview'
    )
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'config.payments-api:imageTag')
  ));
});

test('parsePlannerDecision requires stopReason for stop actions', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.throws(
    () =>
      parsePlannerDecision(
        JSON.stringify({
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Stop here',
            rationale: 'No further work'
          }
        }),
        {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      ),
    /action\.payload\.stopReason/
  );
});

test('parsePlannerDecision accepts supported stopReason values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'stop',
        summary: 'Validation passed',
        rationale: 'All configured validators succeeded.',
        payload: {
          stopReason: 'validation-succeeded'
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-succeeded');
});

test('parsePlannerDecision accepts supported clarificationKind values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'ask-for-clarification',
        summary: 'Approval required',
        rationale: 'High-risk rewrite detected.',
        payload: {
          clarificationKind: 'approval-required',
          questions: ['Proceed with this rewrite?']
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'approval-required');
});

test('runSingleStep returns approval-required outcome for approval clarification turns', async () => {
  const approvalModel = {
    name: 'approval-test-model',
    async decideNextAction() {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Approval required',
          rationale: 'Synthetic approval gate.',
          payload: {
            clarificationKind: 'approval-required',
            questions: ['Proceed with this rewrite?']
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/sample-workspace',
    approvalModel
  );

  assert.equal(result.outcome, 'approval-required');
});

test('summarizeRecommendedNextSteps suggests approval continuation for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Approval required',
            rationale: 'High-risk write needs approval.',
            payload: {
              clarificationKind: 'approval-required',
              questions: ['Proceed with this rewrite?']
            }
          }
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(steps.some(step => /approve the flagged write risk or write path/i.test(step)));
  assert.ok(steps.some(step => /--approve-write-risk/i.test(step)));
});

test('summarizeSuggestedCommands includes approval continuation flags for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'Approval required.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands[0]?.includes('agent'));
  assert.ok(commands[0]?.includes('--approve-write-risk high'));
  assert.ok(commands[0]?.includes('--approve-write-path "charts/payments-api/values.yaml"'));
});

test('summarizeSuggestedCommands includes review and export commands for completed runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries: [
        {
          turnIndex: 0,
          actionKind: 'apply-edit-plan',
          toolName: 'pulumi_config_set',
          safety: 'write_scoped',
          summary: 'Set Pulumi config payments-api:imageTag in infra/payments-api/Pulumi.dev.yaml'
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'ingress:\n  enabled: true\n',
          reason: 'Enable ingress.'
        }
      ],
      validationResults: [
        {
          command: 'helm lint charts/payments-api',
          cwd: 'fixtures/sample-workspace',
          exitCode: 0,
          stdout: 'lint ok',
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /helm show values "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /agent "add ingress to payments-api dev chart".*--json/.test(command)));
});

test('summarizeRecommendedNextSteps surfaces Terraform validation guidance for blocked runs', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument',
          guidance: 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Validation failed and no bounded repair action was available.',
            rationale: 'Terraform validate failed.',
            payload: {
              stopReason: 'validation-blocked'
            }
          }
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          toolSummaries: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(steps.some(step => /add the missing required argument through an existing tfvars file/i.test(step)));
  assert.ok(steps.some(step => /terraform-root target terraform\/payments-api/i.test(step)));
});

test('summarizeAgentSnapshot highlights validation failure and approval count', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Outcome: validation-blocked/i.test(line)));
  assert.ok(snapshot.some(line => /Primary domain: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Active bounded path: Terraform -> validation/i.test(line)));
  assert.ok(snapshot.some(line => /Primary target: terraform-root terraform\/payments-api/i.test(line)));
  assert.ok(snapshot.some(line => /Validation status: failed/i.test(line)));
  assert.ok(snapshot.some(line => /Top validation issue: terraform-validate-failure/i.test(line)));
});

test('summarizeAgentSnapshot prefers the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Primary target: helm-chart charts\/payments-api/i.test(line)));
});

test('summarizeAgentSnapshot surfaces the active bounded edit path when an edit plan exists', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Apply ingress.',
        rationale: 'Test bounded path summary.',
        writes: []
      }
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Active bounded path: Helm -> helm-ingress/i.test(line)));
});

test('summarizeResultCard highlights changed files, native CLI usage, validators, and repairs', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries: [
        {
          turnIndex: 0,
          actionKind: 'apply-edit-plan',
          toolName: 'pulumi_config_set',
          safety: 'write_scoped',
          summary: 'Set Pulumi config payments-api:imageTag in infra/payments-api/Pulumi.dev.yaml'
        }
      ],
      appliedWrites: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Applied via pulumi_config_set tool.'
        }
      ],
      validationResults: [
        {
          command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 0,
          stdout: '',
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 1,
      lastEditPlan: {
        kind: 'pulumi-missing-config-repair',
        summary: 'Repair missing Pulumi config.',
        rationale: 'Test result summary.',
        writes: [
          {
            path: 'infra/payments-api/Pulumi.dev.yaml',
            content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
            reason: 'Synthetic write.'
          }
        ]
      }
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'apply-edit-plan',
            summary: 'Repair missing Pulumi config.',
            rationale: 'Use Pulumi CLI.',
            payload: {
              actionFamily: 'pulumi-bounded-edit'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'pulumi_config_set',
              safety: 'write_scoped',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                projectRoot: 'infra/payments-api',
                stackName: 'dev',
                key: 'payments-api:imageTag',
                value: '1.2.3',
                stackFilePath: 'infra/payments-api/Pulumi.dev.yaml',
                command: 'pulumi config set',
                exitCode: 0,
                stdout: '',
                stderr: '',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          toolSummaries: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Run posture: validated and ready for review/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Pulumi target infra\/payments-api with 1 changed file\(s\)/i.test(line)));
  assert.ok(summary.some(line => /Open concern: none/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the selected Pulumi stack file, config keys, and preview output\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: infra\/payments-api\/Pulumi\.dev\.yaml, config key payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Review command: .*pulumi preview .*infra\/payments-api.*--stack dev/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run .*pulumi preview .*infra\/payments-api.*--stack dev.*review the bounded change before merging or handing off the update\./i.test(line)));
  assert.ok(summary.some(line => /Tool trace: t0:Set Pulumi config payments-api:imageTag in infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Changed files: infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Pulumi CLI/i.test(line)));
  assert.ok(summary.some(line => /Native CLI findings: Pulumi config updated payments-api:imageTag on stack dev/i.test(line)));
  assert.ok(summary.some(line => /Validators executed: 1 command\(s\) across Pulumi/i.test(line)));
  assert.ok(summary.some(line => /Validation findings: none/i.test(line)));
  assert.ok(summary.some(line => /Repair activity: 1 bounded repair attempt/i.test(line)));
});

test('summarizeResultCard includes Helm CLI usage when helm_show_values is executed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'inspect-target-files',
            summary: 'Inspect Helm chart files.',
            rationale: 'Use Helm CLI.',
            payload: {
              actionFamily: 'helm-inspection'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'helm_show_chart',
              safety: 'read_only',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                chartPath: 'charts/payments-api',
                command: 'helm show chart charts/payments-api',
                exitCode: 0,
                stdout: 'name: payments-api\nversion: 0.1.0\n',
                stderr: '',
                content: 'name: payments-api\nversion: 0.1.0\n'
              }
            },
            {
              toolName: 'helm_show_values',
              safety: 'read_only',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                chartPath: 'charts/payments-api',
                command: 'helm show values charts/payments-api',
                exitCode: 0,
                stdout: 'replicaCount: 2\n',
                stderr: '',
                content: 'replicaCount: 2\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Run posture: completed with bounded inspection or edits/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Helm target charts\/payments-api was inspected/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the target chart metadata, values, and templates for the requested Helm change\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: charts\/payments-api\/Chart\.yaml, charts\/payments-api\/values\.yaml, charts\/payments-api\/templates\//i.test(line)));
  assert.ok(summary.some(line => /Review command: helm show values "charts\/payments-api"/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run helm show values "charts\/payments-api" and review the bounded change before merging or handing off the update\./i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Helm CLI/i.test(line)));
  assert.ok(summary.some(line => /Native CLI findings: Helm chart payments-api v0.1.0; Helm values inspected for charts\/payments-api/i.test(line)));
});

test('summarizeResultCard includes rendered Helm resource kinds from helm template output', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 0,
          stdout: [
            'apiVersion: apps/v1',
            'kind: Deployment',
            '---',
            'apiVersion: v1',
            'kind: Service',
            '---',
            'apiVersion: networking.k8s.io/v1',
            'kind: Ingress'
          ].join('\n'),
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: validated and ready for review/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Helm target charts\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review rendered Kubernetes objects and the Helm values block that drives them\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Helm rendered resources: Deployment, Service, Ingress/i.test(line)));
});

test('summarizeResultCard includes Pulumi validation findings for missing config blockers', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      configSemantics: [
        ...preflight.inspection.configSemantics,
        {
          targetKind: 'pulumi-project',
          targetPath: 'infra/payments-api',
          facts: [
            {
              kind: 'required-field',
              path: 'config.payments-api:imageTag',
              message: 'Pulumi preview reported payments-api:imageTag as required.',
              source: {
                kind: 'pulumi-preview',
                path: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive'
              },
              confidence: 'high'
            }
          ]
        }
      ],
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 1,
          stdout: '',
          stderr: 'error: missing required configuration variable "payments-api:imageTag"'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-missing-config',
          repairable: true,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'missing required configuration variable "payments-api:imageTag"',
          guidance: 'Update the selected Pulumi stack file and set payments-api:imageTag using the existing stack config namespace before rerunning preview.',
          metadata: {
            missingConfigKey: 'payments-api:imageTag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const summary = summarizeResultCard(state);

  assert.ok(summary.some(line => /Run posture: blocked by validation and needs follow-up action/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Pulumi target infra\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Update the selected Pulumi stack file and set payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the selected Pulumi stack file and its config namespace before rerunning preview\./i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run .*pulumi preview .*infra\/payments-api.*--stack dev.*correct the blocking Pulumi issue, and rerun the agent\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Pulumi preview missing config: payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Semantic blockers: pulumi-project infra\/payments-api: config\.payments-api:imageTag required by pulumi-preview/i.test(line)));

  const compact = buildCompactAgentRunResult(state);
  assert.equal(compact.kind, 'infra-agent.agent-result');
  assert.equal(compact.outcome, 'validation-blocked');
  assert.equal(compact.validation.semanticBlockers[0]?.path, 'config.payments-api:imageTag');
  assert.equal(compact.validation.semanticBlockers[0]?.sourceKind, 'pulumi-preview');
  assert.equal(compact.validation.issues[0]?.kind, 'pulumi-missing-config');
  assert.ok(compact.suggestedCommands.some(command => /validate/i.test(command)));
  assert.equal(Object.hasOwn(compact, 'turns'), false);
  assert.equal(Object.hasOwn(compact, 'preflight'), false);
});

test('summarizeResultCard includes Terraform validation findings for missing required variables', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: true,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument',
          guidance: 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.',
          metadata: {
            missingVariableName: 'image_tag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: blocked by validation and needs follow-up action/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Terraform target terraform\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Read the referenced Terraform module inputs and add the missing required argument/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the target tfvars file and the Terraform module inputs referenced by validate\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: terraform\/payments-api\/terraform\*\.tfvars, variable declarations under terraform\/payments-api/i.test(line)));
  assert.ok(summary.some(line => /Review command: terraform -chdir=terraform\/payments-api validate/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run terraform -chdir=terraform\/payments-api validate, correct the blocking Terraform issue, and rerun the agent\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Terraform validate is missing required variable: image_tag/i.test(line)));
});

test('summarizeResultCard includes approval-required posture', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/templates/deployment.yaml',
          risk: 'high',
          message: 'High-risk rewrite requires approval.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: paused pending explicit approval for a scoped high-risk change/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Approval required for high-risk write at charts\/payments-api\/templates\/deployment\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Decide whether to approve the high-risk write for charts\/payments-api\/templates\/deployment\.yaml before continuing\./i.test(line)));
});

test('summarizeResultCard includes clarification concern from the planner question', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'clarification-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'medium',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Clarify the Helm target before making changes.',
            rationale: 'The workspace has multiple possible Helm targets.',
            payload: {
              clarificationKind: 'target-ambiguity',
              actionFamily: 'helm-clarification',
              questions: ['Which Helm chart should be updated?']
            }
          }
        },
        execution: {
          status: 'skipped',
          executedTools: [],
          reason: 'clarification-required'
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Open concern: Which Helm chart should be updated\?/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Answer this question and rerun the task: Which Helm chart should be updated\?/i.test(line)));
});

test('summarizeSuggestedCommands recommends inspect and run for validation-blocked runs', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(commands.some(command => /terraform -chdir=terraform\/payments-api fmt -check -recursive/.test(command)));
  assert.ok(commands.some(command => /terraform -chdir=terraform\/payments-api validate/.test(command)));
});

test('summarizeRecommendedNextSteps uses Helm-specific clarification wording', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'clarification-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(steps.some(step => /helm chart, environment, or values scope/i.test(step)));
});

test('summarizeRecommendedNextSteps focuses the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(steps.some(step => /Focus on helm-chart target charts\/payments-api/i.test(step)));
});

test('summarizeSuggestedCommands adds domain-aware validate command for Helm clarification runs', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'clarification-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
});

test('summarizeSuggestedCommands includes native Helm commands for Helm clarification runs', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'clarification-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /helm show chart "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /helm show values "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /helm lint "charts\/payments-api"/.test(command)));
});

test('summarizeSuggestedCommands includes native Pulumi preview command for blocked Pulumi runs', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'pulumi-missing-config',
          repairable: true,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'missing required configuration variable "payments-api:imageTag"',
          metadata: {
            missingConfigKey: 'payments-api:imageTag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /pulumi preview --cwd infra\/payments-api --stack dev --non-interactive/.test(command)));
});

test('rule-based planner asks Terraform-specific clarification questions when Terraform task lacks root and environment detail', async () => {
  const preflight = await buildRunPreflight('update terraform variables', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Terraform root, variables, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Terraform root should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/payments-api/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /tfvars file/i.test(question)));
});

test('rule-based planner asks for primary domain clarification when a task spans multiple detected domains', async () => {
  const preflight = await buildRunPreflight('update helm and pulumi config for payments-api dev', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.rationale, /multiple infrastructure domains/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which primary domain should the agent modify first/i.test(question)));
});

test('rule-based planner asks Terraform-specific clarification when no Terraform root is detected', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-empty-terraform-'));

  try {
    const preflight = await buildRunPreflight('update terraform variables', tempRoot);
    const planner = new RuleBasedPlanningModel();
    const decision = await planner.decideNextAction({
      runtime: {
        task: preflight.task,
        preflight,
        observations: [],
        appliedWrites: [],
        validationResults: [],
        validationIssues: [],
        approvalSignals: [],
        repairAttempts: 0,
        lastEditPlan: null
      }
    });

    assert.equal(decision.action.kind, 'ask-for-clarification');
    assert.match(decision.action.summary, /Terraform workspace and target/i);
    assert.ok(decision.action.payload?.questions?.some(question => /existing tfvars file/i.test(question)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner asks Helm-specific clarification questions when Helm task lacks chart and environment detail', async () => {
  const preflight = await buildRunPreflight('update helm values', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Helm chart, values scope, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which environment values or chart variant should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification questions when Pulumi task lacks project and environment detail', async () => {
  const preflight = await buildRunPreflight('update pulumi config', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Pulumi project, stack, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which stack or environment should be updated\?/i.test(question)));
});

test('rule-based planner asks Helm-specific clarification when no Helm chart is detected', async () => {
  const preflight = await buildRunPreflight('add helm ingress', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Helm workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart or chart directory should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification when no Pulumi project is detected', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Pulumi workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project or stack directory should be updated\?/i.test(question)));
});

test('rule-based planner includes Terraform root options in clarification for multi-root ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/network-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/worker-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /dev\.auto\.tfvars/i.test(question)));
});

test('rule-based planner emits Terraform-specific inspection summary for Terraform tasks', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'inspect-target-files');
  assert.equal(decision.action.payload?.actionFamily, 'terraform-inspection');
  assert.match(decision.action.summary, /Inspect the selected Terraform root files/i);
  assert.match(decision.action.rationale, /requested terraform task/i);
});

test('rule-based planner emits Helm-specific validation summary for Helm tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'ingress:\n  enabled: true\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'ingress:\n  enabled: true\n',
          reason: 'test write',
          mode: 'append',
          risk: 'low'
        }
      ],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'validate-targets');
  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
  assert.match(decision.action.summary, /Run Helm validators for the selected chart/i);
  assert.match(decision.action.rationale, /requested helm path/i);
});

test('rule-based planner tags Pulumi ambiguity clarifications with a Pulumi action family', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.actionFamily, 'pulumi-clarification');
});

test('rule-based planner tags validation-blocked stop actions with validation-blocked action family', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'terraform/payments-api/main.tf',
            content: 'variable "app_image_tag" { type = string }\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'terraform/payments-api/dev.auto.tfvars',
          content: 'app_image_tag = "2.3.4"\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.actionFamily, 'validation-blocked');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
});

test('rule-based agent repairs missing ingress values after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-ingress-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-ingress-values-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress-values-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner stops with repair-budget-exhausted after bounded retries are consumed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'service:\n  port: 8080\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'service:\n  port: 8080\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 1,
          stdout: '',
          stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-ingress-values',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 2,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'repair-budget-exhausted');
  assert.match(decision.action.summary, /repair budget/i);
});

test('rule-based agent emits ingress edit plan against fixture workspace copy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-test-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.match(result.modelName, /rule-based/);
    assert.equal(result.outcome, 'completed');
    assert.ok(result.runtime.appliedWrites.length > 0);
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'diff_preview')));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'append_file')));
    const ingressTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress');
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'append'));
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'create'));
    assert.ok(
      result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress')
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based probes path uses replace mode for deployment template edits', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-probes-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    const probesTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-probes');
    assert.ok(probesTurn?.decision.action.payload?.writes?.some(write => write.mode === 'replace'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'replace_file')));
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('inspectWorkspace detects Terraform roots and tfvars files', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');

  assert.equal(inspection.profile.id, 'generic');
  assert.equal(inspection.terraformRoots.length, 1);
  assert.equal(inspection.fileCounts.terraformRootFiles, 1);
  assert.equal(inspection.fileCounts.terraformVariableFiles, 1);
  assert.equal(inspection.terraformRoots[0]?.rootPath, 'terraform/payments-api');
  assert.ok(inspection.terraformRoots[0]?.environmentHints.includes('dev'));
});

test('targeting prefers Terraform roots for Terraform-oriented tasks', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const targeting = buildTargetCandidates('update terraform payments-api dev image tag to 2.3.4', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/payments-api');
  assert.ok(targeting.targetCandidates[0]?.matchedEnvironmentHints.includes('dev'));
});

test('targeting prefers requested Helm domain over higher-scoring non-Helm candidates in mixed workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const targeting = buildTargetCandidates('add ingress to payments-api dev chart', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/payments-api');
  assert.equal(targeting.targetCandidates[1]?.kind, 'pulumi-project');
});

test('targeting uses Terraform module hints to disambiguate multi-root workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.equal(inspection.terraformRoots.length, 2);
  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/network-stack');
  assert.ok(targeting.targetCandidates[0]?.reasons.some(reason => /repository hints matched service token/i.test(reason)));
});

test('detectRequestedService ignores generic Terraform config nouns like image and tag', () => {
  assert.equal(detectRequestedService('update terraform dev image tag to 2.3.4'), null);
});

test('Terraform target candidates expose tfvars and module hint details for non-infra users', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /tfvars:/i.test(detail)));
  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /module hints:/i.test(detail)));
});

test('buildRunPreflight warns when multiple Terraform roots match with similar confidence', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');

  assert.ok(preflight.assumptions.some(assumption => /Target service or chart was not explicitly detected/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Multiple Terraform roots matched with similar confidence/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Terraform environment was not explicit; top candidate offers/i.test(assumption)));
});

test('validation preflight adds Terraform commands for detected Terraform roots', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const validation = buildValidationPreflight(inspection);
  const terraformEntry = validation.plan.find(entry => entry.kind === 'terraform');

  assert.ok(terraformEntry);
  assert.equal(terraformEntry?.target, 'terraform/payments-api');
  assert.deepEqual(terraformEntry?.commands, [
    'terraform -chdir=terraform/payments-api fmt -check -recursive',
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('buildEditPlan creates a bounded Terraform tfvars config plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/dev.auto.tfvars');
  assert.match(editPlan?.rationale ?? '', /Terraform validation allows environment values: dev, stage, prod/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});

test('buildEditPlan respects Terraform string type when formatting numeric-looking tfvars values', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 123', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.match(editPlan?.rationale ?? '', /Terraform declares image_tag as string/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "123"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /image_tag = 123/);
});

test('buildEditPlan blocks Terraform tfvars writes that violate enum semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api qa image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not auto-create tfvars in generic terraform-only workspaces without an existing tfvars file', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-no-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-no-tfvars-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not implicitly select one tfvars file when multiple Terraform tfvars options exist without an explicit environment', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan selects the matching tfvars file when Terraform environment is explicit', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api prod image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/prod.auto.tfvars');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "prod"/);
});

test('buildEditPlan reuses existing Terraform variable key names from tfvars and variable declarations', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 4.5.6',
    'fixtures/terraform-alt-keys-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/terraform.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.match(editPlan?.rationale ?? '', /app_image_tag/);
  assert.match(editPlan?.rationale ?? '', /deploy_env/);
  assert.match(editPlan?.writes[0]?.content ?? '', /app_image_tag = "4.5.6"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /deploy_env = "dev"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^image_tag =/m);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^environment =/m);
});

test('buildEditPlan creates a bounded Pulumi missing-config repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update pulumi dev stack for payments-api image tag to 1.2.3',
    'fixtures/sample-workspace'
  );

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: 'fixtures/sample-workspace/infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n',
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [
      {
        command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        exitCode: 1,
        stdout: '',
        stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
      }
    ],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        message: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'pulumi-missing-config-repair');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.key, 'payments-api:imageTag');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.value, '1.2.3');
  assert.match(editPlan?.writes[0]?.content ?? '', /payments-api:imageTag: 1\.2\.3/);
});

test('buildEditPlan creates a bounded Terraform missing-required-argument repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: 'environment = "dev"\n',
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [
      {
        command: 'terraform -chdir=terraform/payments-api validate',
        exitCode: 1,
        stdout: '',
        stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
      }
    ],
    validationIssues: [
      {
        kind: 'terraform-validate-failure',
        repairable: true,
        sourceCommand: 'terraform -chdir=terraform/payments-api validate',
        message: 'Error: Missing required argument',
        metadata: {
          missingVariableName: 'image_tag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-missing-required-argument-repair');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2\.3\.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});

test('inspect-target-files reads Terraform root files into runtime observations', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Terraform files.',
        rationale: 'Test Terraform inspection path.',
        payload: {
          targetPaths: ['terraform/payments-api'],
          requestedDomains: ['terraform']
        }
      }
    },
    resolve('fixtures/terraform-workspace'),
    null
  );

  assert.ok(execution);
  const readPaths = execution?.executedTools
    .filter(result => result.toolName === 'read_file')
    .map(result => result.output.path);

  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/main.tf')));
  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/dev.auto.tfvars')));
  assert.ok(readPaths?.every(path => !path.endsWith('Chart.yaml')));
});

test('inspect-target-files uses helm_show_values for Helm chart inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm inspection path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowValues = execution?.executedTools.find(result => result.toolName === 'helm_show_values');

  assert.ok(helmShowValues);
  assert.match(helmShowValues?.output.command ?? '', /helm show values charts\/payments-api/i);
  assert.match(helmShowValues?.output.content ?? '', /service:\s*\n\s*port:\s*8080/i);
});

test('inspect-target-files uses helm_show_chart for Helm chart metadata inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm chart metadata path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowChart = execution?.executedTools.find(result => result.toolName === 'helm_show_chart');

  assert.ok(helmShowChart);
  assert.match(helmShowChart?.output.command ?? '', /helm show chart charts\/payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /name:\s*payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /version:\s*0.1.0/i);
});

test('classifyValidationIssues marks terraform fmt failures as terraform-formatting-required', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api fmt -check -recursive',
      exitCode: 3,
      stdout: 'main.tf',
      stderr: ''
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-formatting-required');
  assert.equal(issues[0]?.repairable, true);
});

test('classifyValidationIssues marks terraform validate failures as terraform-validate-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Reference to undeclared input variable'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.message ?? '', /undeclared input variable/i);
  assert.match(issues[0]?.guidance ?? '', /variable name exists in variable declarations and tfvars/i);
});

test('classifyValidationIssues provides actionable guidance for missing required Terraform arguments', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
    }
  ]);

  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingVariableName, 'image_tag');
  assert.match(issues[0]?.guidance ?? '', /add the missing required argument through an existing tfvars file or declared variable path/i);
});

test('classifyValidationIssues marks missing Pulumi config as pulumi-missing-config', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-missing-config');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingConfigKey, 'payments-api:imageTag');
  assert.match(issues[0]?.guidance ?? '', /set payments-api:imageTag/i);
});

test('classifyValidationIssues marks Pulumi AWS route create-before-delete conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/networking --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:ec2:Route (scrawlr-prod-subnet-0cce76f6ee720890b-pcx-0881f5cc374f72a09):',
        'error: api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.equal(issues[0]?.metadata?.providerName, 'aws@7.23.0');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
  assert.match(issues[0]?.guidance ?? '', /aliases/i);
});

test('classifyValidationIssues marks generic Pulumi already-exists conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/storage --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:s3:Bucket (prod-artifacts):',
        'error: api error BucketAlreadyExists: The requested bucket name is not available: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyExists');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:s3:Bucket');
  assert.match(issues[0]?.guidance ?? '', /same provider identity/i);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
});

test('classifyValidationIssues marks general Pulumi preview failures as pulumi-preview-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: preview failed because the stack configuration is invalid'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-preview-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.guidance ?? '', /failing Pulumi project and stack file/i);
});

test('executeDecision runs terraform formatting repair inside the selected Terraform root', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-fmt-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: 'Repair Terraform formatting.',
          rationale: 'terraform fmt -check failed.',
          payload: {
            rootPath: 'terraform/payments-api'
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'search_workspace');
    assert.equal(execution?.executedTools[1]?.toolName, 'terraform_fmt');
    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    assert.match(repairedMainTf, /  type = string/);
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent repairs Terraform formatting failures and revalidates', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'update terraform payments-api dev image tag to 2.3.4',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.kind === 'repair-terraform-formatting'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'terraform_fmt')));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');

    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const updatedTfvars = await readFile(join(workspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
    assert.match(updatedTfvars, /image_tag\s*=\s*"2.3.4"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
