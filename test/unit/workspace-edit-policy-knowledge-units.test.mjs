import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { buildEditPlan } from '../../src/agent/build-edit-plan.ts';

function compactKnowledgePack({ domain, targetPath, sourceKind, units }) {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: '1234567890abcdef12345678',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: [domain],
    targetPaths: [targetPath],
    sourceIds: ['source-1'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: 10,
    maxUnits: 10,
    staleSourceCount: 0,
    storagePolicy: {
      publicReferenceCount: 1,
      internalTeamCount: 0,
      privateWorkspaceCount: 0,
      restrictedSecretCount: 0
    },
    sources: [
      {
        id: 'source-1',
        domain,
        targetPath,
        kind: sourceKind,
        name: `${targetPath} docs`,
        version: '1.0.0',
        url: 'https://example.test/raw/do-not-leak',
        factCount: units.length,
        contentHash: 'sha256:do-not-leak',
        fetchedAt: null,
        stale: false,
        freshness: 'unchecked',
        storagePolicy: 'public-reference'
      }
    ],
    facts: [],
    units: units.map(unit => ({
      unitType: 'fact',
      sourceId: 'source-1',
      confidence: 'high',
      extractionMethod: `${domain}-compact-test`,
      privacyScope: 'public-reference',
      ...unit
    }))
  };
}

test('buildEditPlan uses compact knowledge unit enum facts for ingress className', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-knowledge-enum-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await rm(join(workspaceRoot, 'charts/payments-api/values.schema.json'), { force: true });

    const preflight = await buildRunPreflight('add ingress to payments-api dev chart', workspaceRoot);
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const editPlan = buildEditPlan({
      task: preflight.task,
      preflight,
      knowledgeFacts: compactKnowledgePack({
        domain: 'helm',
        targetPath: 'charts/payments-api',
        sourceKind: 'chart-docs',
        units: [
          {
            factKind: 'chart-value',
            path: 'values.ingress.className',
            summary: 'Ingress className must use the documented controller.',
            sourceLocator: 'Chart docs: ingress.className',
            values: ['alb']
          }
        ]
      }),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: valuesPath,
            content: await readFile(valuesPath, 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    });

    const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
    assert.match(valuesWrite?.content ?? '', /\n  className: alb\n/);
    assert.match(editPlan?.rationale ?? '', /Chart docs: ingress\.className allows alb|allows alb/i);
    assert.doesNotMatch(JSON.stringify(editPlan), /https:\/\/example\.test|raw\/do-not-leak|contentHash|sha256:do-not-leak/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('buildEditPlan uses compact knowledge unit Pulumi config keys before project-name fallback', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-knowledge-semantics-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await writeFile(
      join(workspaceRoot, 'infra/payments-api/Pulumi.yaml'),
      [
        'name: shared-payments',
        'runtime: yaml',
        'description: Synthetic project name drift',
        'resources: {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(workspaceRoot, 'infra/payments-api/Pulumi.dev.yaml'),
      'config: {}\n',
      'utf8'
    );

    const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 3.4.5', workspaceRoot);
    const projectPath = join(workspaceRoot, 'infra/payments-api/Pulumi.yaml');
    const stackPath = join(workspaceRoot, 'infra/payments-api/Pulumi.dev.yaml');
    const editPlan = buildEditPlan({
      task: preflight.task,
      preflight,
      knowledgeFacts: compactKnowledgePack({
        domain: 'pulumi',
        targetPath: 'infra/payments-api',
        sourceKind: 'pulumi-docs',
        units: [
          {
            factKind: 'pulumi-config-parameter',
            path: 'config.payments-api:imageTag',
            summary: 'imageTag is a required stack config key.',
            sourceLocator: 'Pulumi docs: imageTag',
            required: true
          },
          {
            factKind: 'pulumi-config-parameter',
            path: 'config.payments-api:environment',
            summary: 'environment is a required stack config key.',
            sourceLocator: 'Pulumi docs: environment',
            required: true
          }
        ]
      }),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: projectPath,
            content: await readFile(projectPath, 'utf8'),
            truncated: false
          }
        },
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: stackPath,
            content: await readFile(stackPath, 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    });

    assert.ok(editPlan);
    const writeContent = editPlan?.writes[0]?.content ?? '';
    assert.match(editPlan?.rationale ?? '', /payments-api:environment and payments-api:imageTag/);
    assert.match(writeContent, /payments-api:imageTag:\s+3\.4\.5/);
    assert.match(writeContent, /payments-api:environment:\s+dev/);
    assert.doesNotMatch(writeContent, /shared-payments:imageTag:/);
    assert.doesNotMatch(JSON.stringify(editPlan), /https:\/\/example\.test|raw\/do-not-leak|contentHash|sha256:do-not-leak/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
