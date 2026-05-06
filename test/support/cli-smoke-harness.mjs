import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import { buildTargetCandidates, detectRequestedService } from '../../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../../src/validators/preflight.ts';
import { classifyValidationIssues } from '../../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import { LLMModelClient } from '../../src/model/LLMModelClient.ts';
import { createModelClient, createModelClientSelection } from '../../src/model/create-model-client.ts';
import { resolveLLMClientConfig } from '../../src/model/config.ts';
import { createLLMProviderAdapter } from '../../src/model/provider-adapter.ts';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities
} from '../../src/model/providers.ts';
import { parsePlannerDecision } from '../../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from '../../src/model/prompt.ts';
import { buildEditPlan } from '../../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../../src/agent/collect-approval-signals.ts';
import {
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
  summarizeAgentSnapshot,
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizeInfraGraphImpact,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands,
  printPlannerProviderCatalogReport,
  printDoctorReport,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands
} from '../../src/cli/output.ts';
import { buildLLMClientConfigOverrides, main, parseArgs, readPackageVersion } from '../../src/cli/main.ts';
import { buildDoctorReport } from '../../src/cli/doctor.ts';
import {
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND
} from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import {
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES
} from '../../src/cli/exit-codes.ts';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { parseInfraGraphResult } from '../../src/cli/infra-graph-contract.ts';
import {
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport
} from '../../src/cli/infra-graph-report.ts';
import {
  loadIdentityConflictIncidentReport,
  parseIdentityConflictIncidentReport
} from '../../src/cli/identity-report.ts';
import { executeTool } from '../../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { SearchWorkspaceTool } from '../../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { ValidateTargetsTool } from '../../src/tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { classifyUnsafeValidationCommand } from '../../src/validators/command-safety.ts';
import { resolveEffectiveApprovalPolicy } from '../../src/domain/workspace-policy.ts';
import { resolveEffectiveEditPolicy } from '../../src/domain/edit-policy.ts';
import { inferRequestedDomains } from '../../src/domain/domain-focus.ts';
import { prioritizeEditPlanKinds } from '../../src/agent/edit-plan-priority.ts';
import { buildInspectionCandidateFiles, buildInspectionSearchPattern } from '../../src/agent/inspection-priority.ts';
import { deriveConfigSemanticsFromValidationIssues, mergeConfigSemantics } from '../../src/agent/config-semantics-state.ts';
import { resolveQueryLoopConfig } from '../../src/query-config.ts';
import {
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import { resolveKnowledgeCacheRoot } from '../../src/knowledge/cache-root.ts';
import { fetchOfficialKnowledgeSource, retrieveKnowledgeContextPacket } from '../../src/knowledge/retrieve.ts';
import {
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets
} from '../../src/domain/terraform-registry-context.ts';
import {
  buildTerraformLocalModuleKnowledgeContent,
  buildTerraformLocalModuleKnowledgeSources
} from '../../src/domain/terraform-local-modules.ts';
import {
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets
} from '../../src/domain/terraform-provider-schema.ts';
import {
  buildPulumiConfigKnowledgeContent,
  buildPulumiConfigKnowledgeSources
} from '../../src/domain/pulumi-config-knowledge.ts';
import {
  buildHelmChartMetadataKnowledgeContent,
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets
} from '../../src/domain/helm-chart-context.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';
import {
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS
} from '../../src/types/knowledge.ts';
import { parseKnowledgeFactSet } from '../../src/knowledge/facts-contract.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import {
  validateKnowledgePayload,
  validateKnowledgePayloadWithLocalSources
} from '../../src/knowledge/validate.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';
import { rankKnowledgePackFacts } from '../../src/knowledge/fact-ranking.ts';
import {
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles
} from '../../src/knowledge/local-source-fingerprint.ts';
import { buildStableInfraGraphSnapshot } from '../../src/impact/graph-snapshot.ts';
import { normalizeInfraGraphImpactReviewTargets } from '../../src/impact/graph-impact-summary.ts';
import { buildWorkspaceInfraGraph, summarizeInfraGraph } from '../../src/impact/workspace-graph.ts';
import {
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges
} from '../../src/impact/terraform-plan-graph.ts';
import {
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges
} from '../../src/impact/pulumi-preview-graph.ts';

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
    knowledgeFacts: { includedCount: 0, omittedCount: 0 },
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

function buildEmptyKnowledgeFactsFixture(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-facts-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: null,
    maxFacts: 8,
    sourceCount: 0,
    factSetCount: 0,
    totalFactCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    staleSourceCount: 0,
    sources: [],
    facts: [],
    ...overrides
  };
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

function buildEmptyApprovalPendingScopeFixture() {
  return {
    signalCount: 0,
    includedSignalCount: 0,
    omittedSignalCount: 0,
    additionalSignalCount: 0,
    writeRiskCount: 0,
    writePathCount: 0,
    toolCategoryCount: 0
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

export {
  test,
  assert,
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
  tmpdir,
  resolve,
  join,
  inspectWorkspace,
  runSingleStep,
  executeDecision,
  buildTargetCandidates,
  detectRequestedService,
  buildRunPreflight,
  selectValidationCommands,
  buildValidationPreflight,
  classifyValidationIssues,
  RuleBasedPlanningModel,
  LLMModelClient,
  createModelClient,
  createModelClientSelection,
  resolveLLMClientConfig,
  createLLMProviderAdapter,
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities,
  parsePlannerDecision,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildEditPlan,
  collectApprovalSignals,
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
  summarizeAgentSnapshot,
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizeInfraGraphImpact,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands,
  printPlannerProviderCatalogReport,
  printDoctorReport,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands,
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion,
  buildDoctorReport,
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND,
  parsePlannerProviderCatalogReport,
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES,
  parseCompactAgentRunResult,
  parseInfraGraphResult,
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport,
  loadIdentityConflictIncidentReport,
  parseIdentityConflictIncidentReport,
  executeTool,
  PulumiConfigSetTool,
  SearchWorkspaceTool,
  ValidateTargetsTool,
  classifyUnsafeValidationCommand,
  resolveEffectiveApprovalPolicy,
  resolveEffectiveEditPolicy,
  inferRequestedDomains,
  prioritizeEditPlanKinds,
  buildInspectionCandidateFiles,
  buildInspectionSearchPattern,
  deriveConfigSemanticsFromValidationIssues,
  mergeConfigSemantics,
  resolveQueryLoopConfig,
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry,
  resolveKnowledgeCacheRoot,
  fetchOfficialKnowledgeSource,
  retrieveKnowledgeContextPacket,
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets,
  buildTerraformLocalModuleKnowledgeContent,
  buildTerraformLocalModuleKnowledgeSources,
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets,
  buildPulumiConfigKnowledgeContent,
  buildPulumiConfigKnowledgeSources,
  buildHelmChartMetadataKnowledgeContent,
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets,
  prefetchWorkspaceKnowledge,
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS,
  parseKnowledgeFactSet,
  extractKnowledgeFactSetFromCacheEntry,
  extractWorkspaceKnowledgeFacts,
  validateKnowledgePayload,
  validateKnowledgePayloadWithLocalSources,
  buildKnowledgePack,
  budgetKnowledgePackFacts,
  rankKnowledgePackFacts,
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles,
  buildStableInfraGraphSnapshot,
  normalizeInfraGraphImpactReviewTargets,
  buildWorkspaceInfraGraph,
  summarizeInfraGraph,
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges,
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges,
  captureStdout,
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture,
  buildGraphSnapshotBaseGraph,
  buildGraphSnapshotTerraformPlan,
  buildGraphSnapshotPulumiPreview,
  writeTerraformProviderSchemaWorkspace
};
