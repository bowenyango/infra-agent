export function buildIdentityConflictAgentResultFixture(workspaceRoot = '/workspace') {
  return {
    kind: 'infra-agent.agent-result',
    schemaVersion: 1,
    task: 'update terraform listener priority',
    workspaceRoot,
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
      budgets: {
        turnTrace: { includedCount: 0, omittedCount: 0 },
        lifecycleEvents: { includedCount: 0, omittedCount: 0 },
        toolTrace: { includedCount: 0, omittedCount: 0 },
        workPlan: { includedCount: 0, omittedCount: 0 },
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
      },
      continuation: {
        required: true,
        reason: 'validation',
        nextControlAction: 'resolve-validation',
        approvalRequired: false,
        command: null,
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
            'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.',
            'Confirm listener ARN and priority match the existing listener rule.'
          ],
          suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
          sourceCommand: 'terraform -chdir=terraform/payments-api plan'
        }
      ]
    },
    knowledgeCache: {
      root: `${workspaceRoot}/.infra-agent/knowledge-cache`,
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
  };
}
