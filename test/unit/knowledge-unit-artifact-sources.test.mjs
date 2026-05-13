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
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { validateKnowledgePayloadWithLocalSources } from '../../src/knowledge/validate.ts';

function registrySourceFixture() {
  return {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function unitArtifactPayload() {
  const source = registrySourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'b'.repeat(64);
  const sourceRef = {
    id: sourceId,
    source,
    contentHash: sourceContentHash,
    locator: 'Terraform Registry: aws_s3_bucket'
  };

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-12T00:00:00.000Z',
    unitCount: 3,
    units: [
      {
        unitType: 'fact',
        factKind: 'identity-field',
        path: 'resource.aws_s3_bucket.bucket',
        summary: 'The bucket argument participates in the remote S3 bucket identity.',
        confidence: 'high',
        extractionMethod: 'terraform-registry-markdown',
        source: sourceRef,
        privacyScope: 'public-reference',
        values: ['bucket'],
        type: 'string'
      },
      {
        unitType: 'guidance',
        path: 'guidance.terraform.logical-rename',
        summary: 'Use a Terraform moved block when only the logical resource address changes.',
        confidence: 'high',
        extractionMethod: 'official-guidance',
        source: sourceRef,
        privacyScope: 'public-reference',
        topic: 'terraform-logical-rename',
        appliesWhen: ['resource address changes', 'remote identity remains the same'],
        risk: 'Without a moved block, Terraform can plan replacement instead of state movement.'
      },
      {
        unitType: 'example',
        path: 'example.terraform.moved-block',
        summary: 'Minimal moved block for a Terraform resource rename.',
        confidence: 'medium',
        extractionMethod: 'official-example',
        source: sourceRef,
        privacyScope: 'public-reference',
        exampleType: 'terraform-moved-block',
        language: 'hcl',
        snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
      }
    ]
  };
}

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
        unitArtifacts: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/aws-s3-bucket.units.json',
            name: 'aws-s3-bucket-prebuilt-units',
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
    join(root, 'knowledge/aws-s3-bucket.units.json'),
    `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`,
    'utf8'
  );
}

async function writeUrlArtifactWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifacts: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            url: 'https://knowledge.example.com/public/aws-s3-bucket.units.json',
            name: 'aws-s3-bucket-prebuilt-units-url',
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
}

test('configured prebuilt knowledge unit artifacts are listed as local sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-source-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const source = report.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.domain, 'terraform');
    assert.equal(source.targetPath, 'terraform/app');
    assert.equal(source.source.localPath, 'knowledge/aws-s3-bucket.units.json');
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('configured URL knowledge unit artifacts prefetch then extract through the same unit pipeline', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-url-'));

  try {
    await writeUrlArtifactWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const beforePrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const source = beforePrefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.source.url, 'https://knowledge.example.com/public/aws-s3-bucket.units.json');
    assert.equal(source.requiresFetch, true);
    assert.equal(source.cacheStatus, 'missing');

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      fetcher: async fetchedSource => ({
        source: fetchedSource,
        contentType: 'application/json',
        content: JSON.stringify(unitArtifactPayload()),
        fetchedAt: '2026-05-12T00:00:00.000Z',
        staleAfter: '2026-06-12T00:00:00.000Z'
      })
    });
    const fetched = prefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(fetched?.status, 'fetched');
    assert.equal(fetched?.previousCacheStatus, 'missing');
    assert.equal(fetched?.contentType, 'application/json');

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const unitSet = extraction.unitSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.unitCount, 3);
    assert.equal(unitSet?.unitCount, 3);
    assert.ok(unitSet?.units.every(unit => unit.source.source.url === source.source.url));

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxUnits: 2,
      extractedAt: '2026-05-12T00:00:00.000Z'
    });

    assert.equal(pack.unitCount, 3);
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'terraform-logical-rename'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('prebuilt knowledge unit artifacts extract and pack as compact units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-pack-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const source = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const factSet = extraction.factSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const unitSet = extraction.unitSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const extractionValidation = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.equal(source?.status, 'extracted');
    assert.equal(source?.factCount, 0);
    assert.equal(source?.unitCount, 3);
    assert.equal(factSet?.factCount, 0);
    assert.equal(unitSet?.unitCount, 3);
    assert.equal(unitSet?.source.kind, 'knowledge-unit-artifact');
    assert.ok(unitSet?.units.every(unit => unit.source.id === unitSet.sourceId));
    assert.ok(unitSet?.units.every(unit => unit.source.contentHash === unitSet.sourceContentHash));
    assert.equal(extractionValidation.valid, true);

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxUnits: 2,
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const packValidation = await validateKnowledgePayloadWithLocalSources(pack, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.ok(pack.sources.some(packSource =>
      packSource.kind === 'knowledge-unit-artifact'
      && packSource.factCount === 0
      && packSource.freshness === 'fresh'
    ));
    assert.equal(pack.factCount, 0);
    assert.equal(pack.unitCount, 3);
    assert.equal(pack.includedUnitCount, 2);
    assert.equal(pack.omittedUnitCount, 1);
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'terraform-logical-rename'
      && unit.privacyScope === 'public-reference'
    ));
    assert.equal(packValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
