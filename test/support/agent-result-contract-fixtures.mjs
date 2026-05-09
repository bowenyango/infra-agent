import { resolve } from 'node:path';
import {
  buildCompactHandoffBudgetsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture
} from './compact-fixtures.mjs';
import { main } from '../../src/cli/main.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';

export function buildAgentResultContractFixtures() {
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
        },
        knowledgeFacts: {
          includedCount: 2,
          omittedCount: 0
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
      plannerConfig: {
        requestedMode: 'rule-based',
        effectiveMode: 'rule-based',
        clientName: 'rule-based',
        fallbackReason: null,
        llm: null
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
        knowledgeFactCount: 2,
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
      plannerProviderCatalog: buildPlannerProviderCatalogDiscovery(),
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
        pendingScope: buildEmptyApprovalPendingScopeFixture(),
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
    },
    knowledgeFacts: {
      kind: 'infra-agent.knowledge-facts-summary',
      schemaVersion: 1,
      mutationAllowed: false,
      packId: '1234567890abcdef12345678',
      maxFacts: 8,
      sourceCount: 1,
      factSetCount: 1,
      totalFactCount: 2,
      includedFactCount: 2,
      omittedFactCount: 0,
      staleSourceCount: 0,
      uncheckedSourceCount: 0,
      sources: [
        {
          id: 'terraform-registry/aws-lb-listener-rule',
          domain: 'terraform',
          targetPath: 'terraform/payments-api',
          kind: 'terraform-registry',
          name: 'aws_lb_listener_rule',
          factCount: 2,
          stale: false,
          freshness: 'fresh'
        }
      ],
      facts: [
        {
          kind: 'argument',
          path: 'resource.aws_lb_listener_rule.priority',
          summary: 'Listener rule priority must be unique per listener.',
          confidence: 'high',
          extractionMethod: 'terraform-registry-markdown',
          sourceId: 'terraform-registry/aws-lb-listener-rule',
          sourceLocator: 'terraform-registry/aws-lb-listener-rule#priority',
          required: true,
          type: 'number',
          relatedPaths: ['resource.aws_lb_listener_rule.listener_arn']
        },
        {
          kind: 'attribute',
          path: 'resource.aws_lb_listener_rule.arn',
          summary: 'ARN is assigned by AWS after creation.',
          confidence: 'medium',
          extractionMethod: 'terraform-registry-markdown',
          sourceId: 'terraform-registry/aws-lb-listener-rule',
          sourceLocator: 'terraform-registry/aws-lb-listener-rule#arn'
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
        },
        knowledgeFacts: {
          includedCount: validResult.knowledgeFacts.includedFactCount,
          omittedCount: validResult.knowledgeFacts.omittedFactCount
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


  return {
    validResult,
    validSafetyBlocker,
    validUnsafeSafetyBlocker,
    resultWithSafetyBlockers,
    resultWithToolEntries,
    twoToolEntries
  };
}
