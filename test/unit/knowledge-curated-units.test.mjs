import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { validateKnowledgePayloadWithLocalSources } from '../../src/knowledge/validate.ts';

async function writeWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/terraform-rename-units.json',
            name: 'terraform-rename-internal',
            version: '2026-05-12'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-rename-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: [
        {
          unitType: 'guidance',
          path: 'guidance.terraform.logical-rename',
          summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
          confidence: 'high',
          topic: 'terraform-logical-rename',
          appliesWhen: ['Terraform resource address rename'],
          risk: 'Without a moved block, a rename can look like destroy and create.'
        },
        {
          unitType: 'example',
          path: 'example.terraform.moved-block',
          summary: 'Minimal moved block for a Terraform resource rename.',
          exampleType: 'terraform-moved-block',
          language: 'hcl',
          snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }',
          appliesWhen: ['Terraform resource address rename']
        },
        {
          unitType: 'recipe',
          path: 'recipe.terraform.safe-rename',
          summary: 'Review a Terraform logical rename before editing infrastructure.',
          name: 'Terraform safe logical rename',
          steps: [
            'Add or verify a moved block for the resource address change.',
            'Run a plan and check that the object is moved, not recreated.'
          ],
          requiresApproval: true
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
}

test('configured local curated knowledge unit sources are listed as private local sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-curated-source-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const source = report.sources.find(entry => entry.source.kind === 'internal-knowledge');

    assert.ok(source);
    assert.equal(source.domain, 'terraform');
    assert.equal(source.targetPath, 'terraform/app');
    assert.equal(source.source.localPath, 'knowledge/terraform-rename-units.json');
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
    assert.equal(source.storagePolicy.defaultStore, 'local-only');
    assert.equal(source.storagePolicy.requiresExplicitOptIn, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('local curated knowledge units extract and pack without fact payloads', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-curated-units-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const internalSource = extraction.sources.find(source => source.source.kind === 'internal-knowledge');
    const unitSet = extraction.unitSets.find(source => source.source.kind === 'internal-knowledge');
    const factSet = extraction.factSets.find(source => source.source.kind === 'internal-knowledge');
    const extractionValidation = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.equal(internalSource?.status, 'extracted');
    assert.equal(internalSource?.factCount, 0);
    assert.equal(internalSource?.unitCount, 3);
    assert.equal(factSet?.factCount, 0);
    assert.equal(unitSet?.unitCount, 3);
    assert.deepEqual(
      unitSet?.units.map(unit => unit.unitType).sort(),
      ['example', 'guidance', 'recipe']
    );
    assert.ok(unitSet?.units.every(unit => unit.privacyScope === 'internal-team'));
    assert.equal(extractionValidation.valid, true);

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxUnits: 10,
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const packValidation = await validateKnowledgePayloadWithLocalSources(pack, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.ok(pack.sources.some(source =>
      source.kind === 'internal-knowledge'
      && source.factCount === 0
      && source.storagePolicy.scope === 'workspace-private'
    ));
    assert.equal(pack.facts.length, 0);
    assert.equal(pack.unitCount, 3);
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'terraform-logical-rename'
      && unit.privacyScope === 'internal-team'
    ));
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.mutationAllowed === false
    ));
    assert.equal(packValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
