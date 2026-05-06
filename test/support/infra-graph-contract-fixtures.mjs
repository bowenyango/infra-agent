export function buildValidInfraGraphFixture() {
  return {
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
}
