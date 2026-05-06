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
