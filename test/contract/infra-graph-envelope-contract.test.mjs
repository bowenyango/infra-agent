import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates the top-level envelope", () => {
  const validGraph = buildValidInfraGraphFixture();

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
});
