import test from "node:test";
import assert from "node:assert/strict";
import { parseInfraGraphResult } from "../../src/cli/infra-graph-contract.ts";
import { buildValidInfraGraphFixture } from "../support/infra-graph-contract-fixtures.mjs";

test("infra graph contract validates source provenance", () => {
  const validGraph = buildValidInfraGraphFixture();

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
});
