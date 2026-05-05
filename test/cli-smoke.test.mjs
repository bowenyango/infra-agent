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
import { LLMModelClient } from '../src/model/LLMModelClient.ts';
import { createModelClient } from '../src/model/create-model-client.ts';
import { resolveLLMClientConfig } from '../src/model/config.ts';
import { parsePlannerDecision } from '../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from '../src/model/prompt.ts';
import { buildEditPlan } from '../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../src/agent/collect-approval-signals.ts';
import {
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
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
import { main, parseArgs, readPackageVersion } from '../src/cli/main.ts';
import { buildDoctorReport } from '../src/cli/doctor.ts';
import {
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES
} from '../src/cli/exit-codes.ts';
import { parseCompactAgentRunResult } from '../src/cli/agent-result-contract.ts';
import { parseInfraGraphResult } from '../src/cli/infra-graph-contract.ts';
import {
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport
} from '../src/cli/infra-graph-report.ts';
import {
  loadIdentityConflictIncidentReport,
  parseIdentityConflictIncidentReport
} from '../src/cli/identity-report.ts';
import { executeTool } from '../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { SearchWorkspaceTool } from '../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { ValidateTargetsTool } from '../src/tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { classifyUnsafeValidationCommand } from '../src/validators/command-safety.ts';
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
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets
} from '../src/domain/terraform-provider-schema.ts';
import {
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets
} from '../src/domain/helm-chart-context.ts';
import { prefetchWorkspaceKnowledge } from '../src/knowledge/prefetch.ts';
import { buildStableInfraGraphSnapshot } from '../src/impact/graph-snapshot.ts';
import { normalizeInfraGraphImpactReviewTargets } from '../src/impact/graph-impact-summary.ts';
import { buildWorkspaceInfraGraph, summarizeInfraGraph } from '../src/impact/workspace-graph.ts';
import {
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges
} from '../src/impact/terraform-plan-graph.ts';
import {
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges
} from '../src/impact/pulumi-preview-graph.ts';

async function captureStdout(run) {
  const originalWrite = process.stdout.write;
  let output = '';

  process.stdout.write = (chunk, encoding, callback) => {
    output += String(chunk);
    if (typeof encoding === 'function') {
      encoding();
    } else if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

function buildCompactHandoffBudgetsFixture(overrides = {}) {
  const base = {
    turnTrace: { includedCount: 0, omittedCount: 0 },
    lifecycleEvents: { includedCount: 0, omittedCount: 0 },
    toolTrace: { includedCount: 0, omittedCount: 0 },
    workPlan: { includedCount: 6, omittedCount: 0 },
    targeting: { includedCount: 1, omittedCount: 0 },
    validationCommands: { includedCount: 0, omittedCount: 0 },
    validationIssues: { includedCount: 1, omittedCount: 0 },
    validationIssueGroups: { includedCount: 1, omittedCount: 0 },
    validationSafetyBlockers: { includedCount: 0, omittedCount: 0 },
    identityConflicts: { includedCount: 1, omittedCount: 0 },
    approvalSignals: { includedCount: 0, omittedCount: 0 },
    knowledgePackets: {
      includedCount: 0,
      omittedCount: 0,
      includedTokenEstimate: 0,
      omittedTokenEstimate: 0
    }
  };

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      {
        ...value,
        ...(overrides[key] ?? {})
      }
    ])
  );
}

function buildEmptyApprovalGrantsFixture() {
  return {
    approvedWriteRisks: [],
    approvedWritePaths: [],
    approvedToolCategories: [],
    writePathScope: 'all',
    hasExplicitApproval: false
  };
}

function buildGraphSnapshotBaseGraph() {
  const nodes = [
    {
      id: 'workspace',
      kind: 'workspace',
      label: 'Snapshot Workspace',
      path: null,
      domain: 'workspace',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        profileId: 'snapshot',
        helmCharts: 0,
        pulumiProjects: 1,
        terraformRoots: 1
      }
    },
    {
      id: 'terraform-root:terraform/payments-api',
      kind: 'terraform-root',
      label: 'terraform/payments-api',
      path: 'terraform/payments-api',
      domain: 'terraform',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        environmentHints: 'dev',
        moduleHints: 'payments-api',
        tfFileCount: 1,
        tfvarsFileCount: 1
      }
    },
    {
      id: 'pulumi-project:infra/payments-api',
      kind: 'pulumi-project',
      label: 'infra/payments-api',
      path: 'infra/payments-api',
      domain: 'pulumi',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        environmentHints: 'dev',
        projectFile: 'infra/payments-api/Pulumi.yaml',
        stackCount: 1
      }
    }
  ];
  const edges = [
    {
      id: 'contains:workspace->terraform-root:terraform/payments-api',
      from: 'workspace',
      to: 'terraform-root:terraform/payments-api',
      kind: 'contains',
      confidence: 'high',
      source: 'workspace-inspection',
      label: 'workspace contains Terraform root'
    },
    {
      id: 'contains:workspace->pulumi-project:infra/payments-api',
      from: 'workspace',
      to: 'pulumi-project:infra/payments-api',
      kind: 'contains',
      confidence: 'high',
      source: 'workspace-inspection',
      label: 'workspace contains Pulumi project'
    }
  ];

  return {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: 'fixtures/graph-snapshot-workspace',
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}

function buildGraphSnapshotTerraformPlan() {
  return {
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
              bucket: 'payments-artifacts-v2'
            }
          },
          {
            address: 'aws_iam_role.lambda',
            mode: 'managed',
            type: 'aws_iam_role',
            name: 'lambda',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            values: {
              name: 'payments-lambda'
            }
          },
          {
            address: 'aws_lambda_function.api',
            mode: 'managed',
            type: 'aws_lambda_function',
            name: 'api',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            depends_on: ['aws_s3_bucket.artifacts', 'aws_iam_role.lambda'],
            values: {
              function_name: 'payments-api'
            }
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
          actions: ['update'],
          after: {
            function_name: 'payments-api'
          }
        }
      },
      {
        address: 'aws_route.peer',
        mode: 'managed',
        type: 'aws_route',
        name: 'peer',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['vpc_peering_connection_id']],
          before: {
            route_table_id: 'rtb-123',
            destination_cidr_block: '10.0.0.0/16',
            vpc_peering_connection_id: 'pcx-old'
          },
          after: {
            route_table_id: 'rtb-123',
            destination_cidr_block: '10.0.0.0/16',
            vpc_peering_connection_id: 'pcx-new'
          }
        }
      }
    ]
  };
}

function buildGraphSnapshotPulumiPreview() {
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const configMapUrn = 'urn:pulumi:dev::payments-api::kubernetes:core/v1:ConfigMap::payments-config';

  return [
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: configMapUrn,
          type: 'kubernetes:core/v1:ConfigMap',
          name: 'payments-config'
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api',
          detailedDiff: {
            name: {
              kind: 'update-replace'
            }
          },
          old: {
            name: 'payments-api'
          },
          new: {
            name: 'payments-api-v2'
          }
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
          dependencies: [securityGroupUrn, configMapUrn]
        }
      }
    },
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
    }
  ];
}

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

async function writeTerraformProviderSchemaWorkspace(tempRoot) {
  const terraformRoot = join(tempRoot, 'terraform/app');
  await mkdir(join(terraformRoot, '.infra-agent'), { recursive: true });
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
      'resource "aws_lb_listener_rule" "payments" {',
      '  listener_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2"',
      '  priority     = 100',
      '',
      '  action {',
      '    type             = "forward"',
      '    target_group_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/app/1"',
      '  }',
      '',
      '  condition {',
      '    path_pattern {',
      '      values = ["/payments/*"]',
      '    }',
      '  }',
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
  await writeFile(
    join(terraformRoot, '.infra-agent/terraform-provider-schema.json'),
    JSON.stringify({
      format_version: '1.0',
      provider_schemas: {
        'registry.terraform.io/hashicorp/aws': {
          resource_schemas: {
            aws_lb_listener_rule: {
              version: 0,
              block: {
                attributes: {
                  arn: {
                    type: 'string',
                    computed: true
                  },
                  listener_arn: {
                    type: 'string',
                    required: true
                  },
                  priority: {
                    type: 'number',
                    optional: true
                  }
                },
                block_types: {
                  action: {
                    nesting_mode: 'list',
                    min_items: 1,
                    max_items: 1,
                    block: {
                      attributes: {
                        type: {
                          type: 'string',
                          required: true
                        }
                      }
                    }
                  },
                  condition: {
                    nesting_mode: 'list',
                    min_items: 1
                  }
                }
              }
            },
            aws_instance: {
              version: 0,
              block: {
                attributes: {
                  ami: {
                    type: 'string',
                    required: true
                  }
                }
              }
            }
          }
        }
      }
    }, null, 2),
    'utf8'
  );

  return terraformRoot;
}

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

test('inspectWorkspace extracts compact Terraform provider schema semantics', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    assert.deepEqual(root.providerSchemaFiles, ['terraform/app/.infra-agent/terraform-provider-schema.json']);
    const targeting = buildTargetCandidates('update terraform app listener rule priority', inspection);
    assert.ok(targeting.targetCandidates[0]?.details?.some(detail =>
      detail.includes('provider schema: terraform/app/.infra-agent/terraform-provider-schema.json')
    ));

    const providerSchemaSummary = inspection.configSemantics.find(summary =>
      summary.targetKind === 'terraform-root'
      && summary.targetPath === 'terraform/app'
      && summary.facts.some(fact => fact.source.kind === 'terraform-provider-schema')
    );
    assert.ok(providerSchemaSummary);
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.source.kind === 'terraform-provider-schema'
      && fact.source.version === 'hashicorp/aws@5.37.0'
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.values?.includes('string')
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'type-constraint'
      && fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.values?.includes('number')
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.values?.includes('max_items=1')
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform provider schema context stays local and compact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-context-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);

    const sources = await buildTerraformProviderSchemaKnowledgeSources(tempRoot, root);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'provider-schema');
    assert.equal(sources[0]?.localPath, 'terraform/app/.infra-agent/terraform-provider-schema.json');
    assert.equal(sources[0]?.version, 'hashicorp/aws@5.37.0');

    const packets = await retrieveTerraformProviderSchemaContextPackets({
      workspaceRoot: tempRoot,
      root,
      reason: 'Local provider schema for Terraform planning'
    });
    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'provider-schema');
    assert.equal(packets[0]?.source.version, 'hashicorp/aws@5.37.0');
    assert.match(packets[0]?.excerpt ?? '', /aws_lb_listener_rule/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersions": \{\n    "hashicorp\/aws": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersion": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /listener_arn/);
    assert.doesNotMatch(packets[0]?.excerpt ?? '', /aws_instance/);

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}`,
        fetchedAt: '2026-04-29T00:00:00.000Z',
        staleAfter: '2026-05-29T00:00:00.000Z'
      })
    });
    assert.ok(prefetch.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'provider-schema'
    ));
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
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write']
  });

  assert.deepEqual(preflight.approval.approvedWriteRisks, ['high']);
  assert.deepEqual(preflight.approval.approvedWritePaths, ['charts/payments-api']);
  assert.deepEqual(preflight.approval.approvedToolCategories, ['native-stack-config-write']);
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write risks')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write paths')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for tool categories')));
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
  assert.match(decision.action.summary, /gated operations/i);
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

test('collectApprovalSignals applies tool category approval rules for native stack config writes', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            requiredToolCategories: ['native-stack-config-write']
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
      kind: 'pulumi-stack-config',
      summary: 'Synthetic native stack config write.',
      rationale: 'Tool category approval policy test.',
      pulumiConfigOperations: [
        {
          projectRoot: 'infra/payments-api',
          stackName: 'dev',
          key: 'payments-api:imageTag',
          value: '1.2.3'
        }
      ],
      writes: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Synthetic Pulumi config write.'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.kind, 'tool-category-approval-required');
  assert.equal(signals[0]?.toolCategory, 'native-stack-config-write');
});

test('explicit approval scope can suppress tool category approval signals', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace', {
    approvedToolCategories: ['native-stack-config-write']
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
            requiredToolCategories: ['native-stack-config-write']
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
      kind: 'pulumi-stack-config',
      summary: 'Synthetic native stack config write.',
      rationale: 'Tool category approval policy test.',
      pulumiConfigOperations: [
        {
          projectRoot: 'infra/payments-api',
          stackName: 'dev',
          key: 'payments-api:imageTag',
          value: '1.2.3'
        }
      ],
      writes: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Synthetic Pulumi config write.'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
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

test('runSingleStep gates unapproved edit execution even when the model asks to apply', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-approval-gate-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const write = {
      path: 'charts/payments-api/values.yaml',
      content: 'replicaCount: 99\n',
      reason: 'Synthetic unapproved high-risk rewrite.',
      mode: 'rewrite',
      risk: 'high'
    };
    const bypassModel = {
      name: 'approval-bypass-test-model',
      async decideNextAction() {
        return {
          action: {
            kind: 'apply-edit-plan',
            summary: 'Attempt to bypass approval.',
            rationale: 'Synthetic approval gate test.',
            payload: {
              actionFamily: 'helm-bounded-edit',
              writes: [write],
              editPlan: {
                kind: 'helm-ingress',
                summary: 'Synthetic high-risk rewrite.',
                rationale: 'Exercise execution-time approval gate.',
                writes: [write]
              }
            }
          },
          confidence: 'high'
        };
      }
    };

    const result = await runSingleStep(
      'update payments-api chart deeply',
      workspaceRoot,
      bypassModel
    );
    const compact = buildCompactAgentRunResult(result);

    assert.equal(result.outcome, 'approval-required');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0]?.decision.action.kind, 'apply-edit-plan');
    assert.equal(result.turns[0]?.execution?.status, 'skipped');
    assert.match(result.turns[0]?.execution?.reason ?? '', /Approval is required before executing this workspace mutation/);
    assert.equal(result.turns[0]?.execution?.executedTools.length, 0);
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(result.runtime.approvalSignals[0]?.kind, 'write-approval-required');
    assert.equal(result.runtime.approvalSignals[0]?.path, 'charts/payments-api/values.yaml');
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
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
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'helm_show_values'
      && summary.permission.category === 'native-cli-read'
      && summary.permission.externalCommand
    ));
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'append_file'
      && summary.permission.category === 'workspace-write'
      && summary.permission.mutatesWorkspace
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveQueryLoopConfig keeps bounded defaults and normalizes overrides', () => {
  assert.equal(resolveQueryLoopConfig().maxTurns, 6);
  assert.equal(resolveQueryLoopConfig().maxRepairAttempts, 2);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxPackets, 5);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxTokens, 1000);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 2.8 }).maxTurns, 2);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 0 }).maxTurns, 1);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: 3.8 }).maxRepairAttempts, 3);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: -1 }).maxRepairAttempts, 0);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8
    }
  }).retrievedContextBudget.maxPackets, 2);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8
    }
  }).retrievedContextBudget.maxTokens, 1);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8
    }
  }).retrievedContextBudget.maxExcerptChars, 240);
});

test('runSingleStep respects configured zero repair attempts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxRepairAttempts: 0
      }
    );

    assert.equal(result.config.maxRepairAttempts, 0);
    assert.equal(result.runtime.maxRepairAttempts, 0);
    assert.equal(result.runtime.repairAttempts, 0);
    assert.equal(result.outcome, 'repair-budget-exhausted');
    const compact = buildCompactAgentRunResult(result);
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 0);
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 0,
      attemptsRemaining: 0,
      exhausted: true
    });
    assert.equal(compact.harness.loopBudget.exhausted, false);
    assert.ok(compact.harness.loopBudget.turnsRemaining > 0);
    assert.ok(compact.resultCard.some(line => /Repair activity: 0\/0 bounded repair attempt\(s\) used/i.test(line)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
      {
        maxTurns: 1,
        retrievedContextBudget: {
          maxPackets: 2,
          maxTokens: 500
        }
      }
    );

    assert.equal(result.turns.length, 1);
    assert.equal(result.outcome, 'no-safe-action');
    assert.ok(result.runtime.toolSummaries.some(summary => summary.actionKind === 'inspect-target-files'));
    const compact = buildCompactAgentRunResult(result);
    assert.equal(compact.harness.maxTurns, 1);
    assert.equal(compact.harness.queryConfig.maxTurns, 1);
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxPackets, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxTokens, 500);
    assert.deepEqual(compact.harness.loopBudget, {
      turnsUsed: 1,
      maxTurns: 1,
      turnsRemaining: 0,
      exhausted: true
    });
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 2,
      attemptsRemaining: 2,
      exhausted: false
    });
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
    assert.equal(compact.harness.plannerHandoff.lastAction.kind, 'inspect-target-files');
    assert.equal(compact.harness.plannerHandoff.lastAction.executionStatus, 'completed');
    assert.equal(compact.harness.lifecycleEvents.maxEntries, 12);
    assert.equal(compact.harness.lifecycleEvents.totalCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.includedCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.omittedCount, 0);
    assert.equal(compact.harness.lifecycleEvents.eventCounts['query-started'], 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
    assert.ok(compact.harness.lifecycleEvents.eventCounts['tool-execution'] >= 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
    assert.equal(compact.harness.lifecycleEvents.events[0]?.event, 'query-started');
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'decision'
      && event.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'tool-execution'
      && event.toolCount > 0
    ));
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
    assert.ok(compact.resultCard.some(line => /Turn budget: 1\/1 turn\(s\) used; exhausted/i.test(line)));
    assert.ok(compact.resultCard.some(line =>
      /Targeting: helm charts\/payments-api score=.*candidates .*; ambiguity none; next inspect-selected-target/i.test(line)
    ));
    assert.ok(compact.resultCard.some(line =>
      /Work plan: blocked; current handoff\/blocked; completed 3\/6; blocked 1; skipped 0; next rerun-with-larger-turn-budget/i.test(line)
    ));
    assert.equal(compact.harness.turnTraceLimit, 10);
    assert.equal(compact.harness.turnTraceOmittedCount, 0);
    assert.deepEqual(compact.harness.turnTraceBudget, {
      maxEntries: 10,
      totalCount: 1,
      includedCount: 1,
      omittedCount: 0,
      firstIncludedTurnIndex: 0,
      lastIncludedTurnIndex: 0,
      preservedWindow: 'head'
    });
    assert.equal(compact.knowledgeContext.maxPackets, 2);
    assert.equal(compact.knowledgeContext.maxTokens, 500);
    assert.equal(compact.harness.turnTrace.length, 1);
    assert.equal(compact.harness.turnTrace[0]?.actionKind, 'inspect-target-files');
    assert.equal(compact.harness.turnTrace[0]?.terminal, false);
    assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'completed');
    assert.equal(compact.harness.turnTrace[0]?.executionReason, null);
    assert.ok((compact.harness.turnTrace[0]?.executedToolCount ?? 0) > 0);
    assert.equal(compact.harness.toolTrace.maxEntries, 8);
    assert.equal(compact.harness.toolTrace.totalCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.toolTrace.entries.length, Math.min(result.runtime.toolSummaries.length, 8));
    assert.equal(compact.harness.toolTrace.includedCount, compact.harness.toolTrace.entries.length);
    assert.equal(compact.harness.toolTrace.omittedCount, Math.max(0, result.runtime.toolSummaries.length - 8));
    assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, compact.harness.toolTrace.entries[0]?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, compact.harness.toolTrace.entries.at(-1)?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
    assert.equal(compact.harness.toolTrace.latestTurnIndex, result.runtime.toolSummaries.at(-1)?.turnIndex ?? null);
    assert.ok(Object.values(compact.harness.toolTrace.permissionCategoryCounts).reduce((total, count) => total + count, 0) >= compact.harness.toolTrace.includedCount);
    assert.ok(compact.harness.toolTrace.entries.some(entry => entry.actionKind === 'inspect-target-files'));
    assert.ok(compact.harness.toolTrace.entries.every(entry => entry.toolName.length > 0));
    assert.equal(compact.harness.toolPermissionSummary.totalToolCount, result.runtime.toolSummaries.length);
    assert.ok(compact.harness.toolPermissionSummary.externalCommandToolCount > 0);
    assert.equal(compact.harness.stateSummary.observationCount, result.runtime.observations.length);
    assert.equal(compact.harness.stateSummary.toolSummaryCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.stateSummary.appliedWriteCount, result.runtime.appliedWrites.length);
    assert.equal(compact.harness.stateSummary.validationResultCount, result.runtime.validationResults.length);
    assert.equal(compact.harness.stateSummary.validationIssueCount, result.runtime.validationIssues.length);
    assert.equal(compact.harness.stateSummary.approvalSignalCount, result.runtime.approvalSignals.length);
    assert.equal(compact.harness.stateSummary.retrievedContextCount, result.runtime.retrievedContext.length);
    assert.ok(compact.harness.stateSummary.semanticFactCount > 0);
    assert.equal(compact.harness.targeting.schemaVersion, 1);
    assert.equal(compact.harness.targeting.source, 'derived-run-preflight');
    assert.equal(compact.harness.targeting.compact, true);
    assert.equal(compact.harness.targeting.mutationAllowed, false);
    assert.equal(compact.harness.targeting.candidateCount, result.preflight.targetCandidates.length);
    assert.equal(compact.harness.targeting.includedCount, compact.harness.targeting.candidates.length);
    assert.equal(compact.harness.targeting.omittedCount, Math.max(0, result.preflight.targetCandidates.length - 5));
    assert.equal(compact.harness.targeting.selectedTarget?.path, 'charts/payments-api');
    assert.equal(compact.harness.targeting.selectedTarget?.domain, 'helm');
    assert.equal(compact.harness.targeting.candidates[0]?.rank, 1);
    assert.equal(compact.harness.targeting.candidates[0]?.selected, true);
    assert.equal(compact.harness.targeting.candidates[0]?.domain, 'helm');
    assert.ok((compact.harness.targeting.candidates[0]?.reasons.length ?? 0) <= 3);
    assert.ok((compact.harness.targeting.candidates[0]?.details.length ?? 0) <= 3);
    assert.equal(compact.harness.targeting.flags.missingEnvironment, false);
    assert.equal(compact.harness.targeting.flags.missingService, false);
    assert.equal(compact.harness.targeting.recommendedAction, 'inspect-selected-target');
    assert.ok(compact.validation.selectedPlan.length > 0);
    assert.ok(compact.validation.selectedPlan.every(entry => entry.kind === 'helm'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.target === 'charts/payments-api'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.commandCount === entry.commands.length));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.executedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.failedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => typeof entry.validatorAvailable === 'boolean'));
    assert.equal(compact.knowledgeContext.totalPacketCount, result.runtime.retrievedContext.length);
    assert.equal(
      compact.knowledgeContext.includedPacketCount,
      compact.knowledgeContext.packets.filter(packet => packet.included).length
    );
    assert.equal(compact.readiness.status, 'pass');
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.source, 'derived-agent-run-state');
    assert.equal(compact.harness.workPlan.compact, true);
    assert.equal(compact.harness.workPlan.mutationAllowed, false);
    assert.equal(compact.harness.workPlan.status, 'blocked');
    assert.equal(compact.harness.workPlan.blockerKind, 'turn-budget');
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.harness.workPlan.totalStepCount, 6);
    assert.equal(compact.harness.workPlan.includedCount, compact.harness.workPlan.steps.length);
    assert.equal(compact.harness.workPlan.omittedCount, 0);
    assert.equal(compact.harness.workPlan.currentStepIndex, 5);
    assert.equal(compact.harness.workPlan.skippedStepCount, 0);
    assert.deepEqual(
      compact.harness.workPlan.steps.map(step => step.kind),
      ['readiness', 'targeting', 'inspection', 'edit', 'validation', 'handoff']
    );
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'inspection'
      && step.status === 'completed'
      && step.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'handoff'
      && step.status === 'blocked'
    ));
    assert.deepEqual(compact.handoffCheckpoint, {
      schemaVersion: 1,
      source: 'agent-result',
      compact: true,
      primaryArtifact: 'agent --json',
      debugArtifact: 'agent --json-full',
      mutationAllowed: false,
      exclusions: {
        rawRuntimeIncluded: false,
        rawPreflightIncluded: false,
        rawToolOutputIncluded: false,
        rawPromptIncluded: false,
        rawKnowledgeExcerptIncluded: false
      },
      summary: {
        outcome: 'no-safe-action',
        activeBlocker: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
        readinessStatus: 'pass',
        validationStatus: 'not run yet',
        validationIssueCount: 0,
        identityConflictCount: 0,
        approvalContinuationRequired: false,
        changedFileCount: 0
      },
      budgets: {
        turnTrace: {
          includedCount: compact.harness.turnTraceBudget.includedCount,
          omittedCount: compact.harness.turnTraceBudget.omittedCount
        },
        lifecycleEvents: {
          includedCount: compact.harness.lifecycleEvents.includedCount,
          omittedCount: compact.harness.lifecycleEvents.omittedCount
        },
        toolTrace: {
          includedCount: compact.harness.toolTrace.includedCount,
          omittedCount: compact.harness.toolTrace.omittedCount
        },
        workPlan: {
          includedCount: compact.harness.workPlan.includedCount,
          omittedCount: compact.harness.workPlan.omittedCount
        },
        targeting: {
          includedCount: compact.harness.targeting.includedCount,
          omittedCount: compact.harness.targeting.omittedCount
        },
        validationCommands: {
          includedCount: compact.validation.commands.entries.length,
          omittedCount: compact.validation.commands.omittedCount
        },
        validationIssues: {
          includedCount: compact.validation.issues.length,
          omittedCount: compact.validation.issueDetails.omittedCount
        },
        validationIssueGroups: {
          includedCount: compact.validation.issueSummary.groups.length,
          omittedCount: compact.validation.issueSummary.omittedGroupCount
        },
        validationSafetyBlockers: {
          includedCount: compact.validation.safetyBlockers.entries.length,
          omittedCount: compact.validation.safetyBlockers.omittedCount
        },
        identityConflicts: {
          includedCount: compact.validation.identityConflictSummary.includedCount,
          omittedCount: compact.validation.identityConflictSummary.omittedCount
        },
        approvalSignals: {
          includedCount: compact.approval.signals.length,
          omittedCount: Math.max(0, compact.approval.resume.signalCount - compact.approval.signals.length)
        },
        knowledgePackets: {
          includedCount: compact.knowledgeContext.includedPacketCount,
          omittedCount: compact.knowledgeContext.omittedPacketCount,
          includedTokenEstimate: compact.knowledgeContext.includedTokenEstimate,
          omittedTokenEstimate: compact.knowledgeContext.omittedTokenEstimate
        }
      },
      continuation: {
        required: true,
        reason: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
        approvalRequired: false,
        command: null,
        compactCommand: null,
        debugCommand: null,
        mutationAllowed: false
      },
      durableSections: [
        'root',
        'harness',
        'validation',
        'approval',
        'knowledge',
        'readiness',
        'result-card'
      ]
    });
    assert.ok(compact.resultCard.some(line => /Readiness: pass/i.test(line)));
    assert.match(compact.readiness.doctorCommand, / doctor /);
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'pass'
      && check.detail === 'rule-based-model-client'
    ));
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'validator:helm'
      && check.status === 'pass'
    ));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:pulumi'));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:terraform'));
    assert.equal(Object.hasOwn(compact, 'runtime'), false);
    assert.equal(Object.hasOwn(compact, 'preflight'), false);
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');

    const fallbackCompact = buildCompactAgentRunResult({
      ...result,
      modelName: 'rule-based-fallback'
    });
    assert.equal(fallbackCompact.readiness.status, 'warn');
    assert.ok(fallbackCompact.resultCard.some(line => /Readiness: warn.*planner/i.test(line)));
    assert.match(fallbackCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
    assert.ok(fallbackCompact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'warn'
      && /fallback/.test(check.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('compact work plan maps terminal outcomes to active steps', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const readFileSummary = {
    turnIndex: 0,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    permission: {
      category: 'workspace-read',
      mutatesWorkspace: false,
      mutatesExternalState: false,
      externalCommand: false,
      approvalRequired: false
    },
    summary: 'Read chart values.'
  };
  const makeState = runtimeOverrides => ({
    modelName: 'test-model',
    outcome: runtimeOverrides.outcome,
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      retrievedContext: [],
      observations: [],
      toolSummaries: runtimeOverrides.toolSummaries ?? [],
      appliedWrites: runtimeOverrides.appliedWrites ?? [],
      validationResults: runtimeOverrides.validationResults ?? [],
      validationIssues: runtimeOverrides.validationIssues ?? [],
      approvalSignals: runtimeOverrides.approvalSignals ?? [],
      repairAttempts: runtimeOverrides.repairAttempts ?? 0,
      maxRepairAttempts: 2,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  const approvalState = makeState({
    outcome: 'approval-required',
    toolSummaries: [readFileSummary],
    approvalSignals: [
      {
        kind: 'write-approval-required',
        path: 'charts/payments-api/values.yaml',
        risk: 'medium',
        message: 'Approval required before editing chart values.'
      }
    ]
  });
  const approvalCompact = buildCompactAgentRunResult(approvalState);
  const approvalStep = approvalCompact.harness.workPlan.steps.find(step => step.kind === 'edit');
  assert.equal(approvalCompact.harness.workPlan.status, 'blocked');
  assert.equal(approvalCompact.harness.workPlan.blockerKind, 'approval');
  assert.equal(approvalCompact.harness.workPlan.currentStepIndex, 3);
  assert.equal(approvalStep?.status, 'blocked');
  assert.equal(approvalStep?.approvalSignalKind, 'write-approval-required');
  assert.equal(parseCompactAgentRunResult(approvalCompact).kind, 'infra-agent.agent-result');

  const approvalWarnCompact = buildCompactAgentRunResult({
    ...approvalState,
    modelName: 'rule-based-fallback'
  });
  assert.match(approvalWarnCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
  assert.ok(approvalWarnCompact.suggestedCommands.some(command => /--approve-write-risk medium/.test(command)));
  assert.doesNotMatch(approvalWarnCompact.approval.resume.command ?? '', /doctor/);

  const validationCompact = buildCompactAgentRunResult(makeState({
    outcome: 'validation-blocked',
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const validationStep = validationCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(validationCompact.harness.workPlan.status, 'blocked');
  assert.equal(validationCompact.harness.workPlan.blockerKind, 'validation');
  assert.equal(validationCompact.harness.workPlan.currentStepIndex, 4);
  assert.equal(validationStep?.status, 'blocked');
  assert.equal(validationStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(validationCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'helm-missing-service-port');
  assert.equal(parseCompactAgentRunResult(validationCompact).kind, 'infra-agent.agent-result');

  const repairCompact = buildCompactAgentRunResult(makeState({
    outcome: 'repair-budget-exhausted',
    repairAttempts: 2,
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const repairStep = repairCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(repairCompact.harness.workPlan.status, 'blocked');
  assert.equal(repairCompact.harness.workPlan.blockerKind, 'repair-budget');
  assert.equal(repairCompact.harness.workPlan.nextControlAction, 'manual-repair');
  assert.equal(repairStep?.status, 'blocked');
  assert.equal(repairStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(repairCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, null);
  assert.equal(parseCompactAgentRunResult(repairCompact).kind, 'infra-agent.agent-result');

  const completedCompact = buildCompactAgentRunResult(makeState({
    outcome: 'completed',
    toolSummaries: [readFileSummary],
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 0,
        stdout: 'ok',
        stderr: ''
      }
    ]
  }));
  assert.equal(completedCompact.harness.workPlan.status, 'completed');
  assert.equal(completedCompact.harness.workPlan.blockerKind, 'none');
  assert.equal(completedCompact.harness.workPlan.currentStepIndex, null);
  assert.equal(completedCompact.harness.workPlan.skippedStepCount, 1);
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'edit'
    && step.status === 'skipped'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'validation'
    && step.status === 'completed'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'handoff'
    && step.status === 'completed'
  ));
  assert.equal(parseCompactAgentRunResult(completedCompact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...completedCompact,
      harness: {
        ...completedCompact.harness,
        workPlan: {
          ...completedCompact.harness.workPlan,
          currentStepIndex: 3
        }
      }
    }),
    /harness\.workPlan\.currentStepIndex must be null/
  );

  const noSafeCompact = buildCompactAgentRunResult(makeState({
    outcome: 'no-safe-action'
  }));
  assert.equal(noSafeCompact.harness.workPlan.status, 'blocked');
  assert.equal(noSafeCompact.harness.workPlan.blockerKind, 'no-safe-action');
  assert.equal(noSafeCompact.harness.workPlan.nextControlAction, 'inspect-readiness-or-targeting');
  assert.equal(noSafeCompact.harness.workPlan.currentStepIndex, 5);
  assert.equal(parseCompactAgentRunResult(noSafeCompact).kind, 'infra-agent.agent-result');
});

test('agent CLI compact JSON includes work plan handoff', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'add ingress to payments-api dev chart',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--max-turns',
      '1',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.equal(compact.outcome, 'no-safe-action');
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.blockerKind, compact.harness.plannerHandoff.activeBlocker.kind);
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.includedCount, compact.harness.workPlan.includedCount);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.omittedCount, compact.harness.workPlan.omittedCount);
    assert.ok(compact.resultCard.some(line => /Work plan: blocked; current handoff\/blocked; completed \d+\/6; blocked \d+; skipped \d+; next/i.test(line)));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.noSafeAction);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('agent CLI compact JSON preserves explicit approval grants', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'update payments-api chart deeply',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--approve-write-risk',
      'high',
      '--approve-write-path',
      'charts/payments-api',
      '--approve-tool-category',
      'native-stack-config-write',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.deepEqual(compact.approval.grants, {
      approvedWriteRisks: ['high'],
      approvedWritePaths: ['charts/payments-api'],
      approvedToolCategories: ['native-stack-config-write'],
      writePathScope: 'scoped',
      hasExplicitApproval: true
    });
    assert.ok(compact.resultCard.some(line =>
      /Approval grants: write risks high; write paths charts\/payments-api; tool categories native-stack-config-write; write path scope scoped/i.test(line)
    ));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.clarificationRequired);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('buildCompactAgentRunResult exposes skipped turn execution reasons', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const state = {
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'low',
          action: {
            kind: 'validate-targets',
            summary: 'Validation skipped',
            rationale: 'No command payload was available.',
            payload: {
              commands: [],
              actionFamily: 'helm-validation'
            }
          }
        },
        execution: {
          status: 'skipped',
          executedTools: [],
          reason: 'No validation commands were present in the decision payload.'
        },
        runtimeSnapshot: runtime
      }
    ]
  };
  const compact = buildCompactAgentRunResult(state);

  assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'skipped');
  assert.equal(compact.harness.lifecycleEvents.totalCount, 3);
  assert.equal(compact.harness.lifecycleEvents.includedCount, 3);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
  assert.ok(compact.harness.lifecycleEvents.events.some(event =>
    event.event === 'decision'
    && event.actionKind === 'validate-targets'
    && event.executionStatus === 'skipped'
    && /No validation commands/.test(event.reason ?? '')
  ));
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
  assert.equal(
    compact.harness.turnTrace[0]?.executionReason,
    'No validation commands were present in the decision payload.'
  );
  assert.deepEqual(compact.harness.plannerHandoff.lastAction, {
    kind: 'validate-targets',
    family: 'helm-validation',
    stopReason: null,
    clarificationKind: null,
    executionStatus: 'skipped'
  });
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult preserves capped tool trace tail window', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const toolSummaries = Array.from({ length: 10 }, (_, index) => ({
    turnIndex: index,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    summary: `Read target file ${index}.`
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries,
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  assert.equal(compact.harness.toolTrace.totalCount, 10);
  assert.equal(compact.harness.toolTrace.maxEntries, 8);
  assert.equal(compact.harness.toolTrace.includedCount, 8);
  assert.equal(compact.harness.toolTrace.omittedCount, 2);
  assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
  assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, 2);
  assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, 9);
  assert.equal(compact.harness.toolTrace.latestTurnIndex, 9);
  assert.deepEqual(
    compact.harness.toolTrace.entries.map(entry => entry.turnIndex),
    [2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult exposes turn trace budget metadata when capped', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const turns = Array.from({ length: 12 }, (_, index) => ({
    index,
    decision: {
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: `Inspect turn ${index}`,
        rationale: 'Synthetic capped trace coverage.',
        payload: {
          actionFamily: 'runtime-inspection'
        }
      }
    },
    execution: {
      status: 'completed',
      executedTools: [],
      reason: null
    },
    runtimeSnapshot: runtime
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns
  });

  assert.equal(compact.harness.turnTrace.length, 10);
  assert.equal(compact.harness.turnTraceOmittedCount, 2);
  assert.deepEqual(compact.harness.turnTraceBudget, {
    maxEntries: 10,
    totalCount: 12,
    includedCount: 10,
    omittedCount: 2,
    firstIncludedTurnIndex: 0,
    lastIncludedTurnIndex: 9,
    preservedWindow: 'head'
  });
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult includes budgeted validation command summaries', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const longStdout = 'x'.repeat(420);
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [
      {
        command: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
        exitCode: 0,
        stdout: 'YAML ok',
        stderr: ''
      },
      {
        command: 'terraform -chdir=terraform/payments-api validate',
        exitCode: 1,
        stdout: longStdout,
        stderr: 'Error: Missing required argument'
      },
      {
        command: 'terraform -chdir=terraform/payments-api apply -auto-approve',
        exitCode: 1,
        stdout: '',
        stderr: 'infra-agent blocked unsafe validation command: Terraform apply is not validation [terraform-apply]'
      }
    ],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime,
    turns: []
  });

  assert.equal(compact.validation.commands.maxEntries, 8);
  assert.equal(compact.validation.commands.omittedCount, 0);
  assert.equal(compact.validation.commands.entries[0]?.kind, 'yaml-guard');
  assert.equal(compact.validation.commands.entries[1]?.status, 'failed');
  assert.equal(compact.validation.commands.entries[1]?.stdoutPreview.length, 303);
  assert.equal(compact.validation.commands.entries[1]?.unsafeRuleId, null);
  assert.equal(compact.validation.commands.entries[1]?.unsafeReason, null);
  assert.equal(compact.validation.commands.entries[2]?.unsafeBlocked, true);
  assert.equal(compact.validation.commands.entries[2]?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    compact.validation.commands.entries[2]?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(Object.hasOwn(compact, 'runtime'), false);
});

test('buildCompactAgentRunResult includes grouped validation issue summary', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const validationIssues = [
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate',
      message: 'Missing required argument.'
    },
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate -json',
      message: 'Missing required argument.'
    },
    {
      kind: 'yaml-syntax-failure',
      repairable: false,
      sourceCommand: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
      message: 'YAML syntax failed.',
      metadata: {
        yamlPath: 'terraform/payments-api/dev.auto.tfvars',
        yamlParser: 'yaml'
      }
    },
    {
      kind: 'unsafe-validation-command',
      repairable: false,
      sourceCommand: 'terraform -chdir=terraform/payments-api apply',
      message: 'Unsafe validation command blocked.',
      metadata: {
        unsafeCommand: 'terraform -chdir=terraform/payments-api apply',
        unsafeReason: 'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
      }
    },
    {
      kind: 'helm-missing-service-port',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'service.port is required.'
    },
    {
      kind: 'helm-missing-ingress-values',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'ingress.enabled is required.'
    },
    {
      kind: 'pulumi-missing-config',
      repairable: true,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Missing stack config.'
    },
    {
      kind: 'pulumi-preview-failure',
      repairable: false,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Preview failed.'
    },
    {
      kind: 'terraform-formatting-required',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api fmt -check',
      message: 'Terraform formatting is required.'
    },
    {
      kind: 'unknown-validation-failure',
      repairable: false,
      sourceCommand: 'custom validate',
      message: 'Unknown validation failed.'
    }
  ];
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues,
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const compact = buildCompactAgentRunResult(state);
  const resultCard = summarizeResultCard(state);

  assert.equal(compact.validation.issueSummary.totalCount, 10);
  assert.equal(compact.validation.issueSummary.omittedIssueCount, 5);
  assert.equal(compact.validation.issueSummary.repairableCount, 6);
  assert.equal(compact.validation.issueSummary.nonRepairableCount, 4);
  assert.equal(compact.validation.issueSummary.maxGroups, 8);
  assert.equal(compact.validation.issueSummary.groups.length, 8);
  assert.equal(compact.validation.issueSummary.omittedGroupCount, 1);
  assert.deepEqual(compact.validation.issueSummary.groups[0], {
    kind: 'terraform-validate-failure',
    repairable: true,
    count: 2,
    sourceCommandCount: 2,
    blocking: true
  });
  assert.deepEqual(compact.validation.issueSummary.flags, {
    hasRepairableIssues: true,
    hasNonRepairableIssues: true,
    hasUnsafeValidationCommand: true,
    hasYamlSyntaxFailure: true,
    hasIdentityConflict: false
  });
  assert.deepEqual(compact.validation.issueDetails, {
    maxEntries: 5,
    omittedCount: 5
  });
  assert.equal(compact.validation.issueDetails.omittedCount, compact.validation.issueSummary.omittedIssueCount);
  assert.equal(compact.validation.safetyBlockers.maxEntries, 5);
  assert.equal(compact.validation.safetyBlockers.omittedCount, 0);
  assert.equal(compact.validation.safetyBlockers.entries.length, 2);
  const yamlSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'yaml-syntax-failure');
  const unsafeSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'unsafe-validation-command');
  assert.equal(yamlSafetyBlocker?.mutationPrevented, true);
  assert.equal(yamlSafetyBlocker?.yamlPath, 'terraform/payments-api/dev.auto.tfvars');
  assert.equal(yamlSafetyBlocker?.yamlParser, 'yaml');
  assert.equal(yamlSafetyBlocker?.unsafeRuleId, null);
  assert.equal(unsafeSafetyBlocker?.mutationPrevented, true);
  assert.equal(unsafeSafetyBlocker?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply');
  assert.equal(unsafeSafetyBlocker?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    unsafeSafetyBlocker?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(compact.validation.issues.length, 5);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'validation');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'terraform-validate-failure');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'resolve-validation');
  assert.ok(resultCard.some(line => /Validation blockers: 10 issue\(s\); 6 repairable, 4 non-repairable; top terraform-validate-failure x2; omitted issues=5, groups=1/i.test(line)));
});

test('buildCompactAgentRunResult maps planner handoff controls by outcome', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const retrievedContextBudget = {
    maxPackets: 5,
    maxTokens: 1000,
    maxExcerptChars: 600
  };
  const makeTurn = (actionKind = 'stop', payload = { stopReason: 'done' }) => ({
    index: 0,
    decision: {
      action: {
        kind: actionKind,
        summary: `${actionKind} summary`,
        payload
      },
      confidence: 0.9
    },
    execution: {
      status: 'skipped',
      reason: null,
      executedTools: []
    },
    runtimeSnapshot: {
      appliedWrites: [],
      validationIssues: [],
      approvalSignals: []
    }
  });
  const makeState = ({
    outcome,
    runtime = {},
    turns = [makeTurn()],
    maxTurns = 6,
    maxRepairAttempts = 2
  }) => ({
    modelName: 'test-model',
    outcome,
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
      lastEditPlan: null,
      retrievedContext: [],
      retrievedContextBudget,
      ...runtime
    },
    turns,
    config: {
      maxTurns,
      maxRepairAttempts,
      retrievedContextBudget
    }
  });
  const cases = [
    {
      name: 'completed',
      state: makeState({ outcome: 'completed' }),
      activeBlockerKind: 'none',
      nextControlAction: 'review-result'
    },
    {
      name: 'approval-required',
      state: makeState({
        outcome: 'approval-required',
        runtime: {
          approvalSignals: [
            {
              kind: 'write-approval-required',
              path: 'charts/payments-api/values.yaml',
              risk: 'high',
              message: 'Approval required.'
            }
          ]
        }
      }),
      activeBlockerKind: 'approval',
      nextControlAction: 'request-approval',
      approvalSignalKind: 'write-approval-required'
    },
    {
      name: 'clarification-required',
      state: makeState({
        outcome: 'clarification-required',
        turns: [makeTurn('ask-for-clarification', {
          actionFamily: 'helm-edit',
          clarificationKind: 'target',
          question: 'Which target should be changed?'
        })]
      }),
      activeBlockerKind: 'clarification',
      nextControlAction: 'answer-clarification'
    },
    {
      name: 'validation-blocked',
      state: makeState({
        outcome: 'validation-blocked',
        runtime: {
          validationIssues: [
            {
              kind: 'terraform-validate-failure',
              repairable: true,
              sourceCommand: 'terraform -chdir=terraform/payments-api validate',
              message: 'Missing required argument.'
            }
          ]
        }
      }),
      activeBlockerKind: 'validation',
      nextControlAction: 'resolve-validation',
      validationIssueKind: 'terraform-validate-failure'
    },
    {
      name: 'repair-budget-exhausted',
      state: makeState({
        outcome: 'repair-budget-exhausted',
        runtime: {
          repairAttempts: 2
        },
        maxRepairAttempts: 2
      }),
      activeBlockerKind: 'repair-budget',
      nextControlAction: 'manual-repair'
    },
    {
      name: 'no-safe-action',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 3
      }),
      activeBlockerKind: 'no-safe-action',
      nextControlAction: 'inspect-readiness-or-targeting'
    },
    {
      name: 'turn-budget',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 1
      }),
      activeBlockerKind: 'turn-budget',
      nextControlAction: 'rerun-with-larger-turn-budget'
    }
  ];

  for (const entry of cases) {
    const handoff = buildCompactAgentRunResult(entry.state).harness.plannerHandoff;
    assert.equal(handoff.activeBlocker.kind, entry.activeBlockerKind, entry.name);
    assert.equal(handoff.nextControlAction, entry.nextControlAction, entry.name);
    assert.equal(handoff.activeBlocker.validationIssueKind, entry.validationIssueKind ?? null, entry.name);
    assert.equal(handoff.activeBlocker.approvalSignalKind, entry.approvalSignalKind ?? null, entry.name);
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
    '--max-repair-attempts',
    '0',
    '--context-packet-limit',
    '2',
    '--context-token-budget',
    '500',
    '--approve-tool-category',
    'native-stack-config-write',
    '--json'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.task, 'add ingress to payments-api dev chart');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.planner, 'rule-based');
  assert.equal(parsed.maxTurns, 1);
  assert.equal(parsed.maxRepairAttempts, 0);
  assert.equal(parsed.contextPacketLimit, 2);
  assert.equal(parsed.contextTokenBudget, 500);
  assert.deepEqual(parsed.approvedToolCategories, ['native-stack-config-write']);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, false);
});

test('agent CLI args parse write approval resume scope with query budget flags', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--max-turns',
    '3',
    '--max-repair-attempts',
    '0',
    '--context-packet-limit',
    '2',
    '--context-token-budget',
    '500',
    '--approve-write-risk',
    'high',
    '--approve-write-path',
    'charts/payments-api/values.yaml',
    '--json-full'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.task, 'add ingress to payments-api dev chart');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.maxTurns, 3);
  assert.equal(parsed.maxRepairAttempts, 0);
  assert.equal(parsed.contextPacketLimit, 2);
  assert.equal(parsed.contextTokenBudget, 500);
  assert.deepEqual(parsed.approvedWriteRisks, ['high']);
  assert.deepEqual(parsed.approvedWritePaths, ['charts/payments-api/values.yaml']);
  assert.deepEqual(parsed.approvedToolCategories, []);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, true);
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

test('CLI version command reads package metadata', async () => {
  const parsedLong = parseArgs(['--version']);
  const parsedCommand = parseArgs(['version']);
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(parsedLong.command, 'version');
  assert.equal(parsedCommand.command, 'version');
  assert.equal(await readPackageVersion(), packageJson.version);
});

test('doctor command reports install and workspace readiness', async () => {
  const parsed = parseArgs(['doctor', 'fixtures/sample-workspace', '--json']);
  const report = await buildDoctorReport('fixtures/sample-workspace', {});

  assert.equal(parsed.command, 'doctor');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.json, true);
  assert.equal(report.kind, 'infra-agent.doctor');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.version, await readPackageVersion());
  assert.ok(report.workspaceRoot.endsWith('fixtures/sample-workspace'));
  assert.ok(report.checks.some(check => check.name === 'package' && check.status === 'pass'));
  assert.ok(report.checks.some(check =>
    check.name === 'agent-surface'
      && check.status === 'pass'
      && /AGENTS\.md/.test(check.detail ?? '')
      && /skills\//.test(check.detail ?? '')
      && /context-validation-and-impact\.md/.test(check.detail ?? '')
  ));
  const agentSurfaceCheck = report.checks.find(check => check.name === 'agent-surface');
  assert.doesNotMatch(agentSurfaceCheck?.detail ?? '', /fixtures\/|test\/|tests\/|scripts\//);
  assert.ok(report.checks.some(check => check.name === 'node' && check.status === 'pass'));
  assert.ok(report.checks.some(check => check.name === 'planner' && check.status === 'warn' && check.detail === 'rule-based-fallback'));
  assert.ok(report.checks.some(check => check.name === 'workspace' && check.status === 'pass'));
  assert.ok(report.checks.some(check => check.name === 'validation-plan'));
  assert.ok(report.checks.some(check => check.name === 'validator:helm'));
  assert.equal(report.summary.failCount, report.checks.filter(check => check.status === 'fail').length);
});

test('doctor command reports configured LLM planner without exposing secrets', async () => {
  const report = await buildDoctorReport('fixtures/sample-workspace', {
    INFRA_AGENT_OPENAI_API_KEY: 'secret-value',
    INFRA_AGENT_MODEL: 'doctor-test-model',
    INFRA_AGENT_OPENAI_BASE_URL: 'https://planner.example.test/v1/'
  });
  const plannerCheck = report.checks.find(check => check.name === 'planner');

  assert.equal(plannerCheck?.status, 'pass');
  assert.match(plannerCheck?.message ?? '', /doctor-test-model/);
  assert.equal(plannerCheck?.detail, 'model=doctor-test-model, baseUrl=https://planner.example.test/v1');
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
});

test('CLI exit codes map agent outcomes for downstream agents', async () => {
  assert.equal(exitCodeForAgentOutcome('completed'), INFRA_AGENT_EXIT_CODES.success);
  assert.equal(exitCodeForAgentOutcome('validation-blocked'), INFRA_AGENT_EXIT_CODES.validationBlocked);
  assert.equal(exitCodeForAgentOutcome('approval-required'), INFRA_AGENT_EXIT_CODES.approvalRequired);
  assert.equal(exitCodeForAgentOutcome('clarification-required'), INFRA_AGENT_EXIT_CODES.clarificationRequired);
  assert.equal(exitCodeForAgentOutcome('no-safe-action'), INFRA_AGENT_EXIT_CODES.noSafeAction);
  assert.equal(exitCodeForAgentOutcome('repair-budget-exhausted'), INFRA_AGENT_EXIT_CODES.repairBudgetExhausted);

  const blockedPreflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');
  const readyPreflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(blockedPreflight.blockers.length > 0);
  assert.equal(exitCodeForRunPreflight(blockedPreflight), INFRA_AGENT_EXIT_CODES.preflightBlocked);
  assert.equal(exitCodeForRunPreflight(readyPreflight), INFRA_AGENT_EXIT_CODES.success);
});

test('package metadata exposes only the installable CLI and skill surface', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const binContent = await readFile('bin/infra-agent.js', 'utf8');
  const infraSkillContent = await readFile('skills/infra-configuration/SKILL.md', 'utf8');
  const infraSkillReferenceContent = await readFile(
    'skills/infra-configuration/references/context-validation-and-impact.md',
    'utf8'
  );

  assert.equal(packageJson.bin?.['infra-agent'], './bin/infra-agent.js');
  assert.equal(packageJson.engines?.node, '>=24.0.0');
  assert.deepEqual(packageJson.files, [
    'bin/',
    'src/',
    'skills/',
    'AGENTS.md',
    'README.md',
    'docs/AGENT_RULES.md',
    'docs/CLAUDE_CODE_AGENT_PATTERNS.md',
    'docs/ROADMAP.md'
  ]);
  assert.ok(!packageJson.files.includes('fixtures/'));
  assert.ok(!packageJson.files.includes('test/'));
  assert.ok(!packageJson.files.includes('tests/'));
  assert.ok(!packageJson.files.includes('scripts/'));
  assert.ok(!packageJson.files.includes('docs/HANDOFF.md'));
  assert.match(binContent, /cwd:\s*process\.cwd\(\)/);
  assert.doesNotMatch(binContent, /cwd:\s*projectRoot/);
  assert.match(infraSkillContent, /handoffCheckpoint/);
  assert.match(infraSkillContent, /mutationAllowed=false/);
  assert.match(infraSkillContent, /harness\.plannerHandoff/);
  assert.match(infraSkillContent, /harness\.targeting/);
  assert.match(infraSkillContent, /harness\.workPlan/);
  assert.match(infraSkillContent, /harness\.repairBudget/);
  assert.match(infraSkillContent, /harness\.turnTraceBudget/);
  assert.match(infraSkillContent, /harness\.lifecycleEvents/);
  assert.match(infraSkillContent, /harness\.toolTrace/);
  assert.match(infraSkillContent, /harness\.toolPermissionSummary/);
  assert.match(infraSkillContent, /readiness/);
  assert.match(infraSkillContent, /doctorCommand/);
  assert.match(infraSkillContent, /validation\.selectedPlan/);
  assert.match(infraSkillContent, /validation\.commands/);
  assert.match(infraSkillContent, /validation\.issueSummary/);
  assert.match(infraSkillContent, /validation\.issueDetails/);
  assert.match(infraSkillContent, /validation\.issues/);
  assert.match(infraSkillContent, /validation\.safetyBlockers/);
  assert.match(infraSkillContent, /validation\.identityConflictSummary/);
  assert.match(infraSkillContent, /runtimeIdentityConflictSummary/);
  assert.match(infraSkillContent, /summary\.sourceProvenance/);
  assert.match(infraSkillContent, /reviewTargetBudget/);
  assert.match(infraSkillContent, /approval\.resume/);
  assert.match(infraSkillContent, /approval\.grants/);
  assert.match(infraSkillContent, /additionalCommands/);
  assert.match(infraSkillContent, /knowledgeCache/);
  assert.match(infraSkillContent, /knowledgeContext/);
  assert.match(infraSkillContent, /references\/context-validation-and-impact\.md/);
  assert.match(infraSkillReferenceContent, /Compact Contract Checklist/);
  assert.match(infraSkillReferenceContent, /harness\.targeting/);
  assert.match(infraSkillReferenceContent, /harness\.workPlan/);
  assert.match(infraSkillReferenceContent, /harness\.toolTrace/);
  assert.match(infraSkillReferenceContent, /tail/);
  assert.match(infraSkillReferenceContent, /handoffCheckpoint\.continuation\.command/);
  assert.match(infraSkillReferenceContent, /raw-content exclusions/);
  assert.match(infraSkillReferenceContent, /validation\.identityConflictSummary/);
  assert.match(infraSkillReferenceContent, /approval\.resume/);
  assert.match(infraSkillReferenceContent, /approval\.grants/);
  assert.match(infraSkillReferenceContent, /additionalCommands/);
  assert.match(infraSkillReferenceContent, /primary signal/);
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

test('identity-report CLI args accept compact result input path', () => {
  const parsed = parseArgs([
    'identity-report',
    'agent-result.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'identity-report');
  assert.equal(parsed.inputPath, 'agent-result.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('impact-report CLI args accept infra graph input path', () => {
  const parsed = parseArgs([
    'impact-report',
    'graph.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'impact-report');
  assert.equal(parsed.inputPath, 'graph.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('report CLI commands emit read-only JSON through the entrypoint', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-report-cli-'));
  const identityInputPath = join(tempRoot, 'agent-result.json');
  const graphInputPath = join(tempRoot, 'graph.json');

  try {
    await writeFile(identityInputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'review terraform listener rule conflict',
      workspaceRoot: '/workspace',
      outcome: 'validation-blocked',
      modelName: 'rule-based',
      turnsUsed: 1,
      profileId: 'generic',
      requestedDomains: ['terraform'],
      changedFiles: [],
      resultCard: [],
      nextSteps: [],
      suggestedCommands: [],
      handoffCheckpoint: {
        schemaVersion: 1,
        source: 'agent-result',
        compact: true,
        primaryArtifact: 'agent --json',
        debugArtifact: 'agent --json-full',
        mutationAllowed: false,
        exclusions: {
          rawRuntimeIncluded: false,
          rawPreflightIncluded: false,
          rawToolOutputIncluded: false,
          rawPromptIncluded: false,
          rawKnowledgeExcerptIncluded: false
        },
        summary: {
          outcome: 'validation-blocked',
          activeBlocker: 'validation',
          nextControlAction: 'resolve-validation',
          readinessStatus: 'pass',
          validationStatus: 'failed',
          validationIssueCount: 1,
          identityConflictCount: 1,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture(),
        continuation: {
          required: true,
          reason: 'validation',
          nextControlAction: 'resolve-validation',
          approvalRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          mutationAllowed: false
        },
        durableSections: [
          'root',
          'harness',
          'validation',
          'approval',
          'knowledge',
          'readiness',
          'result-card'
        ]
      },
      validation: {
        status: 'failed',
        selectedPlan: [],
        issueSummary: {
          totalCount: 1,
          omittedIssueCount: 0,
          repairableCount: 0,
          nonRepairableCount: 1,
          maxGroups: 8,
          omittedGroupCount: 0,
          groups: [
            {
              kind: 'terraform-create-before-delete-conflict',
              repairable: false,
              count: 1,
              sourceCommandCount: 1,
              blocking: true
            }
          ],
          flags: {
            hasRepairableIssues: false,
            hasNonRepairableIssues: true,
            hasUnsafeValidationCommand: false,
            hasYamlSyntaxFailure: false,
            hasIdentityConflict: true
          }
        },
        issueDetails: {
          maxEntries: 5,
          omittedCount: 0
        },
        issues: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            message: 'Listener rule priority is already in use.',
            guidance: 'Review Terraform listener rule ownership before changing the priority.',
            metadata: {
              listenerRulePriorities: '100'
            }
          }
        ],
        safetyBlockers: {
          maxEntries: 5,
          omittedCount: 0,
          entries: []
        },
        identityConflictSummary: {
          totalCount: 1,
          includedCount: 1,
          maxEntries: 5,
          omittedCount: 0,
          mutationAllowed: false,
          byEngine: {
            terraform: 1,
            pulumi: 0
          },
          byRiskCategory: {
            'create-before-delete-ordering': 1,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        },
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
              'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
            ],
            suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
            sourceCommand: 'terraform -chdir=terraform/payments-api plan'
          }
        ]
      },
      approval: {
        requiredWriteRisks: [],
        requiredToolCategories: [],
        grants: buildEmptyApprovalGrantsFixture(),
        signals: [],
        resume: {
          continuationRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          primarySignal: null,
          additionalCommands: [],
          additionalSignalCount: 0,
          additionalWriteRisks: [],
          additionalWritePaths: [],
          additionalToolCategories: [],
          writeRisks: [],
          writePaths: [],
          toolCategories: [],
          signalCount: 0
        }
      },
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'workspace-config: knowledgeCache.root'
      },
      knowledgeContext: {
        maxPackets: 5,
        maxTokens: 1000,
        maxExcerptChars: 1200,
        totalPacketCount: 0,
        includedPacketCount: 0,
        omittedPacketCount: 0,
        includedTokenEstimate: 0,
        omittedTokenEstimate: 0,
        omittedByPacketLimit: 0,
        omittedByTokenBudget: 0,
        packets: []
      }
    }), 'utf8');

    await writeFile(graphInputPath, JSON.stringify({
      kind: 'infra-agent.infra-graph',
      schemaVersion: 1,
      mutationAllowed: false,
      workspaceRoot: '/workspace',
      nodes: [],
      edges: [],
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        nodesByKind: {},
        edgesByKind: {}
      }
    }), 'utf8');

    const identityOutput = await captureStdout(() => main([
      'identity-report',
      identityInputPath,
      '--json'
    ]));
    const identityReport = JSON.parse(identityOutput);
    assert.equal(identityReport.kind, 'infra-agent.identity-conflict-report');
    assert.equal(identityReport.mutationAllowed, false);
    assert.equal(identityReport.incidentCount, 1);
    assert.equal(identityReport.incidentSummary.byEngine.terraform, 1);

    const impactOutput = await captureStdout(() => main([
      'impact-report',
      graphInputPath,
      '--json'
    ]));
    const impactReport = JSON.parse(impactOutput);
    assert.equal(impactReport.kind, 'infra-agent.infra-graph-impact-report');
    assert.equal(impactReport.mutationAllowed, false);
    assert.equal(impactReport.sourceKind, 'infra-agent.infra-graph');
    assert.equal(impactReport.counts.plannedChanges, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('infra graph contract validates shallow impact handoff shape', () => {
  const validGraph = {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: 'fixtures/sample-workspace',
    nodes: [
      {
        id: 'workspace',
        kind: 'workspace',
        label: 'sample workspace',
        path: null,
        domain: 'workspace',
        confidence: 'high',
        source: 'workspace-inspection'
      },
      {
        id: 'terraform-root:infra',
        kind: 'terraform-root',
        label: 'infra',
        path: 'infra',
        domain: 'terraform',
        confidence: 'medium',
        source: 'terraform-plan'
      }
    ],
    edges: [
      {
        id: 'edge-1',
        from: 'workspace',
        to: 'terraform-root:infra',
        kind: 'possible-rename',
        confidence: 'medium',
        source: 'terraform-plan',
        label: 'possible Terraform address rename'
      }
    ],
    summary: {
      nodeCount: 2,
      edgeCount: 1,
      nodesByKind: {
        workspace: 1,
        'terraform-root': 1
      },
      edgesByKind: {
        'possible-rename': 1
      },
      impact: {
        dependencyEdges: 0,
        createBeforeDeleteConflicts: 0,
        mutationAllowed: false,
        omittedReviewTargets: 0,
        plannedChanges: 0,
        possibleRenames: 1,
        primaryConcern: 'none',
        recommendedAction: 'none',
        replacementCascades: 0,
        reviewSteps: [],
        reviewTargetBudget: {
          maxTargets: 5,
          totalTargets: 1,
          includedTargets: 1,
          omittedTargets: 0
        },
        reviewTargets: [
          {
            edgeId: 'edge-1',
            kind: 'possible-rename',
            priority: 1,
            from: 'workspace',
            to: 'terraform-root:infra',
            confidence: 'medium',
            source: 'terraform-plan',
            mutationAllowed: false,
            recommendedAction: 'review-possible-renames',
            riskCategory: 'possible-rename-review',
            reviewSteps: []
          }
        ],
        riskLevel: 'none'
      }
    }
  };

  assert.equal(parseInfraGraphResult(validGraph).kind, 'infra-agent.infra-graph');
  assert.throws(
    () => parseInfraGraphResult({ ...validGraph, kind: 'infra-agent.agent-result' }),
    /infra-agent\.infra-graph/
  );
  assert.throws(
    () => parseInfraGraphResult({ ...validGraph, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => parseInfraGraphResult({ ...validGraph, mutationAllowed: true }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseInfraGraphResult({ ...validGraph, workspaceRoot: null }),
    /workspaceRoot/
  );
  assert.throws(
    () => parseInfraGraphResult({ ...validGraph, nodes: {} }),
    /nodes array/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodeCount: '0'
      }
    }),
    /summary\.nodeCount/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodeCount: 3
      }
    }),
    /summary\.nodeCount.*nodes\.length/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgeCount: 2
      }
    }),
    /summary\.edgeCount.*edges\.length/
  );
  assert.equal(parseInfraGraphResult({
    ...validGraph,
    summary: {
      ...validGraph.summary,
      nodesByKind: {
        ...validGraph.summary.nodesByKind,
        'helm-chart': 0
      },
      edgesByKind: {
        ...validGraph.summary.edgesByKind,
        'depends-on': 0
      }
    }
  }).summary.nodesByKind['helm-chart'], 0);
  assert.deepEqual(parseInfraGraphResult({
    ...validGraph,
    summary: {
      ...validGraph.summary,
      sourceProvenance: {
        sources: [
          {
            source: 'workspace-inspection',
            nodeCount: 1,
            edgeCount: 0,
            totalCount: 1
          },
          {
            source: 'terraform-plan',
            nodeCount: 1,
            edgeCount: 1,
            totalCount: 2
          }
        ],
        hasWorkspaceInspection: true,
        hasTerraformPlan: true,
        hasPulumiPreview: false
      }
    }
  }).summary.sourceProvenance.sources, [
    {
      source: 'workspace-inspection',
      nodeCount: 1,
      edgeCount: 0,
      totalCount: 1
    },
    {
      source: 'terraform-plan',
      nodeCount: 1,
      edgeCount: 1,
      totalCount: 2
    }
  ]);
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: {},
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources.*array/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'manual',
              nodeCount: 0,
              edgeCount: 0,
              totalCount: 0
            },
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 0,
              totalCount: 1
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources\[0\]\.source.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: -1,
              edgeCount: 0,
              totalCount: 0
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources\[0\]\.nodeCount.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 0,
              totalCount: 3
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources\[0\]\.totalCount.*nodeCount \+ edgeCount/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources\[0\]\.edgeCount.*actual edge source totals/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 0,
              totalCount: 1
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.sources.*terraform-plan/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 0,
              totalCount: 1
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: 'yes',
          hasTerraformPlan: true,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.hasWorkspaceInspection.*boolean/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        sourceProvenance: {
          sources: [
            {
              source: 'workspace-inspection',
              nodeCount: 1,
              edgeCount: 0,
              totalCount: 1
            },
            {
              source: 'terraform-plan',
              nodeCount: 1,
              edgeCount: 1,
              totalCount: 2
            }
          ],
          hasWorkspaceInspection: true,
          hasTerraformPlan: false,
          hasPulumiPreview: false
        }
      }
    }),
    /summary\.sourceProvenance\.hasTerraformPlan.*actual node and edge sources/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodesByKind: []
      }
    }),
    /summary\.nodesByKind.*object/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgesByKind: null
      }
    }),
    /summary\.edgesByKind.*object/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodesByKind: {
          ...validGraph.summary.nodesByKind,
          database: 1
        }
      }
    }),
    /summary\.nodesByKind\.database.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgesByKind: {
          ...validGraph.summary.edgesByKind,
          'routes-to': 1
        }
      }
    }),
    /summary\.edgesByKind\.routes-to.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodesByKind: {
          ...validGraph.summary.nodesByKind,
          workspace: -1
        }
      }
    }),
    /summary\.nodesByKind\.workspace.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgesByKind: {
          ...validGraph.summary.edgesByKind,
          contains: 1.5
        }
      }
    }),
    /summary\.edgesByKind\.contains.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodesByKind: {
          workspace: 1
        }
      }
    }),
    /summary\.nodesByKind\.terraform-root.*actual kind totals/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgesByKind: {}
      }
    }),
    /summary\.edgesByKind\.possible-rename.*actual kind totals/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        nodesByKind: {
          ...validGraph.summary.nodesByKind,
          workspace: 2
        }
      }
    }),
    /summary\.nodesByKind\.workspace.*actual kind totals/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        edgesByKind: {
          ...validGraph.summary.edgesByKind,
          'depends-on': 1
        }
      }
    }),
    /summary\.edgesByKind\.depends-on.*no matching entries/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        {
          ...validGraph.nodes[0],
          id: 123
        },
        validGraph.nodes[1]
      ]
    }),
    /nodes\[0\]\.id/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        validGraph.nodes[0],
        {
          ...validGraph.nodes[1],
          kind: 'database'
        }
      ]
    }),
    /nodes\[1\]\.kind.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        {
          ...validGraph.nodes[0],
          path: 42
        },
        validGraph.nodes[1]
      ]
    }),
    /nodes\[0\]\.path.*string or null/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        {
          ...validGraph.nodes[0],
          domain: 'kubernetes'
        },
        validGraph.nodes[1]
      ]
    }),
    /nodes\[0\]\.domain.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        {
          ...validGraph.nodes[0],
          confidence: 'certain'
        },
        validGraph.nodes[1]
      ]
    }),
    /nodes\[0\]\.confidence.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      nodes: [
        {
          ...validGraph.nodes[0],
          source: 'manual'
        },
        validGraph.nodes[1]
      ]
    }),
    /nodes\[0\]\.source.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          from: null
        }
      ]
    }),
    /edges\[0\]\.from/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          kind: 'routes-to'
        }
      ]
    }),
    /edges\[0\]\.kind.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          confidence: 'certain'
        }
      ]
    }),
    /edges\[0\]\.confidence.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          source: 'manual'
        }
      ]
    }),
    /edges\[0\]\.source.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          label: false
        }
      ]
    }),
    /edges\[0\]\.label.*string/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          mutationAllowed: true
        }
      }
    }),
    /summary\.impact\.mutationAllowed/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: null
      }
    }),
    /summary\.impact.*object/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          riskLevel: 'critical'
        }
      }
    }),
    /summary\.impact\.riskLevel.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          primaryConcern: 'state-mutation'
        }
      }
    }),
    /summary\.impact\.primaryConcern.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          recommendedAction: 'apply'
        }
      }
    }),
    /summary\.impact\.recommendedAction.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewSteps: ['Confirm source address move.', 42]
        }
      }
    }),
    /summary\.impact\.reviewSteps\[1\].*string/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargetBudget: undefined
        }
      }
    }),
    /summary\.impact\.reviewTargetBudget.*object/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargetBudget: {
            ...validGraph.summary.impact.reviewTargetBudget,
            maxTargets: -1
          }
        }
      }
    }),
    /summary\.impact\.reviewTargetBudget\.maxTargets.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargetBudget: {
            maxTargets: 5,
            totalTargets: 3,
            includedTargets: 1,
            omittedTargets: 1
          }
        }
      }
    }),
    /includedTargets \+ omittedTargets.*totalTargets/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargetBudget: {
            maxTargets: 0,
            totalTargets: 1,
            includedTargets: 1,
            omittedTargets: 0
          }
        }
      }
    }),
    /includedTargets.*maxTargets/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          omittedReviewTargets: 1
        }
      }
    }),
    /omittedReviewTargets.*reviewTargetBudget\.omittedTargets/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargetBudget: {
            maxTargets: 5,
            totalTargets: 2,
            includedTargets: 2,
            omittedTargets: 0
          }
        }
      }
    }),
    /includedTargets.*reviewTargets\.length/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              mutationAllowed: true
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.mutationAllowed/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              edgeId: 42
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.edgeId.*string/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              kind: 'planned-change'
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.kind.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              priority: 2
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.priority.*contiguous/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              recommendedAction: 'review-replacements'
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.recommendedAction.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              riskCategory: 'manual-review'
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.riskCategory.*supported/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              reviewSteps: ['Confirm target.', false]
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.reviewSteps\[1\].*string/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              identity: ['workspace']
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.identity.*string when present/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              edgeId: 'missing-edge'
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.edgeId.*existing graph edge/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          kind: 'contains'
        }
      ],
      summary: {
        ...validGraph.summary,
        edgesByKind: {
          contains: 1
        }
      }
    }),
    /reviewTargets\[0\]\.edgeId.*review-target graph edge/
  );
  assert.throws(
    () => parseInfraGraphResult({
      ...validGraph,
      summary: {
        ...validGraph.summary,
        impact: {
          ...validGraph.summary.impact,
          reviewTargets: [
            {
              ...validGraph.summary.impact.reviewTargets[0],
              confidence: 'high'
            }
          ]
        }
      }
    }),
    /reviewTargets\[0\]\.confidence.*referenced graph edge/
  );
});

test('infra graph impact report loader renders read-only graph impact summary', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-graph-report-'));
  const inputPath = join(tempRoot, 'graph.json');
  const graph = {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: 'fixtures/sample-workspace',
    nodes: [],
    edges: [
      {
        id: 'possible-rename:old->new',
        from: 'terraform-resource:old',
        to: 'terraform-resource:new',
        kind: 'possible-rename',
        confidence: 'medium',
        source: 'terraform-plan'
      },
      {
        id: 'contains:workspace->terraform-root:terraform/payments-api',
        from: 'workspace',
        to: 'terraform-root:terraform/payments-api',
        kind: 'contains',
        confidence: 'high',
        source: 'workspace-inspection'
      }
    ],
    summary: {
      nodeCount: 0,
      edgeCount: 2,
      nodesByKind: {},
      edgesByKind: {
        'contains': 1,
        'possible-rename': 1
      },
      impact: {
        dependencyEdges: 0,
        createBeforeDeleteConflicts: 0,
        mutationAllowed: false,
        omittedReviewTargets: 2,
        plannedChanges: 1,
        possibleRenames: 1,
        primaryConcern: 'possible-renames',
        recommendedAction: 'review-possible-renames',
        replacementCascades: 0,
        reviewSteps: ['Review possible rename before state operations.'],
        reviewTargets: [
          {
            edgeId: 'possible-rename:old->new',
            kind: 'possible-rename',
            priority: 1,
            from: 'terraform-resource:old',
            to: 'terraform-resource:new',
            confidence: 'medium',
            source: 'terraform-plan',
            mutationAllowed: false,
            recommendedAction: 'review-possible-renames',
            riskCategory: 'possible-rename-review',
            reviewSteps: ['Compare identity before any state move.']
          }
        ],
        reviewTargetBudget: {
          maxTargets: 5,
          totalTargets: 3,
          includedTargets: 1,
          omittedTargets: 2
        },
        riskLevel: 'medium'
      }
    }
  };

  try {
    await writeFile(inputPath, JSON.stringify(graph), 'utf8');
    const report = await loadInfraGraphImpactReport(inputPath);
    const directReport = buildInfraGraphImpactReport(parseInfraGraphResult(graph));

    assert.equal(report.kind, 'infra-agent.infra-graph-impact-report');
    assert.equal(report.sourceKind, 'infra-agent.infra-graph');
    assert.equal(report.sourceSchemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.riskLevel, 'medium');
    assert.equal(report.primaryConcern, 'possible-renames');
    assert.equal(report.recommendedAction, 'review-possible-renames');
    assert.equal(report.counts.possibleRenames, 1);
    assert.deepEqual(report.sourceProvenance.sources, [
      {
        source: 'terraform-plan',
        nodeCount: 0,
        edgeCount: 1,
        totalCount: 1
      },
      {
        source: 'workspace-inspection',
        nodeCount: 0,
        edgeCount: 1,
        totalCount: 1
      }
    ]);
    assert.equal(report.sourceProvenance.hasTerraformPlan, true);
    assert.equal(report.sourceProvenance.hasPulumiPreview, false);
    assert.equal(report.sourceProvenance.hasWorkspaceInspection, true);
    assert.equal(report.reviewTargetCount, 1);
    assert.equal(report.omittedReviewTargetCount, 2);
    assert.deepEqual(report.reviewTargetBudget, {
      maxTargets: 5,
      totalTargets: 3,
      includedTargets: 1,
      omittedTargets: 2
    });
    assert.equal(report.reviewTargets[0]?.mutationAllowed, false);
    assert.deepEqual(directReport.reviewTargetBudget, report.reviewTargetBudget);
    assert.deepEqual(directReport.counts, report.counts);
    assert.ok(report.summary.some(line => /mutation allowed=false/i.test(line)));

    const legacyReport = buildInfraGraphImpactReport({
      ...graph,
      summary: {
        ...graph.summary,
        impact: {
          ...graph.summary.impact,
          reviewTargetBudget: undefined
        }
      }
    });
    assert.deepEqual(legacyReport.reviewTargetBudget, {
      maxTargets: 1,
      totalTargets: 3,
      includedTargets: 1,
      omittedTargets: 2
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('infra graph impact report contract validates read-only handoff shape', () => {
  const validReport = {
    kind: 'infra-agent.infra-graph-impact-report',
    schemaVersion: 1,
    sourceKind: 'infra-agent.infra-graph',
    sourceSchemaVersion: 1,
    workspaceRoot: 'fixtures/sample-workspace',
    riskLevel: 'medium',
    primaryConcern: 'possible-renames',
    recommendedAction: 'review-possible-renames',
    mutationAllowed: false,
    counts: {
      plannedChanges: 1,
      dependencyEdges: 0,
      possibleRenames: 1,
      replacementCascades: 0,
      createBeforeDeleteConflicts: 0
    },
    sourceProvenance: {
      sources: [
        {
          source: 'terraform-plan',
          nodeCount: 0,
          edgeCount: 1,
          totalCount: 1
        }
      ],
      hasWorkspaceInspection: false,
      hasTerraformPlan: true,
      hasPulumiPreview: false
    },
    reviewTargetCount: 1,
    omittedReviewTargetCount: 0,
    reviewTargetBudget: {
      maxTargets: 5,
      totalTargets: 1,
      includedTargets: 1,
      omittedTargets: 0
    },
    summary: ['Risk: medium.'],
    reviewTargets: [
      {
        edgeId: 'possible-rename:old->new',
        kind: 'possible-rename',
        priority: 1,
        from: 'terraform-resource:old',
        to: 'terraform-resource:new',
        confidence: 'medium',
        source: 'terraform-plan',
        mutationAllowed: false,
        recommendedAction: 'review-possible-renames',
        riskCategory: 'possible-rename-review',
        reviewSteps: []
      }
    ]
  };

  assert.equal(parseInfraGraphImpactReport(validReport).kind, 'infra-agent.infra-graph-impact-report');
  assert.throws(
    () => parseInfraGraphImpactReport({ ...validReport, kind: 'infra-agent.infra-graph' }),
    /infra-agent\.infra-graph-impact-report/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({ ...validReport, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({ ...validReport, mutationAllowed: true }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      riskLevel: 'critical'
    }),
    /root\.riskLevel.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      primaryConcern: 'ownership'
    }),
    /root\.primaryConcern.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      recommendedAction: 'apply'
    }),
    /root\.recommendedAction.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      counts: {
        ...validReport.counts,
        plannedChanges: '1'
      }
    }),
    /counts\.plannedChanges/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      counts: {
        ...validReport.counts,
        possibleRenames: -1
      }
    }),
    /counts\.possibleRenames.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      sourceProvenance: {
        ...validReport.sourceProvenance,
        hasTerraformPlan: 'yes'
      }
    }),
    /sourceProvenance\.hasTerraformPlan/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      sourceProvenance: {
        ...validReport.sourceProvenance,
        sources: [
          {
            ...validReport.sourceProvenance.sources[0],
            source: 'terraform-state'
          }
        ]
      }
    }),
    /sourceProvenance\.sources\[0\]\.source.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      sourceProvenance: {
        ...validReport.sourceProvenance,
        sources: [
          validReport.sourceProvenance.sources[0],
          validReport.sourceProvenance.sources[0]
        ]
      }
    }),
    /sourceProvenance\.sources\[1\]\.source.*unique/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      sourceProvenance: {
        ...validReport.sourceProvenance,
        sources: [
          {
            ...validReport.sourceProvenance.sources[0],
            totalCount: 2
          }
        ]
      }
    }),
    /sourceProvenance\.sources\[0\]\.totalCount.*nodeCount \+ edgeCount/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      sourceProvenance: {
        ...validReport.sourceProvenance,
        hasTerraformPlan: false
      }
    }),
    /sourceProvenance\.hasTerraformPlan.*listed sources/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargetBudget: undefined
    }),
    /reviewTargetBudget.*object/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargetBudget: {
        ...validReport.reviewTargetBudget,
        maxTargets: -1
      }
    }),
    /reviewTargetBudget\.maxTargets.*non-negative integer/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargetBudget: {
        ...validReport.reviewTargetBudget,
        omittedTargets: 1
      }
    }),
    /includedTargets \+ omittedTargets.*totalTargets/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargetCount: 2
    }),
    /includedTargets.*reviewTargetCount/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      omittedReviewTargetCount: 1
    }),
    /omittedTargets.*omittedReviewTargetCount/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: []
    }),
    /includedTargets.*reviewTargets\.length/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargetBudget: {
        ...validReport.reviewTargetBudget,
        includedTargets: 6,
        totalTargets: 6
      },
      reviewTargetCount: 6,
      reviewTargets: [
        validReport.reviewTargets[0],
        {
          ...validReport.reviewTargets[0],
          priority: 2
        },
        {
          ...validReport.reviewTargets[0],
          priority: 3
        },
        {
          ...validReport.reviewTargets[0],
          priority: 4
        },
        {
          ...validReport.reviewTargets[0],
          priority: 5
        },
        {
          ...validReport.reviewTargets[0],
          priority: 6
        }
      ]
    }),
    /includedTargets.*maxTargets/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          mutationAllowed: true
        }
      ]
    }),
    /reviewTargets\[0\]\.mutationAllowed/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          edgeId: 7
        }
      ]
    }),
    /reviewTargets\[0\]\.edgeId.*string/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          kind: 'planned-change'
        }
      ]
    }),
    /reviewTargets\[0\]\.kind.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          source: 'manual'
        }
      ]
    }),
    /reviewTargets\[0\]\.source.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          confidence: 'certain'
        }
      ]
    }),
    /reviewTargets\[0\]\.confidence.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          priority: 2
        }
      ]
    }),
    /reviewTargets\[0\]\.priority.*contiguous/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          recommendedAction: 'review-anything'
        }
      ]
    }),
    /reviewTargets\[0\]\.recommendedAction.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          riskCategory: 'unknown-risk'
        }
      ]
    }),
    /reviewTargets\[0\]\.riskCategory.*supported/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          reviewSteps: ['Inspect source identity.', 7]
        }
      ]
    }),
    /reviewTargets\[0\]\.reviewSteps\[1\].*string/
  );
  assert.throws(
    () => parseInfraGraphImpactReport({
      ...validReport,
      reviewTargets: [
        {
          ...validReport.reviewTargets[0],
          identity: ['terraform-resource:new']
        }
      ]
    }),
    /reviewTargets\[0\]\.identity.*string when present/
  );
});

test('compact agent result contract validates shallow handoff shape and validation.commands metadata', () => {
  const validResult = {
    kind: 'infra-agent.agent-result',
    schemaVersion: 1,
    task: 'review terraform listener priority',
    workspaceRoot: '/workspace',
    outcome: 'validation-blocked',
    modelName: 'rule-based',
    turnsUsed: 1,
    profileId: 'generic',
    requestedDomains: ['terraform'],
    requestedEnvironment: null,
    requestedService: null,
    primaryTarget: {
      kind: 'terraform-root',
      name: 'payments-api',
      path: 'terraform/payments-api',
      score: 10
    },
    changedFiles: [],
    resultCard: [],
    nextSteps: [],
    suggestedCommands: [],
    handoffCheckpoint: {
      schemaVersion: 1,
      source: 'agent-result',
      compact: true,
      primaryArtifact: 'agent --json',
      debugArtifact: 'agent --json-full',
      mutationAllowed: false,
      exclusions: {
        rawRuntimeIncluded: false,
        rawPreflightIncluded: false,
        rawToolOutputIncluded: false,
        rawPromptIncluded: false,
        rawKnowledgeExcerptIncluded: false
      },
      summary: {
        outcome: 'validation-blocked',
        activeBlocker: 'validation',
        nextControlAction: 'resolve-validation',
        readinessStatus: 'pass',
        validationStatus: 'failed',
        validationIssueCount: 1,
        identityConflictCount: 1,
        approvalContinuationRequired: false,
        changedFileCount: 0
      },
      budgets: buildCompactHandoffBudgetsFixture({
        turnTrace: { includedCount: 1, omittedCount: 0 },
        lifecycleEvents: { includedCount: 3, omittedCount: 0 },
        toolTrace: { includedCount: 1, omittedCount: 0 },
        workPlan: { includedCount: 6, omittedCount: 0 },
        validationCommands: { includedCount: 1, omittedCount: 0 },
        knowledgePackets: {
          includedCount: 1,
          omittedCount: 1,
          includedTokenEstimate: 40,
          omittedTokenEstimate: 80
        }
      }),
      continuation: {
        required: true,
        reason: 'validation',
        nextControlAction: 'resolve-validation',
        approvalRequired: false,
        command: null,
        compactCommand: null,
        debugCommand: null,
        mutationAllowed: false
      },
      durableSections: [
        'root',
        'harness',
        'validation',
        'approval',
        'knowledge',
        'readiness',
        'result-card'
      ]
    },
    validation: {
      status: 'failed',
      targetCommandCount: 1,
      yamlGuardCount: 0,
      commands: {
        maxEntries: 8,
        omittedCount: 0,
        entries: [
          {
            command: 'terraform plan',
            exitCode: 1,
            status: 'failed',
            kind: 'target-validation',
            stdoutPreview: '',
            stderrPreview: 'Listener rule priority is already in use.',
            unsafeBlocked: false,
            unsafeRuleId: null,
            unsafeReason: null
          }
        ]
      },
      issueSummary: {
        totalCount: 1,
        omittedIssueCount: 0,
        repairableCount: 0,
        nonRepairableCount: 1,
        maxGroups: 8,
        omittedGroupCount: 0,
        groups: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            count: 1,
            sourceCommandCount: 1,
            blocking: true
          }
        ],
        flags: {
          hasRepairableIssues: false,
          hasNonRepairableIssues: true,
          hasUnsafeValidationCommand: false,
          hasYamlSyntaxFailure: false,
          hasIdentityConflict: true
        }
      },
      issueDetails: {
        maxEntries: 5,
        omittedCount: 0
      },
      issues: [
        {
          kind: 'terraform-create-before-delete-conflict',
          repairable: false,
          message: 'Listener rule priority is already in use.',
          guidance: 'Review Terraform listener rule ownership before changing the priority.',
          metadata: {
            listenerRulePriorities: '100'
          }
        }
      ],
      safetyBlockers: {
        maxEntries: 5,
        omittedCount: 0,
        entries: []
      },
      identityConflictSummary: {
        totalCount: 1,
        includedCount: 1,
        maxEntries: 5,
        omittedCount: 0,
        mutationAllowed: false,
        byEngine: {
          terraform: 1,
          pulumi: 0
        },
        byRiskCategory: {
          'create-before-delete-ordering': 1,
          'dns-or-domain-ownership': 0,
          'exclusive-identity-review': 0,
          'kubernetes-object-ownership': 0,
          'physical-name-ownership': 0
        }
      },
      identityConflicts: [
        {
          engine: 'terraform',
          issueKind: 'terraform-create-before-delete-conflict',
          riskCategory: 'create-before-delete-ordering',
          identity: {
            listenerRulePriorities: '100'
          },
          sourceCommand: 'terraform plan',
          reviewSteps: []
        }
      ],
      selectedPlan: [
        {
          kind: 'terraform',
          target: 'terraform/payments-api',
          commandCount: 1,
          commands: ['terraform plan'],
          executedCommandCount: 1,
          failedCommandCount: 1,
          validatorAvailable: true
        }
      ]
    },
    harness: {
      maxTurns: 6,
      queryConfig: {
        maxTurns: 6,
        maxRepairAttempts: 2,
        retrievedContextBudget: {
          maxPackets: 4,
          maxTokens: 1200,
          maxExcerptChars: 3000,
          maxFacts: 8
        }
      },
      loopBudget: {
        turnsUsed: 1,
        maxTurns: 6,
        turnsRemaining: 5,
        exhausted: false
      },
      repairBudget: {
        attemptsUsed: 0,
        maxAttempts: 2,
        attemptsRemaining: 2,
        exhausted: false
      },
      turnTraceBudget: {
        maxEntries: 5,
        totalCount: 1,
        includedCount: 1,
        omittedCount: 0,
        firstIncludedTurnIndex: 0,
        lastIncludedTurnIndex: 0,
        preservedWindow: 'head'
      },
      turnTraceLimit: 5,
      turnTraceOmittedCount: 0,
      turnTrace: [
        {
          index: 0,
          actionKind: 'stop',
          actionFamily: 'validation-blocked',
          confidence: 'high',
          summary: 'Validation blocked by an exclusive identity conflict.',
          terminal: true,
          executionStatus: null,
          executionReason: null,
          executedToolCount: 0,
          stopReason: 'validation-blocked',
          clarificationKind: null,
          changedFileCount: 0,
          validationIssueCount: 1,
          approvalSignalCount: 0
        }
      ],
      stateSummary: {
        observationCount: 0,
        toolSummaryCount: 1,
        appliedWriteCount: 0,
        validationResultCount: 1,
        validationIssueCount: 1,
        approvalSignalCount: 0,
        retrievedContextCount: 2,
        semanticFactCount: 0
      },
      targeting: {
        schemaVersion: 1,
        source: 'derived-run-preflight',
        compact: true,
        mutationAllowed: false,
        selectedTarget: {
          rank: 1,
          kind: 'terraform-root',
          domain: 'terraform',
          name: 'payments-api',
          path: 'terraform/payments-api',
          score: 10
        },
        candidateCount: 1,
        topScore: 10,
        scoreGapToNext: null,
        maxCandidates: 5,
        includedCount: 1,
        omittedCount: 0,
        ambiguityKinds: ['missing-environment', 'missing-service'],
        recommendedAction: 'review-targeting',
        flags: {
          missingEnvironment: true,
          missingService: true,
          noCandidates: false,
          weakTopScore: false,
          tiedTopScore: false
        },
        candidates: [
          {
            rank: 1,
            selected: true,
            kind: 'terraform-root',
            domain: 'terraform',
            name: 'payments-api',
            path: 'terraform/payments-api',
            score: 10,
            reasonCount: 2,
            reasons: [
              'path matched service token "payments-api"',
              'task vocabulary prefers Terraform root targets'
            ],
            matchedEnvironmentHints: [],
            detailCount: 1,
            details: ['tfvars: dev.auto.tfvars']
          }
        ]
      },
      toolTrace: {
        maxEntries: 5,
        totalCount: 1,
        includedCount: 1,
        omittedCount: 0,
        firstIncludedTurnIndex: 0,
        lastIncludedTurnIndex: 0,
        preservedWindow: 'tail',
        latestTurnIndex: 0,
        permissionCategoryCounts: {
          'workspace-read': 1
        },
        entries: [
          {
            turnIndex: 0,
            actionKind: 'inspect-target-files',
            toolName: 'read_file',
            safety: 'read_only',
            permissionCategory: 'workspace-read',
            mutatesWorkspace: false,
            mutatesExternalState: false,
            externalCommand: false,
            approvalRequired: false,
            summary: 'Read selected Terraform files.'
          }
        ]
      },
      toolPermissionSummary: {
        totalToolCount: 1,
        workspaceMutationToolCount: 0,
        externalCommandToolCount: 0,
        externalStateMutationToolCount: 0,
        approvalRequiredToolCount: 0,
        categories: {
          'workspace-read': 1
        }
      },
      lifecycleEvents: {
        maxEntries: 12,
        totalCount: 3,
        includedCount: 3,
        omittedCount: 0,
        eventCounts: {
          'query-started': 1,
          decision: 1,
          'tool-execution': 0,
          'approval-gate': 0,
          terminal: 1
        },
        events: [
          {
            event: 'query-started',
            turnIndex: null,
            actionKind: null,
            actionFamily: null,
            executionStatus: null,
            reason: null,
            toolCount: 0,
            approvalSignalCount: 0,
            validationIssueCount: 1,
            outcome: null
          },
          {
            event: 'decision',
            turnIndex: 0,
            actionKind: 'stop',
            actionFamily: 'validation-blocked',
            executionStatus: null,
            reason: null,
            toolCount: 0,
            approvalSignalCount: 0,
            validationIssueCount: 1,
            outcome: null
          },
          {
            event: 'terminal',
            turnIndex: 0,
            actionKind: 'stop',
            actionFamily: 'validation-blocked',
            executionStatus: null,
            reason: 'outcome:validation-blocked',
            toolCount: 0,
            approvalSignalCount: 0,
            validationIssueCount: 1,
            outcome: 'validation-blocked'
          }
        ]
      },
      plannerHandoff: {
        lastAction: {
          kind: 'stop',
          family: 'validation-blocked',
          stopReason: 'validation-blocked',
          clarificationKind: null,
          executionStatus: null
        },
        activeBlocker: {
          kind: 'validation',
          validationIssueKind: 'terraform-create-before-delete-conflict',
          approvalSignalKind: null
        },
        nextControlAction: 'resolve-validation'
      },
      workPlan: {
        schemaVersion: 1,
        source: 'derived-agent-run-state',
        compact: true,
        mutationAllowed: false,
        status: 'blocked',
        blockerKind: 'validation',
        nextControlAction: 'resolve-validation',
        currentStepIndex: 4,
        totalStepCount: 6,
        completedStepCount: 3,
        pendingStepCount: 1,
        blockedStepCount: 2,
        skippedStepCount: 0,
        maxEntries: 6,
        includedCount: 6,
        omittedCount: 0,
        steps: [
          {
            index: 0,
            kind: 'readiness',
            status: 'completed',
            title: 'Readiness',
            summary: 'Readiness pass.',
            actionKind: null,
            validationIssueKind: null,
            approvalSignalKind: null
          },
          {
            index: 1,
            kind: 'targeting',
            status: 'completed',
            title: 'Targeting',
            summary: 'Terraform root selected.',
            actionKind: null,
            validationIssueKind: null,
            approvalSignalKind: null
          },
          {
            index: 2,
            kind: 'inspection',
            status: 'completed',
            title: 'Inspection',
            summary: 'Read selected Terraform files.',
            actionKind: 'inspect-target-files',
            validationIssueKind: null,
            approvalSignalKind: null
          },
          {
            index: 3,
            kind: 'edit',
            status: 'pending',
            title: 'Bounded edit',
            summary: 'No bounded write has been applied yet.',
            actionKind: null,
            validationIssueKind: null,
            approvalSignalKind: null
          },
          {
            index: 4,
            kind: 'validation',
            status: 'blocked',
            title: 'Validation',
            summary: 'Validation failed.',
            actionKind: 'validate-targets',
            validationIssueKind: 'terraform-create-before-delete-conflict',
            approvalSignalKind: null
          },
          {
            index: 5,
            kind: 'handoff',
            status: 'blocked',
            title: 'Handoff',
            summary: 'Next control action: resolve-validation.',
            actionKind: 'stop',
            validationIssueKind: null,
            approvalSignalKind: null
          }
        ]
      }
    },
    readiness: {
      status: 'pass',
      passCount: 1,
      warnCount: 0,
      failCount: 0,
      doctorCommand: 'infra-agent doctor /workspace --json',
      checks: [
        {
          name: 'planner',
          status: 'pass',
          message: 'Rule-based planner is selected for this run.',
          detail: 'rule-based'
        }
      ]
    },
    approval: {
      requiredWriteRisks: [],
      requiredToolCategories: [],
      grants: buildEmptyApprovalGrantsFixture(),
      signals: [],
      resume: {
        continuationRequired: false,
        command: null,
        compactCommand: null,
        debugCommand: null,
        primarySignal: null,
        additionalCommands: [],
        additionalSignalCount: 0,
        additionalWriteRisks: [],
        additionalWritePaths: [],
        additionalToolCategories: [],
        writeRisks: [],
        writePaths: [],
        toolCategories: [],
        signalCount: 0
      }
    },
    knowledgeCache: {
      root: '/workspace/.infra-agent/knowledge-cache',
      source: 'workspace-config: knowledgeCache.root'
    },
    knowledgeContext: {
      maxPackets: 2,
      maxTokens: 50,
      maxExcerptChars: 300,
      totalPacketCount: 2,
      includedPacketCount: 1,
      omittedPacketCount: 1,
      includedTokenEstimate: 40,
      omittedTokenEstimate: 80,
      omittedByPacketLimit: 0,
      omittedByTokenBudget: 1,
      packets: [
        {
          id: 'terraform-registry/aws-lb-listener-rule',
          sourceKind: 'terraform-registry',
          sourceName: 'aws_lb_listener_rule',
          sourceVersion: '5.0.0',
          confidence: 'high',
          reason: 'Provider docs selected for the target.',
          tokenEstimate: 40,
          excerptChars: 120,
          included: true,
          omittedReason: null
        },
        {
          id: 'terraform-registry/aws-lb-listener',
          sourceKind: 'terraform-registry',
          sourceName: 'aws_lb_listener',
          sourceVersion: '5.0.0',
          confidence: 'medium',
          reason: 'Token budget omitted this packet.',
          tokenEstimate: 80,
          excerptChars: 200,
          included: false,
          omittedReason: 'token-budget'
        }
      ]
    }
  };
  const validSafetyBlocker = {
    kind: 'yaml-syntax-failure',
    sourceCommand: 'yaml guard terraform/payments-api/dev.auto.tfvars',
    message: 'YAML syntax validation failed.',
    guidance: null,
    repairable: false,
    mutationPrevented: true,
    unsafeCommand: null,
    unsafeRuleId: null,
    unsafeReason: null,
    yamlPath: 'terraform/payments-api/dev.auto.tfvars',
    yamlParser: 'yaml'
  };
  const validUnsafeSafetyBlocker = {
    kind: 'unsafe-validation-command',
    sourceCommand: 'terraform apply',
    message: 'Unsafe validation command blocked.',
    guidance: 'Remove deploy or apply commands from validation configuration.',
    repairable: false,
    mutationPrevented: true,
    unsafeCommand: 'terraform apply',
    unsafeRuleId: 'terraform-apply',
    unsafeReason: 'Terraform apply mutates infrastructure state.',
    yamlPath: null,
    yamlParser: null
  };
  const resultWithSafetyBlockers = entries => ({
    ...validResult,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: buildCompactHandoffBudgetsFixture({
        turnTrace: { includedCount: 1, omittedCount: 0 },
        lifecycleEvents: { includedCount: 3, omittedCount: 0 },
        toolTrace: { includedCount: 1, omittedCount: 0 },
        validationCommands: { includedCount: 1, omittedCount: 0 },
        validationSafetyBlockers: { includedCount: entries.length, omittedCount: 0 },
        knowledgePackets: {
          includedCount: 1,
          omittedCount: 1,
          includedTokenEstimate: 40,
          omittedTokenEstimate: 80
        }
      })
    },
    validation: {
      ...validResult.validation,
      safetyBlockers: {
        ...validResult.validation.safetyBlockers,
        entries
      }
    }
  });

  const resultWithToolEntries = entries => ({
    ...validResult,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        toolTrace: {
          includedCount: entries.length,
          omittedCount: 0
        }
      }
    },
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        toolSummaryCount: entries.length
      },
      toolTrace: {
        ...validResult.harness.toolTrace,
        totalCount: entries.length,
        includedCount: entries.length,
        omittedCount: 0,
        firstIncludedTurnIndex: entries[0]?.turnIndex ?? null,
        lastIncludedTurnIndex: entries.at(-1)?.turnIndex ?? null,
        latestTurnIndex: entries.at(-1)?.turnIndex ?? null,
        permissionCategoryCounts: {
          'workspace-read': entries.length
        },
        entries
      },
      toolPermissionSummary: {
        ...validResult.harness.toolPermissionSummary,
        totalToolCount: entries.length,
        categories: {
          'workspace-read': entries.length
        }
      }
    }
  });
  const twoToolEntries = [
    validResult.harness.toolTrace.entries[0],
    {
      ...validResult.harness.toolTrace.entries[0],
      turnIndex: 1,
      summary: 'Read another selected Terraform file.'
    }
  ];

  assert.equal(parseCompactAgentRunResult(validResult).kind, 'infra-agent.agent-result');
  assert.equal(parseCompactAgentRunResult(resultWithToolEntries(twoToolEntries)).kind, 'infra-agent.agent-result');
  assert.equal(
    parseCompactAgentRunResult(resultWithSafetyBlockers([validSafetyBlocker, validUnsafeSafetyBlocker])).kind,
    'infra-agent.agent-result'
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: null
      }
    }),
    /harness\.targeting/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          source: 'raw-preflight'
        }
      }
    }),
    /harness\.targeting\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          includedCount: 0
        }
      }
    }),
    /harness\.targeting\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          ambiguityKinds: ['missing-service', 'manual-review']
        }
      }
    }),
    /harness\.targeting\.ambiguityKinds/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          candidates: [
            {
              ...validResult.harness.targeting.candidates[0],
              kind: 'ansible-playbook'
            }
          ]
        }
      }
    }),
    /harness\.targeting\.candidates\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          targeting: {
            includedCount: 0,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.targeting must match harness\.targeting/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      primaryTarget: {
        ...validResult.primaryTarget,
        path: 'terraform/other'
      }
    }),
    /harness\.targeting\.selectedTarget\.path.*root\.primaryTarget\.path/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          selectedTarget: {
            ...validResult.harness.targeting.selectedTarget,
            domain: 'helm'
          }
        }
      }
    }),
    /harness\.targeting\.selectedTarget\.domain must match kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          scoreGapToNext: 1
        }
      }
    }),
    /harness\.targeting\.scoreGapToNext/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          flags: {
            ...validResult.harness.targeting.flags,
            missingService: false
          }
        }
      }
    }),
    /harness\.targeting\.ambiguityKinds must match flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          recommendedAction: 'inspect-selected-target'
        }
      }
    }),
    /harness\.targeting\.recommendedAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: null
      }
    }),
    /harness\.workPlan/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          source: 'todo-store'
        }
      }
    }),
    /harness\.workPlan\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          includedCount: 5
        }
      }
    }),
    /harness\.workPlan\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            validResult.harness.workPlan.steps[0],
            {
              ...validResult.harness.workPlan.steps[1],
              index: 0
            },
            ...validResult.harness.workPlan.steps.slice(2)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps indexes/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            {
              ...validResult.harness.workPlan.steps[0],
              kind: 'deploy'
            },
            ...validResult.harness.workPlan.steps.slice(1)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          blockerKind: 'approval'
        }
      }
    }),
    /harness\.workPlan\.blockerKind.*plannerHandoff/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          status: 'completed'
        }
      }
    }),
    /harness\.workPlan\.status must be blocked/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          blockedStepCount: 1
        }
      }
    }),
    /harness\.workPlan\.blockedStepCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          skippedStepCount: 1
        }
      }
    }),
    /harness\.workPlan\.skippedStepCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          currentStepIndex: 1
        }
      }
    }),
    /harness\.workPlan\.currentStepIndex.*blocked or in-progress/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            ...validResult.harness.workPlan.steps.slice(0, 3),
            {
              ...validResult.harness.workPlan.steps[3],
              validationIssueKind: 'terraform-create-before-delete-conflict'
            },
            ...validResult.harness.workPlan.steps.slice(4)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps\[3\]\.validationIssueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            ...validResult.harness.workPlan.steps.slice(0, 4),
            {
              ...validResult.harness.workPlan.steps[4],
              approvalSignalKind: 'write-approval-required'
            },
            validResult.harness.workPlan.steps[5]
          ].flat()
        }
      }
    }),
    /harness\.workPlan\.steps\[4\]\.approvalSignalKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          workPlan: {
            includedCount: 5,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.workPlan must match harness\.workPlan/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              command: 'terraform validate'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.command.*validation\.selectedPlan/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          validResult.validation.selectedPlan[0],
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 0,
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan command "terraform plan".*validation\.selectedPlan\[0\].*validation\.selectedPlan\[1\]/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 0,
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.executedCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.failedCommandCount/
  );
  assert.equal(parseCompactAgentRunResult({
    ...validResult,
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        validationResultCount: 2
      }
    },
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        validationCommands: {
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    validation: {
      ...validResult.validation,
      yamlGuardCount: 1,
      commands: {
        ...validResult.validation.commands,
        entries: [
          ...validResult.validation.commands.entries,
          {
            command: 'yaml guard terraform/payments-api/dev.auto.tfvars',
            exitCode: 0,
            status: 'passed',
            kind: 'yaml-guard',
            stdoutPreview: '',
            stderrPreview: '',
            unsafeBlocked: false,
            unsafeRuleId: null,
            unsafeReason: null
          }
        ]
      }
    }
  }).validation.yamlGuardCount, 1);
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, kind: 'infra-agent.infra-graph' }),
    /compact infra-agent\.agent-result/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => {
      const { handoffCheckpoint, ...missingCheckpoint } = validResult;
      void handoffCheckpoint;
      parseCompactAgentRunResult(missingCheckpoint);
    },
    /handoffCheckpoint object/
  );
  assert.throws(
    () => {
      const { approval, ...missingApproval } = validResult;
      void approval;
      parseCompactAgentRunResult(missingApproval);
    },
    /approval object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        compact: false
      }
    }),
    /handoffCheckpoint\.compact/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        mutationAllowed: true
      }
    }),
    /handoffCheckpoint\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        exclusions: {
          ...validResult.handoffCheckpoint.exclusions,
          rawRuntimeIncluded: true
        }
      }
    }),
    /handoffCheckpoint\.exclusions\.rawRuntimeIncluded/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          activeBlocker: 'runtime'
        }
      }
    }),
    /handoffCheckpoint\.summary\.activeBlocker/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationIssueCount: -1
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationIssueCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          outcome: 'completed'
        }
      }
    }),
    /handoffCheckpoint\.summary\.outcome must match root\.outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          changedFileCount: 1
        }
      }
    }),
    /handoffCheckpoint\.summary\.changedFileCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          activeBlocker: 'approval'
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          reason: 'approval'
        }
      }
    }),
    /handoffCheckpoint\.summary\.activeBlocker must match harness\.plannerHandoff\.activeBlocker\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          nextControlAction: 'review-result'
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          nextControlAction: 'review-result'
        }
      }
    }),
    /handoffCheckpoint\.summary\.nextControlAction must match harness\.plannerHandoff\.nextControlAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          readinessStatus: 'warn'
        }
      }
    }),
    /handoffCheckpoint\.summary\.readinessStatus must match readiness\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationStatus: 'passed'
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationStatus must match validation\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationIssueCount: 0
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationIssueCount must match validation\.issueSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          identityConflictCount: 0
        }
      }
    }),
    /handoffCheckpoint\.summary\.identityConflictCount must match validation\.identityConflictSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          approvalContinuationRequired: true
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          approvalRequired: true,
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --json-full'
        }
      }
    }),
    /handoffCheckpoint\.summary\.approvalContinuationRequired must match approval\.resume\.continuationRequired/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          validationCommands: {
            ...validResult.handoffCheckpoint.budgets.validationCommands,
            omittedCount: -1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.validationCommands\.omittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgePackets: {
            ...validResult.handoffCheckpoint.budgets.knowledgePackets,
            includedTokenEstimate: -1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgePackets\.includedTokenEstimate/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          turnTrace: {
            ...validResult.handoffCheckpoint.budgets.turnTrace,
            includedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.turnTrace must match harness\.turnTraceBudget/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          validationIssueGroups: {
            ...validResult.handoffCheckpoint.budgets.validationIssueGroups,
            omittedCount: 1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.validationIssueGroups must match validation\.issueSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgePackets: {
            ...validResult.handoffCheckpoint.budgets.knowledgePackets,
            omittedTokenEstimate: 79
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgePackets token estimates must match knowledgeContext/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          reason: 'approval'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.reason must match handoffCheckpoint\.summary\.activeBlocker/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          required: false
        }
      }
    }),
    /handoffCheckpoint\.continuation\.required must match reason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          command: 'node --experimental-strip-types src/cli/main.ts agent "retry"'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.command must be null when approvalRequired is false/
  );
  assert.throws(
    () => {
      const { compactCommand, ...continuationWithoutCompactCommand } = validResult.handoffCheckpoint.continuation;
      void compactCommand;
      return parseCompactAgentRunResult({
        ...validResult,
        handoffCheckpoint: {
          ...validResult.handoffCheckpoint,
          continuation: continuationWithoutCompactCommand
        }
      });
    },
    /handoffCheckpoint\.continuation\.compactCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "retry" --json'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.compactCommand must be null when approvalRequired is false/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: []
      }
    }),
    /handoffCheckpoint\.durableSections/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: ['runtime']
      }
    }),
    /handoffCheckpoint\.durableSections/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: validResult.handoffCheckpoint.durableSections.filter(section => section !== 'approval')
      }
    }),
    /handoffCheckpoint\.durableSections must include all required recovery section names/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: [
          ...validResult.handoffCheckpoint.durableSections,
          'root'
        ]
      }
    }),
    /handoffCheckpoint\.durableSections must not include duplicate section names/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, outcome: 'unexpected' }),
    /supported outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, task: 1 }),
    /root\.task/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, workspaceRoot: null }),
    /root\.workspaceRoot/
  );
  for (const field of [
    'modelName',
    'profileId',
    'turnsUsed',
    'requestedDomains',
    'changedFiles',
    'resultCard',
    'nextSteps',
    'suggestedCommands'
  ]) {
    const missingRootField = { ...validResult };
    delete missingRootField[field];
    assert.throws(
      () => parseCompactAgentRunResult(missingRootField),
      new RegExp(`root\\.${field}`)
    );
  }
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, turnsUsed: '1' }),
    /root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, turnsUsed: -1 }),
    /root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, requestedDomains: ['ansible'] }),
    /root\.requestedDomains/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, changedFiles: ['a.tf', 1] }),
    /root\.changedFiles/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      requestedEnvironment: 1
    }),
    /root\.requestedEnvironment/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      primaryTarget: {
        ...validResult.primaryTarget,
        score: 'high'
      }
    }),
    /root\.primaryTarget\.score/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        maxTurns: '6'
      }
    }),
    /harness\.maxTurns/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      turnsUsed: 2
    }),
    /root\.turnsUsed must match harness\.loopBudget\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        queryConfig: {
          ...validResult.harness.queryConfig,
          maxRepairAttempts: '2'
        }
      }
    }),
    /harness\.queryConfig\.maxRepairAttempts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        queryConfig: {
          ...validResult.harness.queryConfig,
          retrievedContextBudget: {
            ...validResult.harness.queryConfig.retrievedContextBudget,
            maxTokens: 0
          }
        }
      }
    }),
    /harness\.queryConfig\.retrievedContextBudget\.maxTokens/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        loopBudget: {
          ...validResult.harness.loopBudget,
          turnsRemaining: 4
        }
      }
    }),
    /harness\.loopBudget\.turnsRemaining/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        loopBudget: {
          ...validResult.harness.loopBudget,
          exhausted: true
        }
      }
    }),
    /harness\.loopBudget\.exhausted/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          maxAttempts: 3
        }
      }
    }),
    /harness\.repairBudget\.maxAttempts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          attemptsRemaining: 1
        }
      }
    }),
    /harness\.repairBudget\.attemptsRemaining/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          exhausted: true
        }
      }
    }),
    /harness\.repairBudget\.exhausted/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, validation: {} }),
    /validation\.identityConflicts array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: 'terraform'
      }
    }),
    /validation\.selectedPlan array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            kind: 'ansible'
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            target: ''
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.target/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            commands: ['terraform plan', 1]
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.commands/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            commandCount: 2
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.commandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 2
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.executedCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            failedCommandCount: 2
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.failedCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            validatorAvailable: 'yes'
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.validatorAvailable/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: null
      }
    }),
    /validation\.issueSummary object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          totalCount: '1'
        }
      }
    }),
    /validation\.issueSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          repairableCount: 1
        }
      }
    }),
    /validation\.issueSummary repairable counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          maxGroups: 0
        }
      }
    }),
    /validation\.issueSummary\.groups length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              kind: 'unexpected'
            }
          ]
        }
      }
    }),
    /validation\.issueSummary\.groups\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              count: 0
            }
          ]
        }
      }
    }),
    /validation\.issueSummary\.groups\[0\]\.count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              count: 2
            }
          ]
        }
      }
    }),
    /validation\.issueSummary group counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          flags: {
            ...validResult.validation.issueSummary.flags,
            hasIdentityConflict: false
          }
        }
      }
    }),
    /validation\.issueSummary\.flags\.hasIdentityConflict/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: null
      }
    }),
    /validation\.issueDetails object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          maxEntries: -1
        }
      }
    }),
    /validation\.issueDetails\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          omittedCount: 1
        }
      }
    }),
    /validation\.issueDetails\.omittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: {}
      }
    }),
    /validation\.issues array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          maxEntries: 0
        }
      }
    }),
    /validation\.issues length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          omittedIssueCount: 1
        },
        issueDetails: {
          ...validResult.validation.issueDetails,
          omittedCount: 1
        }
      }
    }),
    /validation\.issues length plus omitted count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            kind: 'unexpected'
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            repairable: 'no'
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.repairable/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            message: ''
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.message/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            guidance: 1
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.guidance/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            metadata: {
              listenerRulePriorities: 100
            }
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.metadata\.listenerRulePriorities/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            repairable: true
          }
        ]
      }
    }),
    /validation\.issues repairable count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: null
      }
    }),
    /validation\.safetyBlockers object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          maxEntries: -1
        }
      }
    }),
    /validation\.safetyBlockers\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: {}
        }
      }
    }),
    /validation\.safetyBlockers\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          maxEntries: 0,
          entries: [validSafetyBlocker]
        }
      }
    }),
    /validation\.safetyBlockers\.entries length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              kind: 'terraform-create-before-delete-conflict'
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              sourceCommand: ''
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.sourceCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              mutationPrevented: false
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.mutationPrevented/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              unsafeRuleId: 1
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validUnsafeSafetyBlocker,
        unsafeCommand: ''
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeCommand.*unsafe-validation-command/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validUnsafeSafetyBlocker,
        yamlPath: 'terraform/payments-api/dev.auto.tfvars'
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.yamlPath.*unsafe-validation-command/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validSafetyBlocker,
        yamlParser: ''
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.yamlParser.*yaml-syntax-failure/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validSafetyBlocker,
        unsafeReason: 'Terraform apply mutates infrastructure state.'
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeReason.*yaml-syntax-failure/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: null
      }
    }),
    /identityConflictSummary object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: '1'
        }
      }
    }),
    /identityConflictSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          mutationAllowed: true
        }
      }
    }),
    /identityConflictSummary\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: 2,
          includedCount: 1,
          omittedCount: 0
        }
      }
    }),
    /identityConflictSummary counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: 6,
          includedCount: 6,
          omittedCount: 0
        }
      }
    }),
    /identityConflictSummary\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /identityConflictSummary\.includedCount.*identityConflicts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            ansible: 1
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            terraform: 0,
            pulumi: 0
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            terraform: 0,
            pulumi: 1
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine must cover/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': '1'
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': 0,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': 0,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 1
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory must cover/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          entries: {}
        }
      }
    }),
    /harness\.toolTrace\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: undefined
        }
      }
    }),
    /harness\.toolTrace\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: null
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          totalCount: '0',
          entries: []
        }
      }
    }),
    /harness\.toolTrace\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /harness\.toolTrace\.includedCount must match entries length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          preservedWindow: 'head'
        }
      }
    }),
    /harness\.toolTrace\.preservedWindow/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          lastIncludedTurnIndex: 99
        }
      }
    }),
    /harness\.toolTrace\.lastIncludedTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithToolEntries([...twoToolEntries].reverse())),
    /harness\.toolTrace\.entries turnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          latestTurnIndex: 99
        }
      }
    }),
    /harness\.toolTrace\.latestTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: {
            'workspace-write': 1
          }
        },
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-write': 1
          }
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts.*included entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: null
      }
    }),
    /harness\.toolTrace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: [
            {
              ...validResult.harness.toolTrace.entries[0],
              permissionCategory: 'unexpected'
            }
          ]
        }
      }
    }),
    /harness\.toolTrace\.entries\[0\]\.permissionCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: [
            {
              ...validResult.harness.toolTrace.entries[0],
              mutatesWorkspace: 'no'
            }
          ]
        }
      }
    }),
    /harness\.toolTrace\.entries\[0\]\.mutatesWorkspace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: {
            'workspace-read': 2
          }
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: null
      }
    }),
    /harness\.turnTrace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: null
      }
    }),
    /harness\.turnTraceBudget/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          totalCount: '0'
        }
      }
    }),
    /harness\.turnTraceBudget\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          preservedWindow: 'tail'
        }
      }
    }),
    /harness\.turnTraceBudget\.preservedWindow/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          totalCount: 2,
          includedCount: 1,
          omittedCount: 0
        }
      }
    }),
    /harness\.turnTraceBudget counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: [
          {
            ...validResult.harness.turnTrace[0],
            actionKind: 'unexpected'
          }
        ]
      }
    }),
    /harness\.turnTrace\[0\]\.actionKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: [
          {
            ...validResult.harness.turnTrace[0],
            executedToolCount: -1
          }
        ]
      }
    }),
    /harness\.turnTrace\[0\]\.executedToolCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          totalCount: 1,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.includedCount must match turnTrace length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceLimit: 4
      }
    }),
    /harness\.turnTraceLimit/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceOmittedCount: 1
      }
    }),
    /harness\.turnTraceOmittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          firstIncludedTurnIndex: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.firstIncludedTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceLimit: undefined
      }
    }),
    /harness\.turnTraceLimit/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          turnTrace: {
            includedCount: 1,
            omittedCount: 1
          }
        }
      },
      harness: {
        ...validResult.harness,
        turnTraceOmittedCount: 1,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          totalCount: 2,
          omittedCount: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.totalCount must match root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: null
      }
    }),
    /harness\.lifecycleEvents/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: {}
        }
      }
    }),
    /harness\.lifecycleEvents\.events/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          eventCounts: null
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: '0',
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          maxEntries: 12,
          totalCount: 1,
          includedCount: 1,
          omittedCount: 0,
          events: [
            {
              event: 'unexpected'
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents\.events\[0\]\.event/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: 3,
          includedCount: 2,
          omittedCount: 1,
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: 3,
          includedCount: 1,
          omittedCount: 0,
          events: [
            {
              ...validResult.harness.lifecycleEvents.events[1]
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: [
            {
              ...validResult.harness.lifecycleEvents.events[0],
              actionKind: 'unexpected'
            },
            validResult.harness.lifecycleEvents.events[1]
          ]
        }
      }
    }),
    /harness\.lifecycleEvents\.events\[0\]\.actionKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          eventCounts: {
            ...validResult.harness.lifecycleEvents.eventCounts,
            decision: 2
          }
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: [
            validResult.harness.lifecycleEvents.events[0],
            validResult.harness.lifecycleEvents.events[1],
            {
              ...validResult.harness.lifecycleEvents.events[2],
              outcome: 'completed',
              reason: 'outcome:completed'
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents terminal event/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          totalCount: 0,
          includedCount: 0,
          omittedCount: 0,
          eventCounts: {
            unexpected: 1
          },
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: null
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          semanticFactCount: undefined
        }
      }
    }),
    /harness\.stateSummary\.semanticFactCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationIssueCount: '1'
        }
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          semanticFactCount: -1
        }
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          toolSummaryCount: 2
        }
      }
    }),
    /harness\.stateSummary\.toolSummaryCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationResultCount: 2
        }
      }
    }),
    /harness\.stateSummary\.validationResultCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationIssueCount: 2
        }
      }
    }),
    /harness\.stateSummary\.validationIssueCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      }
    }),
    /harness\.stateSummary\.approvalSignalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          retrievedContextCount: 1
        }
      }
    }),
    /harness\.stateSummary\.retrievedContextCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          totalToolCount: '1'
        }
      }
    }),
    /harness\.toolPermissionSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          workspaceMutationToolCount: 2
        }
      }
    }),
    /workspaceMutationToolCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            ansible: 1
          }
        }
      }
    }),
    /toolPermissionSummary\.categories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-read': 2
          }
        }
      }
    }),
    /toolPermissionSummary\.categories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-write': 1
          }
        }
      }
    }),
    /must match harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            kind: 'unexpected'
          }
        }
      }
    }),
    /plannerHandoff\.activeBlocker\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            kind: 'validation'
          },
          nextControlAction: 'unexpected'
        }
      }
    }),
    /plannerHandoff\.nextControlAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          lastAction: {
            ...validResult.harness.plannerHandoff.lastAction,
            kind: 'unexpected'
          }
        }
      }
    }),
    /plannerHandoff\.lastAction\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          lastAction: {
            ...validResult.harness.plannerHandoff.lastAction,
            stopReason: null
          }
        }
      }
    }),
    /plannerHandoff\.lastAction\.stopReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            validationIssueKind: 'new-validation-kind'
          }
        }
      }
    }),
    /plannerHandoff\.activeBlocker\.validationIssueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          nextControlAction: 'review-result'
        }
      }
    }),
    /plannerHandoff\.nextControlAction must match outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        status: 'unknown'
      }
    }),
    /readiness\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        checks: {}
      }
    }),
    /readiness\.checks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        passCount: 0
      }
    }),
    /readiness counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        checks: [
          {
            ...validResult.readiness.checks[0],
            status: 'unknown'
          }
        ]
      }
    }),
    /readiness\.checks\[0\]\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        doctorCommand: null
      }
    }),
    /readiness\.doctorCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          entries: {}
        }
      }
    }),
    /validation\.commands\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        targetCommandCount: '1'
      }
    }),
    /validation\.targetCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          maxEntries: '8'
        }
      }
    }),
    /validation\.commands\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              status: 'passed'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              kind: 'deploy'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              unsafeBlocked: true,
              unsafeRuleId: null,
              unsafeReason: null
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              unsafeBlocked: false,
              unsafeRuleId: 'terraform-apply-destroy',
              unsafeReason: null
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        targetCommandCount: 0
      }
    }),
    /validation\.targetCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        yamlGuardCount: 1
      }
    }),
    /validation\.yamlGuardCount/
  );
  assert.equal(parseCompactAgentRunResult({
    ...validResult,
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        validationResultCount: 2
      }
    },
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        validationCommands: {
          includedCount: 1,
          omittedCount: 1
        }
      }
    },
    validation: {
      ...validResult.validation,
      targetCommandCount: 2,
      commands: {
        ...validResult.validation.commands,
        omittedCount: 1
      }
    }
  }).validation.targetCommandCount, 2);
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: {}
        }
      }
    }),
    /validation\.issueSummary\.groups/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: {}
        }
      }
    }),
    /validation\.safetyBlockers\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        signals: {}
      }
    }),
    /approval\.signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: null
      }
    }),
    /approval\.resume/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: null
      }
    }),
    /approval\.grants/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedWriteRisks: ['urgent']
        }
      }
    }),
    /approval\.grants\.approvedWriteRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedWritePaths: ['charts/payments-api'],
          writePathScope: 'all',
          hasExplicitApproval: true
        }
      }
    }),
    /approval\.grants\.writePathScope.*scoped/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedToolCategories: ['native-stack-config-write'],
          hasExplicitApproval: false
        }
      }
    }),
    /approval\.grants\.hasExplicitApproval/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          primarySignal: {}
        }
      }
    }),
    /approval\.resume\.primarySignal\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          primarySignal: {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'charts/payments-api/values.yaml',
            risk: 'high',
            toolCategory: null
          }
        }
      }
    }),
    /approval\.resume\.primarySignal.*null/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          continuationRequired: 'yes'
        }
      }
    }),
    /approval\.resume\.continuationRequired/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "task" --json'
        }
      }
    }),
    /approval\.resume\.compactCommand.*null/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        requiredWriteRisks: ['urgent']
      }
    }),
    /approval\.requiredWriteRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: '',
            risk: 'medium',
            toolCategory: null
          }
        ]
      }
    }),
    /approval\.signals\[0\]\.path/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'tool-category-approval-required',
            message: 'Approval required.',
            path: null,
            risk: null,
            toolCategory: 'deploy'
          }
        ]
      }
    }),
    /approval\.signals\[0\]\.toolCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          command: 'node --experimental-strip-types src/cli/main.ts agent task --workspace /workspace'
        }
      }
    }),
    /approval\.resume\.command/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          approvalContinuationRequired: true
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          approvalRequired: true,
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json-full'
        }
      },
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          continuationRequired: true,
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json-full'
        }
      }
    }),
    /approval\.resume\.continuationRequired must match root\.outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          signalCount: 0
        }
      }
    }),
    /approval\.resume\.signalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          writeRisks: [],
          writePaths: ['values.yaml'],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.writeRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'tool-category-approval-required',
            message: 'Approval required.',
            path: null,
            risk: null,
            toolCategory: 'native-stack-config-write'
          }
        ],
        resume: {
          ...validResult.approval.resume,
          toolCategories: [],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.toolCategories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          writeRisks: ['medium', 'high'],
          writePaths: ['values.yaml'],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.writeRisks must match included approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            issueKind: 'pulumi-create-before-delete-conflict'
          }
        ]
      }
    }),
    /conflict at index 0.*issueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            riskCategory: 'unexpected'
          }
        ]
      }
    }),
    /conflict at index 0.*riskCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            identity: {
              listenerRulePriorities: 100
            }
          }
        ]
      }
    }),
    /conflict at index 0 identity values/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            sourceCommand: ''
          }
        ]
      }
    }),
    /conflict at index 0.*sourceCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            reviewSteps: ['review', 1]
          }
        ]
      }
    }),
    /conflict at index 0.*reviewSteps/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            mutationAllowed: true
          }
        ]
      }
    }),
    /conflict at index 0.*mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: null
    }),
    /knowledgeContext object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        maxPackets: 0
      }
    }),
    /knowledgeContext\.maxPackets/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3
      }
    }),
    /knowledgeContext packet counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        omittedByTokenBudget: 0
      }
    }),
    /knowledgeContext omitted counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3,
        includedPacketCount: 3,
        omittedPacketCount: 0,
        omittedByTokenBudget: 0
      }
    }),
    /knowledgeContext\.includedPacketCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3,
        omittedPacketCount: 2,
        omittedByPacketLimit: 1
      }
    }),
    /knowledgeContext\.packets length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            confidence: 'certain'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.confidence/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            excerptChars: 301
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.excerptChars/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            omittedReason: 'token-budget'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.omittedReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          validResult.knowledgeContext.packets[0],
          {
            ...validResult.knowledgeContext.packets[1],
            omittedReason: null
          }
        ]
      }
    }),
    /knowledgeContext\.packets\[1\]\.omittedReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            excerpt: 'raw context should not be in the summary'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\].*raw context/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        includedTokenEstimate: 41
      }
    }),
    /knowledgeContext\.includedTokenEstimate/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: null
    }),
    /knowledgeCache object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: {
        ...validResult.knowledgeCache,
        root: ''
      }
    }),
    /knowledgeCache\.root/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: {
        ...validResult.knowledgeCache,
        source: 'unknown'
      }
    }),
    /knowledgeCache\.source/
  );
});

test('identity-report loader renders compact conflict reports from a JSON file', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-identity-report-'));
  const inputPath = join(tempRoot, 'agent-result.json');

  try {
    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'update terraform listener priority',
      workspaceRoot: '/workspace',
      outcome: 'validation-blocked',
      modelName: 'rule-based',
      turnsUsed: 1,
      profileId: 'generic',
      requestedDomains: ['terraform'],
      changedFiles: [],
      resultCard: [],
      nextSteps: [],
      suggestedCommands: [],
      handoffCheckpoint: {
        schemaVersion: 1,
        source: 'agent-result',
        compact: true,
        primaryArtifact: 'agent --json',
        debugArtifact: 'agent --json-full',
        mutationAllowed: false,
        exclusions: {
          rawRuntimeIncluded: false,
          rawPreflightIncluded: false,
          rawToolOutputIncluded: false,
          rawPromptIncluded: false,
          rawKnowledgeExcerptIncluded: false
        },
        summary: {
          outcome: 'validation-blocked',
          activeBlocker: 'validation',
          nextControlAction: 'resolve-validation',
          readinessStatus: 'pass',
          validationStatus: 'failed',
          validationIssueCount: 3,
          identityConflictCount: 3,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture({
          validationIssues: { includedCount: 1, omittedCount: 2 },
          identityConflicts: { includedCount: 1, omittedCount: 2 }
        }),
        continuation: {
          required: true,
          reason: 'validation',
          nextControlAction: 'resolve-validation',
          approvalRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          mutationAllowed: false
        },
        durableSections: [
          'root',
          'harness',
          'validation',
          'approval',
          'knowledge',
          'readiness',
          'result-card'
        ]
      },
      validation: {
        status: 'failed',
        selectedPlan: [],
        issueSummary: {
          totalCount: 3,
          omittedIssueCount: 2,
          repairableCount: 0,
          nonRepairableCount: 3,
          maxGroups: 8,
          omittedGroupCount: 0,
          groups: [
            {
              kind: 'terraform-create-before-delete-conflict',
              repairable: false,
              count: 3,
              sourceCommandCount: 1,
              blocking: true
            }
          ],
          flags: {
            hasRepairableIssues: false,
            hasNonRepairableIssues: true,
            hasUnsafeValidationCommand: false,
            hasYamlSyntaxFailure: false,
            hasIdentityConflict: true
          }
        },
        issueDetails: {
          maxEntries: 5,
          omittedCount: 2
        },
        issues: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            message: 'Terraform listener priority is already in use.',
            guidance: 'Review Terraform listener rule ownership before changing the priority.',
            metadata: {
              listenerRulePriorities: '100'
            }
          }
        ],
        safetyBlockers: {
          maxEntries: 5,
          omittedCount: 0,
          entries: []
        },
        identityConflictSummary: {
          totalCount: 3,
          includedCount: 1,
          maxEntries: 5,
          omittedCount: 2,
          mutationAllowed: false,
          byEngine: {
            terraform: 3,
            pulumi: 0
          },
          byRiskCategory: {
            'create-before-delete-ordering': 3,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        },
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
            riskCategory: 'create-before-delete-ordering',
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
      },
      approval: {
        requiredWriteRisks: [],
        requiredToolCategories: [],
        grants: buildEmptyApprovalGrantsFixture(),
        signals: [],
        resume: {
          continuationRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          primarySignal: null,
          additionalCommands: [],
          additionalSignalCount: 0,
          additionalWriteRisks: [],
          additionalWritePaths: [],
          additionalToolCategories: [],
          writeRisks: [],
          writePaths: [],
          toolCategories: [],
          signalCount: 0
        }
      },
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'workspace-config: knowledgeCache.root'
      },
      knowledgeContext: {
        maxPackets: 5,
        maxTokens: 1000,
        maxExcerptChars: 1200,
        totalPacketCount: 0,
        includedPacketCount: 0,
        omittedPacketCount: 0,
        includedTokenEstimate: 0,
        omittedTokenEstimate: 0,
        omittedByPacketLimit: 0,
        omittedByTokenBudget: 0,
        packets: []
      }
    }), 'utf8');

    const report = await loadIdentityConflictIncidentReport(inputPath);
    assert.equal(report.kind, 'infra-agent.identity-conflict-report');
    assert.equal(report.sourceSchemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.incidentCount, 1);
    assert.equal(report.omittedIncidentCount, 2);
    assert.equal(report.incidentSummary.totalCount, 3);
    assert.equal(report.incidentSummary.includedCount, 1);
    assert.equal(report.incidentSummary.byEngine.terraform, 3);
    assert.equal(report.incidentSummary.byRiskCategory['create-before-delete-ordering'], 3);
    assert.equal(report.incidents[0]?.resourceLocator, 'aws_lb_listener_rule.api');
    assert.equal(report.incidents[0]?.riskCategory, 'create-before-delete-ordering');
    assert.equal(report.incidents[0]?.mutationAllowed, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('identity conflict incident report contract validates read-only report shape', () => {
  const validReport = {
    kind: 'infra-agent.identity-conflict-report',
    schemaVersion: 1,
    sourceKind: 'infra-agent.agent-result',
    sourceSchemaVersion: 1,
    sourceTask: 'update terraform listener priority',
    workspaceRoot: '/workspace',
    outcome: 'validation-blocked',
    mutationAllowed: false,
    incidentCount: 1,
    omittedIncidentCount: 0,
    incidentSummary: {
      totalCount: 1,
      includedCount: 1,
      maxEntries: 5,
      omittedCount: 0,
      mutationAllowed: false,
      byEngine: {
        terraform: 1,
        pulumi: 0
      },
      byRiskCategory: {
        'create-before-delete-ordering': 1,
        'dns-or-domain-ownership': 0,
        'exclusive-identity-review': 0,
        'kubernetes-object-ownership': 0,
        'physical-name-ownership': 0
      }
    },
    summary: [
      'Terraform AWS listener rule at aws_lb_listener_rule.api: listenerRulePriorities=100.'
    ],
    incidents: [
      {
        engine: 'terraform',
        issueKind: 'terraform-create-before-delete-conflict',
        conflictCode: 'PriorityInUse',
        conflictFamily: 'aws-lb-listener-rule',
        conflictLabel: 'AWS Load Balancer Listener Rule',
        resourceLocator: 'aws_lb_listener_rule.api',
        resourceType: 'aws_lb_listener_rule',
        identity: {
          listenerRulePriorities: '100'
        },
        riskCategory: 'create-before-delete-ordering',
        reviewSteps: [
          'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
        ],
        suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
        sourceCommand: 'terraform -chdir=terraform/payments-api plan',
        mutationAllowed: false
      }
    ]
  };

  assert.equal(parseIdentityConflictIncidentReport(validReport).kind, 'infra-agent.identity-conflict-report');
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, kind: 'infra-agent.agent-result' }),
    /identity-conflict-report/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, mutationAllowed: true }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, incidentCount: 2 }),
    /incidents length/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        totalCount: 2
      }
    }),
    /incidentSummary counts/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      omittedIncidentCount: 1
    }),
    /omittedIncidentCount/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        byEngine: {
          terraform: 0,
          pulumi: 0
        }
      }
    }),
    /incidentSummary\.byEngine counts/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        byRiskCategory: {
          'create-before-delete-ordering': '1'
        }
      }
    }),
    /incidentSummary\.byRiskCategory/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          issueKind: 'pulumi-create-before-delete-conflict'
        }
      ]
    }),
    /incident at index 0.*issueKind/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          identity: {
            listenerRulePriorities: 100
          }
        }
      ]
    }),
    /incident at index 0 identity/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          riskCategory: 'unexpected'
        }
      ]
    }),
    /incident at index 0.*riskCategory/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          reviewSteps: ['review', 1]
        }
      ]
    }),
    /incident at index 0.*reviewSteps/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          mutationAllowed: true
        }
      ]
    }),
    /incident at index 0.*mutationAllowed/
  );
});

test('identity-report loader rejects non-compact result inputs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-identity-report-invalid-'));
  const inputPath = join(tempRoot, 'not-agent-result.json');

  try {
    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.infra-graph',
      validation: {
        identityConflicts: []
      }
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /compact infra-agent\.agent-result/
    );

    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'review terraform listener priority',
      workspaceRoot: '/workspace',
      outcome: 'validation-blocked',
      modelName: 'rule-based',
      turnsUsed: 1,
      profileId: 'generic',
      requestedDomains: ['terraform'],
      changedFiles: [],
      resultCard: [],
      nextSteps: [],
      suggestedCommands: [],
      handoffCheckpoint: {
        schemaVersion: 1,
        source: 'agent-result',
        compact: true,
        primaryArtifact: 'agent --json',
        debugArtifact: 'agent --json-full',
        mutationAllowed: false,
        exclusions: {
          rawRuntimeIncluded: false,
          rawPreflightIncluded: false,
          rawToolOutputIncluded: false,
          rawPromptIncluded: false,
          rawKnowledgeExcerptIncluded: false
        },
        summary: {
          outcome: 'validation-blocked',
          activeBlocker: 'validation',
          nextControlAction: 'resolve-validation',
          readinessStatus: 'pass',
          validationStatus: 'failed',
          validationIssueCount: 1,
          identityConflictCount: 1,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture(),
        continuation: {
          required: true,
          reason: 'validation',
          nextControlAction: 'resolve-validation',
          approvalRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          mutationAllowed: false
        },
        durableSections: [
          'root',
          'harness',
          'validation',
          'approval',
          'knowledge',
          'readiness',
          'result-card'
        ]
      },
      validation: {}
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /validation\.identityConflicts array/
    );

    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 2,
      validation: {
        identityConflicts: []
      }
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /schemaVersion 1/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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

test('validation command safety allows read-only validators and blocks mutation commands', () => {
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api fmt -check -recursive'), null);
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api validate'), null);
  assert.equal(classifyUnsafeValidationCommand('helm lint charts/payments-api'), null);
  assert.equal(classifyUnsafeValidationCommand('helm template charts/payments-api'), null);
  assert.equal(
    classifyUnsafeValidationCommand('PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'),
    null
  );
  assert.equal(
    classifyUnsafeValidationCommand(
      'mkdir -p .pulumi-home .pulumi-state && (PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi stack init dev --cwd infra/payments-api --non-interactive >/dev/null 2>&1 || true) && PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'
    ),
    null
  );

  assert.match(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api apply -auto-approve')?.reason ?? '', /not validation/i);
  assert.match(classifyUnsafeValidationCommand('pulumi up --cwd infra/payments-api --stack prod --yes')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('helm upgrade payments-api charts/payments-api')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('kubectl delete deployment payments-api')?.reason ?? '', /cluster state/i);
});

test('validate_targets blocks unsafe validation commands before execution', async () => {
  const result = await executeTool(ValidateTargetsTool, {
    commands: [
      'terraform -chdir=terraform/payments-api apply -auto-approve'
    ]
  }, {
    workspaceRoot: resolve('fixtures/sample-workspace'),
    workspaceConfig: null
  });

  assert.equal(result.output.results.length, 1);
  assert.equal(result.output.results[0]?.exitCode, 1);
  assert.match(result.output.results[0]?.stderr ?? '', /blocked unsafe validation command/i);
  assert.match(result.output.results[0]?.stderr ?? '', /Terraform apply and destroy/i);

  const issues = classifyValidationIssues(result.output.results);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'unsafe-validation-command');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply -auto-approve');
  assert.match(issues[0]?.metadata?.unsafeReason ?? '', /Terraform apply and destroy/i);
  assert.match(issues[0]?.guidance ?? '', /Remove deploy, apply, state mutation/i);
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
  assert.match(prompt, /Allowed optional payload\.actionFamily metadata values:/);
  assert.match(prompt, /payload\.actionFamily is optional metadata only/);
  assert.match(prompt, /repair-budget-exhausted/);
  assert.match(prompt, /validation-succeeded/);
  assert.match(prompt, /runtimeIdentityConflicts/);
  assert.match(prompt, /runtimeIdentityConflictSummary/);
  assert.match(prompt, /review-only incident context/);
});

test('planner user prompt includes runtime identity conflict summaries', async () => {
  const preflight = await buildRunPreflight('review terraform listener rule conflict', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform plan',
        message: 'Listener rule priority already exists.',
        metadata: {
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          conflictSuggestedAction: 'Review listener priority ownership before retrying plan.',
          listenerArns: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:listener/app/api/abc/def',
          listenerRulePriorities: '100',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceType: 'aws_lb_listener_rule'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.runtimeIdentityConflictSummary.totalCount, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.includedCount, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.omittedCount, 0);
  assert.equal(parsed.runtimeIdentityConflictSummary.maxEntries, 5);
  assert.equal(parsed.runtimeIdentityConflictSummary.byEngine.terraform, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.byEngine.pulumi, 0);
  assert.equal(parsed.runtimeIdentityConflictSummary.byRiskCategory['create-before-delete-ordering'], 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.mutationAllowed, false);
  assert.equal(parsed.runtimeIdentityConflicts.length, 1);
  assert.equal(parsed.runtimeIdentityConflicts[0]?.engine, 'terraform');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.match(parsed.runtimeIdentityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.equal(parsed.runtimeIdentityConflicts[0]?.message, undefined);
});

test('LLMModelClient sends compact planner prompt and parses bounded decisions', async () => {
  const preflight = await buildRunPreflight('review terraform listener rule conflict', 'fixtures/terraform-workspace');
  let capturedUrl = '';
  let capturedInit;
  const client = new LLMModelClient(
    {
      apiKey: 'test-api-key',
      baseUrl: 'https://llm.example.test/v1',
      model: 'test-planner-model'
    },
    async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 'high',
                action: {
                  kind: 'stop',
                  summary: 'Blocked by exclusive identity conflict.',
                  rationale: 'The provider reported an exclusive identity conflict that requires review.',
                  payload: {
                    stopReason: 'validation-blocked'
                  }
                }
              })
            }
          }
        ]
      }));
    }
  );

  const decision = await client.decideNextAction({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform plan',
        message: 'Listener rule priority already exists.',
        metadata: {
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          listenerArns: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:listener/app/api/abc/def',
          listenerRulePriorities: '100',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceType: 'aws_lb_listener_rule'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(capturedUrl, 'https://llm.example.test/v1/chat/completions');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(capturedInit?.headers?.authorization, 'Bearer test-api-key');
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.model, 'test-planner-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.match(body.messages[0]?.content ?? '', /Return exactly one JSON object/);
  const userPrompt = JSON.parse(body.messages[1]?.content ?? '{}');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.match(userPrompt.runtimeIdentityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.equal(userPrompt.repairBudget.attemptsUsed, 0);
  assert.equal(userPrompt.repairBudget.maxAttempts, undefined);
  assert.equal(decision.confidence, 'high');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
});

test('LLM planner config resolves explicit env maps without mutating process env', () => {
  assert.equal(resolveLLMClientConfig({}), null);

  const config = resolveLLMClientConfig({
    OPENAI_API_KEY: ' openai-key ',
    OPENAI_BASE_URL: 'https://openai-compatible.example.test/v1/',
    INFRA_AGENT_OPENAI_API_KEY: ' infra-agent-key ',
    INFRA_AGENT_OPENAI_BASE_URL: 'https://infra-agent.example.test/v1/',
    INFRA_AGENT_MODEL: ' test-model '
  });

  assert.equal(config?.apiKey, 'infra-agent-key');
  assert.equal(config?.baseUrl, 'https://infra-agent.example.test/v1');
  assert.equal(config?.model, 'test-model');

  const fallbackConfig = resolveLLMClientConfig({
    OPENAI_API_KEY: 'openai-key'
  });

  assert.equal(fallbackConfig?.apiKey, 'openai-key');
  assert.equal(fallbackConfig?.baseUrl, 'https://api.openai.com/v1');
  assert.equal(fallbackConfig?.model, 'gpt-5-mini');
});

test('createModelClient selects planner clients from explicit env maps', () => {
  const ruleBased = createModelClient('rule-based', {
    INFRA_AGENT_OPENAI_API_KEY: 'ignored-key'
  });
  const fallback = createModelClient('auto', {});
  const llmAuto = createModelClient('auto', {
    INFRA_AGENT_OPENAI_API_KEY: 'test-api-key',
    INFRA_AGENT_MODEL: 'test-model'
  });
  const llmExplicit = createModelClient('llm', {
    INFRA_AGENT_OPENAI_API_KEY: 'test-api-key',
    INFRA_AGENT_MODEL: 'explicit-model'
  });

  assert.equal(ruleBased.name, 'rule-based-model-client');
  assert.equal(fallback.name, 'rule-based-fallback');
  assert.equal(llmAuto.name, 'llm-model-client:test-model');
  assert.equal(llmExplicit.name, 'llm-model-client:explicit-model');
  assert.throws(
    () => createModelClient('llm', {}),
    /no API key was configured/
  );
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
  assert.equal(parsed.retrievedContextBudget.totalPacketCount, 1);
  assert.equal(parsed.retrievedContextBudget.includedPacketCount, 1);
  assert.equal(parsed.retrievedContextBudget.omittedPacketCount, 0);
});

test('planner user prompt budgets retrieved context before model handoff', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const packets = Array.from({ length: 7 }, (_, index) => ({
    id: `terraform-registry-${index}`,
    source: {
      kind: 'terraform-registry',
      name: `resource:aws_test_${index}`,
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/test_${index}`
    },
    confidence: 'high',
    reason: 'Terraform Registry docs for selected root terraform/payments-api',
    contentType: 'text/markdown',
    excerpt: `# aws_test_${index}\n${'context '.repeat(240)}`,
    tokenEstimate: 10000
  }));
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    retrievedContext: packets,
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

  assert.equal(parsed.retrievedContextBudget.totalPacketCount, packets.length);
  assert.equal(parsed.retrievedContextBudget.includedPacketCount, parsed.retrievedContext.length);
  assert.equal(
    parsed.retrievedContextBudget.omittedPacketCount,
    packets.length - parsed.retrievedContext.length
  );
  assert.ok(parsed.retrievedContext.length < packets.length);
  assert.ok(parsed.retrievedContextBudget.omittedByTokenBudget > 0 || parsed.retrievedContextBudget.omittedByPacketLimit > 0);
  assert.ok(parsed.retrievedContext.every(packet => packet.excerpt.length <= parsed.retrievedContextBudget.maxExcerptChars));
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
  assert.equal(decision.action.payload?.actionFamily, 'validation-complete');
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
  assert.equal(decision.action.payload?.actionFamily, 'approval-clarification');
});

test('parsePlannerDecision preserves supported actionFamily metadata', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM copied a supported metadata family.',
        payload: {
          actionFamily: 'helm-validation',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
});

test('parsePlannerDecision normalizes unsupported actionFamily metadata', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM provided unsupported metadata.',
        payload: {
          actionFamily: 'pulumi-up-now',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'terraform-validation');
});

test('parsePlannerDecision derives stop actionFamily from stopReason when omitted', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'stop',
        summary: 'Repair budget exhausted',
        rationale: 'The bounded repair budget has been consumed.',
        payload: {
          stopReason: 'repair-budget-exhausted'
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
      repairAttempts: 2,
      maxRepairAttempts: 2,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.payload?.actionFamily, 'repair-budget-exhausted');
});

test('parsePlannerDecision clamps validate-targets commands to the selected validation plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM mixed a safe command with unsafe invented commands.',
        payload: {
          commands: [
            'terraform -chdir=terraform/payments-api apply -auto-approve',
            'helm template charts/payments-api',
            'terraform -chdir=terraform/payments-api validate'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, [
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('parsePlannerDecision falls back to selected validation commands when all LLM commands are invented', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM did not copy commands from the selected plan.',
        payload: {
          commands: [
            'pulumi up --cwd infra/payments-api --stack dev --yes',
            'terraform -chdir=terraform/payments-api apply -auto-approve'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, selectValidationCommands(runtime));
  assert.ok(decision.action.payload?.commands?.every(command => /^helm (?:lint|template) charts\/payments-api$/.test(command)));
});

test('parsePlannerDecision clamps inspect target paths to known target candidates', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM mixed valid and invalid target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            'charts/payments-api',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.targetPaths, ['charts/payments-api']);
});

test('parsePlannerDecision falls back to known inspect targets when all LLM target paths are invalid', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM invented target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(
    decision.action.payload?.targetPaths,
    preflight.targetCandidates.slice(0, 3).map(candidate => candidate.path)
  );
});

test('parsePlannerDecision clamps Terraform formatting root path to Terraform candidates', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const invalidDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM proposed an unrelated path.',
        payload: {
          rootPath: '../terraform'
        }
      }
    }),
    runtime
  );
  const validDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM copied the selected Terraform root.',
        payload: {
          rootPath: 'terraform/payments-api'
        }
      }
    }),
    runtime
  );

  assert.equal(invalidDecision.action.payload?.rootPath, 'terraform/payments-api');
  assert.equal(validDecision.action.payload?.rootPath, 'terraform/payments-api');
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

  assert.ok(steps.some(step => /approve the flagged write risk, write path, or tool category/i.test(step)));
  assert.ok(steps.some(step => /--approve-write-risk/i.test(step)));
});

test('summarizeSuggestedCommands includes approval continuation flags for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const queryConfig = resolveQueryLoopConfig({
    maxTurns: 3,
    maxRepairAttempts: 0,
    retrievedContextBudget: {
      maxPackets: 2,
      maxTokens: 500
    }
  });
  const state = {
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
    turns: [],
    config: queryConfig
  };
  const commands = summarizeSuggestedCommands(state);
  const compact = buildCompactAgentRunResult(state);

  assert.ok(commands[0]?.includes('agent'));
  assert.ok(commands[0]?.includes('--max-turns 3'));
  assert.ok(commands[0]?.includes('--max-repair-attempts 0'));
  assert.ok(commands[0]?.includes('--context-packet-limit 2'));
  assert.ok(commands[0]?.includes('--context-token-budget 500'));
  assert.ok(commands[0]?.includes('--approve-write-risk high'));
  assert.ok(commands[0]?.includes('--approve-write-path "charts/payments-api/values.yaml"'));
  assert.equal(compact.approval.resume.continuationRequired, true);
  assert.equal(compact.approval.resume.signalCount, 1);
  assert.equal(compact.approval.resume.command, commands[0]);
  assert.equal(compact.approval.resume.compactCommand, `${commands[0]} --json`);
  assert.equal(compact.approval.resume.debugCommand, `${commands[0]} --json-full`);
  assert.equal(compact.handoffCheckpoint.continuation.command, compact.approval.resume.command);
  assert.equal(compact.handoffCheckpoint.continuation.compactCommand, compact.approval.resume.compactCommand);
  assert.equal(compact.handoffCheckpoint.continuation.debugCommand, compact.approval.resume.debugCommand);
  assert.deepEqual(compact.approval.resume.primarySignal, {
    kind: 'write-approval-required',
    message: 'Approval required.',
    path: 'charts/payments-api/values.yaml',
    risk: 'high',
    toolCategory: null
  });
  assert.equal(compact.approval.resume.additionalSignalCount, 0);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, []);
  assert.deepEqual(compact.approval.grants, {
    approvedWriteRisks: [],
    approvedWritePaths: [],
    approvedToolCategories: [],
    writePathScope: 'all',
    hasExplicitApproval: false
  });
  assert.deepEqual(compact.approval.resume.writeRisks, ['high']);
  assert.deepEqual(compact.approval.resume.writePaths, ['charts/payments-api/values.yaml']);
  assert.deepEqual(compact.approval.resume.toolCategories, []);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.approvalSignalKind, 'write-approval-required');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
  assert.equal(Object.hasOwn(compact.harness.plannerHandoff, 'payload'), false);
  assert.equal(Object.hasOwn(compact.harness.plannerHandoff, 'runtime'), false);
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          primarySignal: {
            ...compact.approval.resume.primarySignal,
            path: 'charts/payments-api/other-values.yaml'
          }
        }
      }
    }),
    /approval\.resume\.primarySignal.*first included approval signal/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          command: compact.approval.resume.command?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null
        }
      },
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          command: compact.approval.resume.command?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null
        }
      }
    }),
    /approval\.resume\.command.*write approval scope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          compactCommand: compact.approval.resume.command
        }
      }
    }),
    /handoffCheckpoint\.continuation JSON commands/
  );
  assert.throws(
    () => {
      const dropBudgetFlag = (command) => command?.replace(/ --context-token-budget 500/g, '') ?? null;
      return parseCompactAgentRunResult({
        ...compact,
        handoffCheckpoint: {
          ...compact.handoffCheckpoint,
          continuation: {
            ...compact.handoffCheckpoint.continuation,
            command: dropBudgetFlag(compact.handoffCheckpoint.continuation.command),
            compactCommand: dropBudgetFlag(compact.handoffCheckpoint.continuation.compactCommand),
            debugCommand: dropBudgetFlag(compact.handoffCheckpoint.continuation.debugCommand)
          }
        },
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            command: dropBudgetFlag(compact.approval.resume.command),
            compactCommand: dropBudgetFlag(compact.approval.resume.compactCommand),
            debugCommand: dropBudgetFlag(compact.approval.resume.debugCommand)
          }
        }
      });
    },
    /approval\.resume\.command must include query config flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          compactCommand: compact.approval.resume.command
        }
      }
    }),
    /approval\.resume JSON commands/
  );
});

test('summarizeSuggestedCommands includes tool category approval continuation scope', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const queryConfig = resolveQueryLoopConfig({
    maxTurns: 4,
    maxRepairAttempts: 1,
    retrievedContextBudget: {
      maxPackets: 3,
      maxTokens: 700
    }
  });
  const state = {
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
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Approval required.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: queryConfig
  };
  const commands = summarizeSuggestedCommands(state);
  const compact = buildCompactAgentRunResult(state);

  assert.ok(commands[0]?.includes('--max-turns 4'));
  assert.ok(commands[0]?.includes('--max-repair-attempts 1'));
  assert.ok(commands[0]?.includes('--context-packet-limit 3'));
  assert.ok(commands[0]?.includes('--context-token-budget 700'));
  assert.ok(commands[0]?.includes('--approve-tool-category native-stack-config-write'));
  assert.equal(compact.approval.resume.continuationRequired, true);
  assert.equal(compact.approval.resume.command, commands[0]);
  assert.equal(compact.approval.resume.compactCommand, `${commands[0]} --json`);
  assert.equal(compact.approval.resume.debugCommand, `${commands[0]} --json-full`);
  assert.equal(compact.handoffCheckpoint.continuation.command, compact.approval.resume.command);
  assert.equal(compact.handoffCheckpoint.continuation.compactCommand, compact.approval.resume.compactCommand);
  assert.equal(compact.handoffCheckpoint.continuation.debugCommand, compact.approval.resume.debugCommand);
  assert.deepEqual(compact.approval.resume.primarySignal, {
    kind: 'tool-category-approval-required',
    message: 'Approval required.',
    path: null,
    risk: null,
    toolCategory: 'native-stack-config-write'
  });
  assert.equal(compact.approval.resume.additionalSignalCount, 0);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, []);
  assert.deepEqual(compact.approval.resume.writeRisks, []);
  assert.deepEqual(compact.approval.resume.writePaths, []);
  assert.deepEqual(compact.approval.resume.toolCategories, ['native-stack-config-write']);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.approvalSignalKind, 'tool-category-approval-required');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          command: compact.approval.resume.command?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null
        }
      },
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          command: compact.approval.resume.command?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null
        }
      }
    }),
    /approval\.resume\.command.*tool category approval scope/
  );
});

test('buildCompactAgentRunResult counts approval signals beyond the primary continuation scope', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const compact = buildCompactAgentRunResult({
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
          message: 'Approval required for values.'
        },
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Approval required for native stack config.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig({
      maxTurns: 5,
      maxRepairAttempts: 1,
      retrievedContextBudget: {
        maxPackets: 4,
        maxTokens: 800
      }
    })
  });

  assert.equal(compact.approval.resume.signalCount, 2);
  assert.equal(compact.approval.resume.additionalSignalCount, 1);
  assert.equal(compact.approval.resume.additionalCommands.length, 1);
  assert.equal(compact.approval.resume.additionalCommands[0]?.signal.kind, 'tool-category-approval-required');
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--approve-tool-category native-stack-config-write'));
  assert.ok(compact.approval.resume.command?.includes('--max-turns 5'));
  assert.ok(compact.approval.resume.command?.includes('--max-repair-attempts 1'));
  assert.ok(compact.approval.resume.command?.includes('--context-packet-limit 4'));
  assert.ok(compact.approval.resume.command?.includes('--context-token-budget 800'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--max-turns 5'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--max-repair-attempts 1'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--context-packet-limit 4'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--context-token-budget 800'));
  assert.equal(compact.approval.resume.additionalCommands[0]?.compactCommand, `${compact.approval.resume.additionalCommands[0]?.command} --json`);
  assert.equal(compact.approval.resume.additionalCommands[0]?.debugCommand, `${compact.approval.resume.additionalCommands[0]?.command} --json-full`);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, ['native-stack-config-write']);
  assert.equal(compact.approval.resume.primarySignal?.kind, 'write-approval-required');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => {
      const additionalCommand = compact.approval.resume.additionalCommands[0];
      const commandWithoutBudgetFlag = additionalCommand?.command.replace(/ --max-turns 5/g, '');
      return parseCompactAgentRunResult({
        ...compact,
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            additionalCommands: [
              {
                ...additionalCommand,
                command: commandWithoutBudgetFlag,
                compactCommand: `${commandWithoutBudgetFlag} --json`,
                debugCommand: `${commandWithoutBudgetFlag} --json-full`
              }
            ]
          }
        }
      });
    },
    /approval\.resume\.additionalCommands\[0\]\.command must include query config flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalSignalCount: 0
        }
      }
    }),
    /approval\.resume\.additionalSignalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalToolCategories: []
        }
      }
    }),
    /approval\.resume\.additionalToolCategories.*additional approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalCommands: []
        }
      }
    }),
    /approval\.resume\.additionalCommands.*non-primary approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalCommands: [
            {
              ...compact.approval.resume.additionalCommands[0],
              command: compact.approval.resume.additionalCommands[0].command.replace(/ --approve-tool-category native-stack-config-write/, ''),
              compactCommand: compact.approval.resume.additionalCommands[0].compactCommand.replace(/ --approve-tool-category native-stack-config-write/, ''),
              debugCommand: compact.approval.resume.additionalCommands[0].debugCommand.replace(/ --approve-tool-category native-stack-config-write/, '')
            }
          ]
        }
      }
    }),
    /approval\.resume\.additionalCommands\[0\]\.command.*tool category approval scope/
  );
});

test('buildCompactAgentRunResult exposes explicit approval grants', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write']
  });
  const compact = buildCompactAgentRunResult({
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
    turns: [],
    config: resolveQueryLoopConfig()
  });

  assert.deepEqual(compact.approval.grants, {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write'],
    writePathScope: 'scoped',
    hasExplicitApproval: true
  });
  assert.ok(compact.resultCard.some(line =>
    /Approval grants: write risks high; write paths charts\/payments-api; tool categories native-stack-config-write; write path scope scoped/i.test(line)
  ));
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
  assert.ok(snapshot.some(line => /Repair attempts: 0\/2/i.test(line)));
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
  assert.ok(summary.some(line => /Permission posture: 1 tool\(s\); 1 workspace mutation\(s\); 1 native command\(s\); 1 stack\/state mutation-risk tool\(s\)/i.test(line)));
  assert.ok(summary.some(line => /Changed files: infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Pulumi CLI/i.test(line)));
  assert.ok(summary.some(line => /Native CLI findings: Pulumi config updated payments-api:imageTag on stack dev/i.test(line)));
  assert.ok(summary.some(line => /Validators executed: 1 command\(s\) across Pulumi/i.test(line)));
  assert.ok(summary.some(line => /Validation findings: none/i.test(line)));
  assert.ok(summary.some(line => /Validation blockers: none/i.test(line)));
  assert.ok(summary.some(line => /Repair activity: 1\/2 bounded repair attempt\(s\) used/i.test(line)));
});

test('summarizeResultCard includes retrieved knowledge context budget', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      retrievedContext: [0, 1, 2].map(index => ({
        id: `terraform-registry-${index}`,
        source: {
          kind: 'terraform-registry',
          name: `resource:aws_test_${index}`,
          provider: 'hashicorp/aws',
          version: '5.37.0',
          url: `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/test_${index}`
        },
        confidence: 'high',
        reason: 'Terraform Registry docs for selected root terraform/payments-api',
        contentType: 'text/markdown',
        excerpt: `# aws_test_${index}\ncontext`,
        tokenEstimate: 10
      })),
      retrievedContextBudget: {
        maxPackets: 1,
        maxTokens: 500,
        maxExcerptChars: 1200
      },
      observations: [],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Knowledge context: 1\/3 packet\(s\) included; \d+\/500 token estimate used; omitted 2 \(packet-limit=2\)/i.test(line)));
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
  assert.equal(compact.validation.identityConflictSummary.totalCount, 0);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);
  assert.equal(compact.validation.identityConflicts.length, 0);
  assert.equal(compact.validation.issues[0]?.kind, 'pulumi-missing-config');
  assert.ok(compact.suggestedCommands.some(command => /validate/i.test(command)));
  assert.equal(Object.hasOwn(compact, 'turns'), false);
  assert.equal(Object.hasOwn(compact, 'preflight'), false);
});

test('summarizeResultCard includes Pulumi security duplicate validation findings', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack networking rule', 'fixtures/sample-workspace');
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
          command: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 1,
          stdout: '',
          stderr: 'error: api error InvalidPermission.Duplicate: the specified rule "peer: 10.0.0.0/16, TCP, from port: 443, to port: 443, ALLOW" already exists'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-create-before-delete-conflict',
          repairable: false,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'api error InvalidPermission.Duplicate',
          guidance: 'Review the preview for matching direction, protocol, port range, security group, and peer before sequencing replacement.',
          metadata: {
            conflictCode: 'InvalidPermission.Duplicate',
            conflictFamily: 'aws-security-group-rule',
            securityGroupRulePeers: '10.0.0.0/16'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Validation findings: Pulumi create-before-delete conflict: provider returned InvalidPermission\.Duplicate for 10\.0\.0\.0\/16\./i.test(line)));
});

test('summarizeResultCard includes Terraform exclusive identity validation findings', async () => {
  const preflight = await buildRunPreflight('update terraform edge listener rule priority', 'fixtures/terraform-workspace');
  const state = {
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
          command: 'terraform -chdir=terraform/payments-api plan',
          exitCode: 1,
          stdout: '',
          stderr: 'error: api error PriorityInUse: Priority \'100\' is currently in use'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-create-before-delete-conflict',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api plan',
          message: 'api error PriorityInUse',
          guidance: 'Review Terraform moved blocks, import/state repair, and lifecycle ordering before retrying.',
          metadata: {
            conflictCode: 'PriorityInUse',
            conflictFamily: 'aws-lb-listener-rule',
            conflictLabel: 'AWS Load Balancer Listener Rule',
            conflictSuggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence/delete the old rule before creating a new rule with the same listener priority.',
            resourceAddress: 'aws_lb_listener_rule.api',
            resourceType: 'aws_lb_listener_rule',
            listenerRulePriorities: '100'
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

  assert.ok(summary.some(line => /Validation findings: Terraform create-before-delete conflict: provider returned PriorityInUse for 100\./i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review Terraform moved blocks, import\/state repair needs, lifecycle ordering, and the matched provider identity before retrying\./i.test(line)));
  assert.ok(summary.some(line => /Identity review: Terraform locator aws_lb_listener_rule\.api; identity listenerRulePriorities=100; classify logical rename vs real replacement/i.test(line)));

  const compact = buildCompactAgentRunResult(state);
  assert.equal(compact.validation.identityConflictSummary.totalCount, 1);
  assert.equal(compact.validation.identityConflictSummary.includedCount, 1);
  assert.equal(compact.validation.identityConflictSummary.omittedCount, 0);
  assert.equal(compact.validation.identityConflictSummary.byEngine.terraform, 1);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['create-before-delete-ordering'], 1);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);
  assert.equal(compact.validation.identityConflicts.length, 1);
  assert.equal(compact.validation.identityConflicts[0]?.engine, 'terraform');
  assert.equal(compact.validation.identityConflicts[0]?.conflictCode, 'PriorityInUse');
  assert.equal(compact.validation.identityConflicts[0]?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(compact.validation.identityConflicts[0]?.conflictLabel, 'AWS Load Balancer Listener Rule');
  assert.equal(compact.validation.identityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(compact.validation.identityConflicts[0]?.resourceName, null);
  assert.equal(compact.validation.identityConflicts[0]?.resourceType, 'aws_lb_listener_rule');
  assert.equal(compact.validation.identityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.equal(compact.validation.identityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(compact.validation.identityConflicts[0]?.reviewSteps.length, 5);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[0] ?? '', /aws_lb_listener_rule\.api/);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[2] ?? '', /moved block|terraform state mv/i);
  assert.match(compact.validation.identityConflicts[0]?.suggestedAction ?? '', /listener priority/i);

  const report = buildIdentityConflictIncidentReport(compact);
  assert.equal(report.kind, 'infra-agent.identity-conflict-report');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.incidentCount, 1);
  assert.equal(report.omittedIncidentCount, 0);
  assert.equal(report.incidentSummary.totalCount, 1);
  assert.equal(report.incidentSummary.byEngine.terraform, 1);
  assert.match(report.summary[0] ?? '', /Terraform AWS Load Balancer Listener Rule at aws_lb_listener_rule\.api/);
  assert.equal(report.incidents[0]?.resourceLocator, 'aws_lb_listener_rule.api');
  assert.equal(report.incidents[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(report.incidents[0]?.mutationAllowed, false);
  assert.ok(compact.suggestedCommands.some(command => /agent .*--json > "agent-result\.json"/.test(command)));
  assert.ok(compact.suggestedCommands.some(command => /identity-report "agent-result\.json" --json/.test(command)));
});

test('compact agent result summarizes omitted identity conflict details', async () => {
  const preflight = await buildRunPreflight('update terraform edge listener rule priority', 'fixtures/terraform-workspace');
  const conflictFamilies = [
    'aws-lb-listener-rule',
    'aws-s3-bucket',
    'aws-cloudfront-alias',
    'aws-lb-listener-rule',
    'aws-s3-bucket',
    'aws-cloudfront-alias',
    'aws-lb-listener-rule'
  ];
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: conflictFamilies.map((conflictFamily, index) => ({
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform -chdir=terraform/payments-api plan',
        message: `identity conflict ${index}`,
        guidance: 'Review ownership before retrying.',
        metadata: {
          conflictCode: `Conflict${index}`,
          conflictFamily,
          conflictLabel: `Conflict ${index}`,
          resourceAddress: `aws_test_resource.example_${index}`,
          resourceType: 'aws_test_resource',
          duplicateIdentity: `resource-${index}`,
          listenerRulePriorities: conflictFamily === 'aws-lb-listener-rule' ? `${100 + index}` : undefined,
          dnsNames: conflictFamily === 'aws-cloudfront-alias' ? `api-${index}.example.com` : undefined
        }
      })),
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };

  const compact = buildCompactAgentRunResult(state);

  assert.equal(compact.validation.identityConflicts.length, 5);
  assert.equal(compact.validation.identityConflictSummary.totalCount, 7);
  assert.equal(compact.validation.identityConflictSummary.includedCount, 5);
  assert.equal(compact.validation.identityConflictSummary.maxEntries, 5);
  assert.equal(compact.validation.identityConflictSummary.omittedCount, 2);
  assert.equal(compact.validation.identityConflictSummary.byEngine.terraform, 7);
  assert.equal(compact.validation.identityConflictSummary.byEngine.pulumi, 0);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['create-before-delete-ordering'], 3);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['physical-name-ownership'], 2);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['dns-or-domain-ownership'], 2);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);

  const report = buildIdentityConflictIncidentReport(compact);
  assert.equal(report.incidentCount, 5);
  assert.equal(report.omittedIncidentCount, 2);
  assert.equal(report.incidentSummary.totalCount, 7);
  assert.equal(report.incidentSummary.mutationAllowed, false);
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
        },
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Native stack config write requires approval.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: paused pending explicit approval for a scoped high-risk change/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Approval required for high-risk write at charts\/payments-api\/templates\/deployment\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Approval resume: primary high-risk write at charts\/payments-api\/templates\/deployment\.yaml; additional 1 signal\(s\): tool categories native-stack-config-write/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Decide whether to approve high-risk write at charts\/payments-api\/templates\/deployment\.yaml before continuing\./i.test(line)));
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

test('classifyValidationIssues marks Terraform AWS route identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/network apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating Route in Route Table (rtb-0102177ec9e1ab465): operation error EC2: CreateRoute, https response error StatusCode: 400, api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists',
        '',
        '  with module.network.aws_route.private[0],',
        '  on routes.tf line 12, in resource "aws_route" "private":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_route');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'module.network.aws_route.private[0]');
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /Terraform attempted to create/i);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/i);
  assert.match(issues[0]?.guidance ?? '', /create_before_destroy/i);
});

test('classifyValidationIssues marks Terraform listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/edge plan',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ELBv2 Listener Rule: operation error Elastic Load Balancing v2: CreateRule, https response error StatusCode: 400, api error PriorityInUse: Priority \'100\' is currently in use on listener ' + listenerArn,
        '',
        '  with aws_lb_listener_rule.api,',
        '  on listeners.tf line 31, in resource "aws_lb_listener_rule" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_lb_listener_rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues uses shared specs for Terraform bucket identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/storage apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating S3 Bucket (prod-artifacts): operation error S3: CreateBucket, https response error StatusCode: 409, api error BucketAlreadyOwnedByYou: Your previous request to create the named bucket succeeded and you already own it.',
        '',
        '  with aws_s3_bucket.artifacts,',
        '  on buckets.tf line 3, in resource "aws_s3_bucket" "artifacts":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyOwnedByYou');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_s3_bucket');
  assert.match(issues[0]?.metadata?.conflictSuggestedAction ?? '', /physical bucket/i);
  assert.match(issues[0]?.guidance ?? '', /AWS S3 Bucket/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/);
});

test('classifyValidationIssues extracts Terraform AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/services apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ECR Repository (payments-api): operation error ECR: CreateRepository, https response error StatusCode: 400, api error RepositoryAlreadyExistsException: The repository with name \'payments-api\' already exists in the registry with id \'123456789012\'',
        '',
        '  with aws_ecr_repository.api,',
        '  on ecr.tf line 2, in resource "aws_ecr_repository" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RepositoryAlreadyExistsException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_ecr_repository');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'aws_ecr_repository.api');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /AWS named resource/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
});

test('classifyValidationIssues extracts Terraform Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/apps apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: services "payments-api" already exists',
        '',
        '  with kubernetes_service.api,',
        '  on service.tf line 4, in resource "kubernetes_service" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes_service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /metadata\.name, and metadata\.namespace/);
  assert.match(issues[0]?.guidance ?? '', /Kubernetes object named payments-api/);
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
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:s3:Bucket');
  assert.match(issues[0]?.guidance ?? '', /same provider identity/i);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
});

test('classifyValidationIssues extracts Pulumi Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/apps --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'kubernetes:core/v1:Service (payments-api):',
        'error: resource default/payments-api was not successfully created by the Kubernetes API server : services "payments-api" already exists'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes:core/v1:Service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.equal(issues[0]?.metadata?.kubernetesNamespaces, 'default');
  assert.match(issues[0]?.guidance ?? '', /namespace\(s\) default/);
  assert.match(issues[0]?.guidance ?? '', /aliases\/import\/state repair/);
});

test('classifyValidationIssues extracts Pulumi AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/role:Role (api-role):',
        'error: api error EntityAlreadyExists: Role with name prod-api already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:iam/role:Role');
  assert.equal(issues[0]?.metadata?.resourceName, 'api-role');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'prod-api');
  assert.match(issues[0]?.guidance ?? '', /identity prod-api/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi CloudFront alias conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:cloudfront/distribution:Distribution (edge):',
        'error: api error CNAMEAlreadyExists: The CNAME alias "api.example.com" is already associated with another CloudFront distribution: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'CNAMEAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-cloudfront-alias');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /CloudFront distribution alias\/CNAME/);
  assert.match(issues[0]?.guidance ?? '', /state moves/);
});

test('classifyValidationIssues marks Pulumi API Gateway custom domain conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/api --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:apigateway/domainName:DomainName (api-domain):',
        'error: api error ConflictException: The domain name api.example.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'ConflictException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-api-gateway-domain-name');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /API Gateway custom domain/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi Route53 InvalidChangeBatch conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/dns --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:route53/record:Record (api-validation):',
        'error: 1 error occurred:',
        '  * api error InvalidChangeBatch: [Tried to create resource record set [name="_abc.api.example.com.", type="CNAME"] but it already exists]: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidChangeBatch');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route53-record');
  assert.equal(issues[0]?.metadata?.dnsNames, '_abc.api.example.com.');
  assert.equal(issues[0]?.metadata?.recordTypes, 'CNAME');
  assert.match(issues[0]?.guidance ?? '', /ACM validation CNAMEs/);
  assert.match(issues[0]?.guidance ?? '', /allowOverwrite/);
});

test('classifyValidationIssues marks Pulumi security group duplicate permission conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/network --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule (api-https):',
        'error: api error InvalidPermission.Duplicate: the specified rule "peer: 10.0.0.0/16, TCP, from port: 443, to port: 443, ALLOW" already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidPermission.Duplicate');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-vpc-security-group-rule');
  assert.equal(issues[0]?.metadata?.securityGroupRulePeers, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /security group rule/);
  assert.match(issues[0]?.guidance ?? '', /direction, protocol, port range, security group, and peer/);
  assert.match(issues[0]?.guidance ?? '', /inline, legacy, and VPC-style rule managers/);
});

test('classifyValidationIssues marks Pulumi listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:lb/listenerRule:ListenerRule (api-https):',
        `error: api error PriorityInUse: Priority '100' is currently in use on listener ${listenerArn}: provider=aws@7.23.0`
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /load balancer listener rule/);
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues marks Pulumi IAM OIDC provider duplicate conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/openIdConnectProvider:OpenIdConnectProvider (github):',
        'error: api error EntityAlreadyExists: Provider with url https://token.actions.githubusercontent.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-iam-oidc-provider');
  assert.equal(issues[0]?.metadata?.oidcProviderUrls, 'https://token.actions.githubusercontent.com');
  assert.match(issues[0]?.guidance ?? '', /IAM OIDC provider/);
  assert.match(issues[0]?.guidance ?? '', /role trust policies/);
  assert.match(issues[0]?.guidance ?? '', /import\/state repair or aliases/);
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
