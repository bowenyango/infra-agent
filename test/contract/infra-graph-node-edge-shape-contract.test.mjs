import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates node and edge shapes", () => {
  const validGraph = buildValidInfraGraphFixture();

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
});
