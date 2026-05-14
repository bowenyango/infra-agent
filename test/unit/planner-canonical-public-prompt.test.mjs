import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlannerUserPrompt } from '../../src/model/prompt.ts';
import {
  buildCanonicalPublicKnowledgePacks,
  collectObjectKeys
} from '../support/canonical-public-knowledge-fixtures.mjs';

const REQUIRED_UNIT_TYPES = [
  'fact',
  'guidance',
  'example',
  'diagnostic',
  'recipe'
];

const RAW_PAYLOAD_KEYS = [
  'content',
  'url',
  'contentHash',
  'sourceContentHash',
  'fetchedAt',
  'staleAfter'
];

const RAW_MARKDOWN_HEADINGS = [
  '# AWS Provider',
  '## Basic Usage',
  '### Provider Configuration',
  '## Modules',
  '## TypeScript Usage',
  '# kube-prometheus-stack',
  '## Values',
  '## Example Values'
];

function buildPreflightFixture(target) {
  return {
    task: 'plan from canonical public reference knowledge',
    workspaceRoot: '/workspace',
    profile: {
      id: 'generic',
      label: 'Generic infrastructure repository',
      reasons: []
    },
    approval: {
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: []
    },
    effectiveApprovalPolicy: {
      requiredWriteRisks: [],
      requiredToolCategories: [],
      pathRules: [],
      sources: []
    },
    effectiveEditPolicy: {
      allowedEditPlanKinds: null,
      allowedTargetPrefixes: null,
      allowedTargetPrefixesByKind: {},
      sources: []
    },
    inspection: {
      workspaceRoot: '/workspace',
      profile: {
        id: 'generic',
        label: 'Generic infrastructure repository',
        reasons: []
      },
      config: null,
      configSemantics: [],
      domainCapabilities: [],
      helmCharts: [],
      pulumiProjects: [],
      terraformRoots: [],
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'default'
      },
      counts: {
        helmChartFiles: 0,
        pulumiProjectFiles: 0,
        pulumiStackFiles: 0,
        terraformRootFiles: 0,
        terraformVariableFiles: 0
      }
    },
    validation: {
      workspaceRoot: '/workspace',
      validators: [],
      plan: [],
      usedWorkspaceConfig: false
    },
    requestedDomains: [target.domain],
    requestedEnvironment: null,
    requestedService: null,
    targetCandidates: [
      {
        kind: target.targetKind,
        name: target.targetName,
        path: target.targetPath,
        score: 10,
        reasons: ['canonical public target'],
        matchedEnvironmentHints: [],
        details: []
      }
    ],
    assumptions: [],
    blockers: [],
    nextActions: []
  };
}

function buildRuntimeFixture({ target, pack }) {
  return {
    task: 'plan from canonical public reference knowledge',
    preflight: buildPreflightFixture(target),
    knowledgeFacts: pack,
    retrievedContextBudget: {
      maxPackets: 5,
      maxTokens: 1000,
      maxExcerptChars: 1200,
      maxFacts: 8
    },
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    maxRepairAttempts: 2,
    lastEditPlan: null
  };
}

function assertIdentityMatchesTarget(entry, target) {
  const source = target.source;

  assert.equal(entry.domain, target.domain);
  assert.equal(entry.targetPath, target.targetPath);
  assert.equal(entry.sourceKind, source.kind);
  assert.equal(entry.sourceName, source.name);

  for (const field of ['provider', 'packageName', 'chart', 'version']) {
    if (source[field] !== undefined) {
      assert.equal(entry[field], source[field]);
    } else {
      assert.equal(entry[field], undefined);
    }
  }
}

function assertRetrievalKeysIncludeIdentity(entry, target) {
  const source = target.source;

  assert.ok(entry.retrievalKeys.includes(`domain:${target.domain}`));
  assert.ok(entry.retrievalKeys.includes(`targetPath:${target.targetPath}`));
  assert.ok(entry.retrievalKeys.includes(`sourceKind:${source.kind}`));

  for (const field of ['provider', 'packageName', 'chart', 'version']) {
    if (source[field] !== undefined) {
      assert.ok(entry.retrievalKeys.includes(`${field}:${source[field]}`));
    }
  }

  for (const unitType of REQUIRED_UNIT_TYPES) {
    assert.ok(entry.retrievalKeys.includes(`unitType:${unitType}`));
  }
}

function assertPromptOmitsRawPublicDocs(prompt, parsed) {
  const keys = collectObjectKeys(parsed);
  for (const key of RAW_PAYLOAD_KEYS) {
    assert.equal(keys.has(key), false, `prompt should omit raw payload key ${key}`);
  }

  assert.doesNotMatch(prompt, /https:\/\//);
  for (const heading of RAW_MARKDOWN_HEADINGS) {
    assert.doesNotMatch(prompt, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

test('planner user prompt carries canonical public packs as compact unit context', async t => {
  const packs = await buildCanonicalPublicKnowledgePacks({ maxUnits: 8 });

  for (const fixture of packs) {
    await t.test(fixture.key, () => {
      const prompt = buildPlannerUserPrompt(buildRuntimeFixture(fixture));
      const parsed = JSON.parse(prompt);
      const knowledgeFacts = parsed.knowledgeFacts;
      const unitIndex = knowledgeFacts.unitIndex;
      const entry = unitIndex?.entries?.[0];

      assert.ok(Array.isArray(knowledgeFacts.units));
      assert.ok(knowledgeFacts.units.length <= 8);
      assert.ok(knowledgeFacts.units.length > 0);
      assert.ok(knowledgeFacts.units.every(unit => unit.privacyScope === 'public-reference'));
      assert.deepEqual(
        new Set(knowledgeFacts.units.map(unit => unit.unitType)),
        new Set(REQUIRED_UNIT_TYPES)
      );

      assert.equal(unitIndex?.kind, 'infra-agent.knowledge-unit-index');
      assert.equal(unitIndex?.mutationAllowed, false);
      assert.equal(unitIndex?.sourceCount, 1);
      assert.equal(unitIndex?.includedUnitCount, knowledgeFacts.includedUnitCount);
      assert.equal(unitIndex?.omittedUnitCount, knowledgeFacts.omittedUnitCount);
      assert.equal(typeof knowledgeFacts.includedUnitCount, 'number');
      assert.equal(typeof knowledgeFacts.omittedUnitCount, 'number');
      assert.equal(knowledgeFacts.includedUnitCount, knowledgeFacts.units.length);
      assert.ok(knowledgeFacts.includedUnitCount <= knowledgeFacts.maxUnits);
      assert.ok(knowledgeFacts.omittedUnitCount > 0);

      assert.ok(entry);
      assertIdentityMatchesTarget(entry, fixture.target);
      assert.equal(entry.storageScope, 'public-reference');
      assert.deepEqual(entry.privacyScopes, ['public-reference']);
      assert.equal(typeof entry.includedUnitCount, 'number');
      assert.equal(typeof entry.omittedUnitCount, 'number');
      assert.equal(entry.includedUnitCount, knowledgeFacts.includedUnitCount);
      assert.equal(entry.omittedUnitCount, knowledgeFacts.omittedUnitCount);
      assert.deepEqual(
        Object.keys(entry.unitCounts).sort(),
        [...REQUIRED_UNIT_TYPES].sort()
      );
      assertRetrievalKeysIncludeIdentity(entry, fixture.target);

      assertPromptOmitsRawPublicDocs(prompt, parsed);
    });
  }
});
