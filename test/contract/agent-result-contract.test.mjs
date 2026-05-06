import {
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
} from '../support/cli-smoke-harness.mjs';

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
        plannerConfig: null
      }
    }),
    /harness\.plannerConfig/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerConfig: {
          ...validResult.harness.plannerConfig,
          clientName: 'different-model'
        }
      }
    }),
    /harness\.plannerConfig\.clientName/
  );
  const llmResult = {
    ...validResult,
    modelName: 'llm-model-client:codex-infra-test',
    readiness: {
      ...validResult.readiness,
      doctorCommand: 'infra-agent doctor /workspace --model codex-infra-test --openai-base-url https://models.example.test/v1 --json'
    },
    harness: {
      ...validResult.harness,
      plannerConfig: {
        requestedMode: 'llm',
        effectiveMode: 'llm',
        clientName: 'llm-model-client:codex-infra-test',
        fallbackReason: null,
        llm: {
          provider: 'openai-compatible',
          model: 'codex-infra-test',
          baseUrl: 'https://models.example.test/v1',
          apiKeyConfigured: true,
          apiKeySource: 'OPENAI_API_KEY',
          providerSource: 'default',
          modelSource: 'cli',
          baseUrlSource: 'cli',
          capabilities: {
            transport: 'chat-completions',
            endpointPath: '/chat/completions',
            responseFormat: 'json-object',
            supportsJsonObject: true,
            supportsStreaming: false
          }
        }
      }
    }
  };
  assert.equal(parseCompactAgentRunResult(llmResult).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      readiness: {
        ...llmResult.readiness,
        doctorCommand: 'infra-agent doctor /workspace --planner llm --model codex-infra-test --openai-base-url https://models.example.test/v1 --json'
      }
    }),
    /readiness\.doctorCommand must not include planner mode flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      harness: {
        ...llmResult.harness,
        plannerConfig: {
          ...llmResult.harness.plannerConfig,
          llm: {
            ...llmResult.harness.plannerConfig.llm,
            model: 'wrong-model'
          }
        }
      }
    }),
    /harness\.plannerConfig\.llm\.model/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      harness: {
        ...llmResult.harness,
        plannerConfig: {
          ...llmResult.harness.plannerConfig,
          llm: {
            ...llmResult.harness.plannerConfig.llm,
            capabilities: {
              ...llmResult.harness.plannerConfig.llm.capabilities,
              supportsStreaming: true
            }
          }
        }
      }
    }),
    /harness\.plannerConfig\.llm\.capabilities\.supportsStreaming/
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
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: undefined
      }
    }),
    /readiness\.plannerProviderCatalog must be an object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          apiKey: 'secret-value'
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.apiKey must not be included/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          command: 'infra-agent planner-providers --json --live'
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.command/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          liveProviderCheck: true
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.liveProviderCheck/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          supportedProviderIds: ['openai-compatible', 'other-provider']
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.supportedProviderIds/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          supportedProviderCount: 2
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.supportedProviderCount/
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
    () => {
      const { pendingScope, ...resumeWithoutPendingScope } = validResult.approval.resume;
      void pendingScope;
      return parseCompactAgentRunResult({
        ...validResult,
        approval: {
          ...validResult.approval,
          resume: resumeWithoutPendingScope
        }
      });
    },
    /approval\.resume\.pendingScope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          pendingScope: {
            ...validResult.approval.resume.pendingScope,
            signalCount: 1
          }
        }
      }
    }),
    /approval\.resume\.pendingScope\.signalCount/
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
      knowledgeFacts: null
    }),
    /knowledgeFacts object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        kind: 'infra-agent.knowledge-pack'
      }
    }),
    /knowledgeFacts\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        mutationAllowed: true
      }
    }),
    /knowledgeFacts\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        totalFactCount: 3
      }
    }),
    /knowledgeFacts fact counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        includedFactCount: 3
      }
    }),
    /knowledgeFacts fact counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        includedFactCount: 9,
        omittedFactCount: 0,
        totalFactCount: 9,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            factCount: 9
          }
        ],
        facts: validResult.knowledgeFacts.facts
      }
    }),
    /knowledgeFacts\.includedFactCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        packId: 'not-a-pack-id'
      }
    }),
    /knowledgeFacts\.packId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            kind: 'blog-post'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            freshness: 'unknown'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.freshness/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            fingerprintDigest: 'not-a-sha',
            fingerprintFileCount: 1
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.fingerprintDigest/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        staleSourceCount: 1,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            stale: true,
            staleReason: 'local-file-hash-mismatch',
            freshness: 'stale'
          }
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.confidence/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            sourceId: 'missing-source'
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.sourceId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            extractionMethod: 'manual-copy'
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.extractionMethod/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            source: {
              contentHash: 'raw-hash'
            }
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgeFacts: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgeFacts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          knowledgeFactCount: 1
        }
      }
    }),
    /harness\.stateSummary\.knowledgeFactCount/
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
