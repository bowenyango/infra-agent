import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { parseInfraGraphResult } from '../../src/cli/infra-graph-contract.ts';
import {
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport
} from '../../src/cli/infra-graph-report.ts';

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
