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
import { captureStdout } from '../support/capture-stdout.mjs';
import { writeMultiTargetUnitArtifactRegistryWorkspace } from '../support/planner-rag-unit-fixtures.mjs';
import { main } from '../../src/cli/main.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';

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
  const sourceContentHash = 'c'.repeat(64);
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
    unitCount: 2,
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.terraform.logical-rename',
        summary: 'Use a moved block when only the Terraform logical resource name changes.',
        confidence: 'high',
        extractionMethod: 'official-guidance',
        source: sourceRef,
        privacyScope: 'public-reference',
        topic: 'terraform-logical-rename',
        appliesWhen: ['resource address changes', 'remote identity remains the same']
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

function unitArtifactRegistryPayload() {
  return {
    kind: 'infra-agent.knowledge-unit-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    entries: [
      {
        domain: 'terraform',
        targetPath: 'terraform/app',
        artifact: {
          path: 'knowledge/aws-s3-bucket.units.json',
          name: 'aws-s3-bucket-prebuilt-units-from-registry',
          version: '2026-05-12'
        }
      }
    ]
  };
}

async function writeUnitArtifactWorkspace(root) {
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
            name: 'aws-s3-bucket-prebuilt-units'
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

async function writeUnitArtifactRegistryWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            path: 'knowledge/unit-registry.json',
            name: 'prebuilt-unit-registry'
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
    join(root, 'knowledge/unit-registry.json'),
    `${JSON.stringify(unitArtifactRegistryPayload(), null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/aws-s3-bucket.units.json'),
    `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`,
    'utf8'
  );
}

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

test('knowledge CLI handles configured prebuilt unit artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-unit-artifact-'));

  try {
    await writeUnitArtifactWorkspace(tempRoot);
    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const source = sourcesReport.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
    assert.doesNotMatch(sourcesOutput, /moved \{ from = aws_s3_bucket\.old/);

    const extractionOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const extraction = parseJsonOutput(extractionOutput);
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.factCount, 0);
    assert.equal(extractedSource?.unitCount, 2);

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-units',
      '1',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);

    assert.equal(pack.factCount, 0);
    assert.equal(pack.unitCount, 2);
    assert.equal(pack.includedUnitCount, 1);
    assert.equal(pack.omittedUnitCount, 1);
    assert.equal(pack.units[0]?.unitType, 'guidance');
    assert.equal(pack.units[0]?.topic, 'terraform-logical-rename');
    assert.doesNotMatch(packOutput, /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge CLI discovers prebuilt unit artifacts from a configured registry', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-unit-artifact-registry-'));

  try {
    await writeUnitArtifactRegistryWorkspace(tempRoot);
    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const source = sourcesReport.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.source.name, 'aws-s3-bucket-prebuilt-units-from-registry');

    const extractionOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const extraction = parseJsonOutput(extractionOutput);
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.unitCount, 2);

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-units',
      '1',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);

    assert.equal(pack.unitCount, 2);
    assert.equal(pack.includedUnitCount, 1);
    assert.equal(pack.units[0]?.topic, 'terraform-logical-rename');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge CLI scopes registry-backed units to the requested target in a multi-target workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-unit-artifact-registry-scope-'));
  const cases = [
    {
      domain: 'terraform',
      target: 'terraform/app',
      sourceName: 'terraform-app-registry-units',
      expectedPath: 'guidance.terraform.app.logical-rename',
      absentPatterns: [
        /OPS_TERRAFORM_UNIT_SENTINEL/,
        /WORKER_PULUMI_UNIT_SENTINEL/,
        /EDGE_HELM_UNIT_SENTINEL/
      ]
    },
    {
      domain: 'pulumi',
      target: 'infra/api',
      sourceName: 'pulumi-api-registry-units',
      expectedPath: 'guidance.pulumi.api.logical-rename',
      absentPatterns: [
        /OPS_TERRAFORM_UNIT_SENTINEL/,
        /WORKER_PULUMI_UNIT_SENTINEL/,
        /EDGE_HELM_UNIT_SENTINEL/
      ]
    },
    {
      domain: 'helm',
      target: 'charts/monitoring',
      sourceName: 'helm-monitoring-registry-units',
      expectedPath: 'guidance.helm.monitoring.values-migration',
      absentPatterns: [
        /OPS_TERRAFORM_UNIT_SENTINEL/,
        /WORKER_PULUMI_UNIT_SENTINEL/,
        /EDGE_HELM_UNIT_SENTINEL/
      ]
    }
  ];

  try {
    await writeMultiTargetUnitArtifactRegistryWorkspace(tempRoot);

    for (const entry of cases) {
      const sourcesOutput = await captureStdout(() => main([
        'knowledge',
        'sources',
        tempRoot,
        '--domain',
        entry.domain,
        '--target',
        entry.target,
        '--json'
      ]));
      const sourcesReport = parseJsonOutput(sourcesOutput);
      const artifactSources = sourcesReport.sources.filter(source =>
        source.source.kind === 'knowledge-unit-artifact'
      );

      assert.equal(artifactSources.length, 1);
      assert.equal(artifactSources[0]?.domain, entry.domain);
      assert.equal(artifactSources[0]?.targetPath, entry.target);
      assert.equal(artifactSources[0]?.source.name, entry.sourceName);

      const extractionOutput = await captureStdout(() => main([
        'knowledge',
        'extract',
        tempRoot,
        '--domain',
        entry.domain,
        '--target',
        entry.target,
        '--json'
      ]));
      const extraction = parseJsonOutput(extractionOutput);
      const unitSet = extraction.unitSets.find(source =>
        source.source.kind === 'knowledge-unit-artifact'
      );

      assert.equal(unitSet?.source.name, entry.sourceName);
      assert.equal(unitSet?.unitCount, 5);
      assert.deepEqual(
        [...new Set(unitSet?.units.map(unit => unit.unitType))].sort(),
        ['diagnostic', 'example', 'fact', 'guidance', 'recipe']
      );
      assert.ok(unitSet?.units.some(unit => unit.path === entry.expectedPath));

      const packOutput = await captureStdout(() => main([
        'knowledge',
        'pack',
        tempRoot,
        '--domain',
        entry.domain,
        '--target',
        entry.target,
        '--max-units',
        '8',
        '--json'
      ]));
      const pack = parseJsonOutput(packOutput);
      const sourceIds = new Set(pack.sources
        .filter(source => source.kind === 'knowledge-unit-artifact' && source.name === entry.sourceName)
        .map(source => source.id));
      const packedArtifactUnits = pack.units.filter(unit => sourceIds.has(unit.sourceId));

      assert.deepEqual(pack.requestedDomains, [entry.domain]);
      assert.deepEqual(pack.targetPaths, [entry.target]);
      assert.ok(packedArtifactUnits.some(unit => unit.path === entry.expectedPath));
      assert.ok(packedArtifactUnits.length > 0);

      for (const pattern of entry.absentPatterns) {
        assert.doesNotMatch(sourcesOutput, pattern);
        assert.doesNotMatch(extractionOutput, pattern);
        assert.doesNotMatch(packOutput, pattern);
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
