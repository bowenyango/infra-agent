import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates impact summary", () => {
  const validGraph = buildValidInfraGraphFixture();

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
});
