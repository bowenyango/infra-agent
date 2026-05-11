export function buildCompactHandoffBudgetsFixture(overrides = {}) {
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
    knowledgeUnits: { includedCount: 0, omittedCount: 0 },
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

export function buildEmptyKnowledgeFactsFixture(overrides = {}) {
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
    totalUnitCount: 0,
    includedUnitCount: 0,
    omittedUnitCount: 0,
    staleSourceCount: 0,
    uncheckedSourceCount: 0,
    sources: [],
    facts: [],
    units: [],
    ...overrides
  };
}

export function buildEmptyApprovalGrantsFixture() {
  return {
    approvedWriteRisks: [],
    approvedWritePaths: [],
    approvedToolCategories: [],
    writePathScope: 'all',
    hasExplicitApproval: false
  };
}

export function buildEmptyApprovalPendingScopeFixture() {
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
