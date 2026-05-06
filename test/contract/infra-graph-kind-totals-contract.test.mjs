import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates kind totals", () => {
  const validGraph = buildValidInfraGraphFixture();

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
});
