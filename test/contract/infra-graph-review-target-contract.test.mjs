import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates review targets", () => {
  const validGraph = buildValidInfraGraphFixture();

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
