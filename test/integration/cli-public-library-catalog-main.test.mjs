import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';
import { stagePublicKnowledgeLibraryArtifact } from '../../src/knowledge/public-library-stage.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';
const HELM_KUBE_PROMETHEUS_STACK_URL = 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/';
const REMOTE_PUBLIC_LIBRARY_REGISTRY_URL = 'https://knowledge.example.com/public/public-library-registry.json';
const REMOTE_PUBLIC_LIBRARY_ARTIFACT_URL = 'https://knowledge.example.com/public/artifacts/aws-s3-bucket.public-knowledge-library-artifact.json';

const S3_BUCKET_MARKDOWN = [
  '# aws_s3_bucket',
  '',
  'Provides an S3 bucket resource.',
  '',
  '## Basic Usage',
  '',
  '```hcl',
  'resource "aws_s3_bucket" "example" {',
  '  bucket = "example-bucket"',
  '}',
  '```',
  '',
  '#### Arguments',
  '',
  '- `bucket` - (Optional, Forces new resource) Name of the bucket.',
  '- `force_destroy` - (Optional, Default:false) Delete locked objects when the bucket is destroyed.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means the bucket name conflicts with an existing remote object.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Run terraform plan.',
  '2. Review replacement output before merge.',
  ''
].join('\n');

const HELM_KUBE_PROMETHEUS_STACK_MARKDOWN = [
  '# kube-prometheus-stack',
  '',
  'Installs core components of the kube-prometheus stack.',
  '',
  '## Values',
  '',
  '| Key | Type | Default | Description |',
  '| --- | --- | --- | --- |',
  '| `grafana.enabled` | bool | `true` | Whether to deploy Grafana with the chart. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'grafana:',
  '  enabled: true',
  '```',
  '',
  '## Upgrade Workflow',
  '',
  '1. Render the chart with helm template.',
  '2. Review CRD and ownership changes before merge.',
  '',
  '## Troubleshooting',
  '',
  '`rendered manifests contain a resource that already exists` usually means an object is owned by a different release.',
  ''
].join('\n');

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function withMockFetch(routes, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const route = routes.get(String(url));
    if (!route) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => 'text/plain'
        },
        text: async () => 'not found'
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? route.contentType : null
      },
      text: async () => route.content
    };
  };

  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function buildLibraryArtifact(root, input) {
  const contentPath = join(root, input.contentFile);
  const artifactPath = join(root, input.artifactFile);
  await writeFile(contentPath, input.markdown, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: input.url,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return {
    artifact,
    artifactPath
  };
}

function registryEntryFromArtifact(artifact, location) {
  const artifactContent = JSON.stringify(artifact);
  const { classification } = artifact;

  return {
    coordinates: artifact.coordinates,
    ecosystem: classification.ecosystem,
    artifactKind: classification.artifactKind,
    providerAddress: classification.providerAddress,
    version: classification.version,
    versionRef: classification.versionRef,
    versionResolution: classification.versionResolution,
    sourceName: classification.sourceName,
    ...(classification.resourceToken ? { resourceToken: classification.resourceToken } : {}),
    ...(classification.repository ? { repository: classification.repository } : {}),
    ...(classification.chart ? { chart: classification.chart } : {}),
    tags: classification.tags,
    llmRefinement: {
      status: artifact.llmRefinementInput.status,
      mode: artifact.llmRefinementInput.mode,
      inputRef: 'artifact.llmRefinementInput',
      reviewPacketHash: sha256Hex(JSON.stringify(artifact.llmRefinementInput.reviewPacket)),
      outputContract: artifact.llmRefinementInput.outputContract,
      unitTypes: artifact.llmRefinementInput.unitTypes,
      unitCounts: artifact.summary.unitCounts,
      missingUnitTypes: artifact.llmRefinementInput.reviewPacket.missingUnitTypes,
      qualityStatus: artifact.quality.status,
      qualityScore: artifact.quality.score,
      qualityWarningCount: artifact.quality.warnings.length,
      reviewRequired: true
    },
    artifact: {
      ...location,
      contentHash: sha256Hex(artifactContent),
      mediaType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
      artifactId: artifact.artifactId,
      unitPayloadHash: artifact.unitPayloadHash,
      sourceContentHash: artifact.sourceContentHash,
      unitCount: artifact.summary.unitCount,
      qualityStatus: artifact.quality.status,
      versionRef: classification.versionRef,
      versionResolution: classification.versionResolution,
      reviewRequired: true
    },
    download: {
      mode: artifact.download.mode,
      strategy: artifact.download.strategy,
      usedRole: artifact.download.usedRole,
      fallbackUsed: artifact.download.fallbackUsed
    }
  };
}

test('knowledge library-catalog lists and filters downloadable public registry entries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-catalog-'));

  try {
    await mkdir(join(tempRoot, 'knowledge'), { recursive: true });
    await mkdir(join(tempRoot, 'reports'), { recursive: true });

    const terraformArtifact = await buildLibraryArtifact(tempRoot, {
      url: S3_BUCKET_URL,
      contentFile: 'aws_s3_bucket.md',
      artifactFile: 'aws_s3_bucket.library.json',
      markdown: S3_BUCKET_MARKDOWN
    });
    await stagePublicKnowledgeLibraryArtifact({
      workspaceRoot: tempRoot,
      artifactPath: terraformArtifact.artifactPath,
      storeDir: 'knowledge/public-library',
      registryPath: 'knowledge/public-library-registry.json',
      createdAt: '2026-05-19T00:00:00.000Z'
    });

    const helmArtifact = await buildLibraryArtifact(tempRoot, {
      url: HELM_KUBE_PROMETHEUS_STACK_URL,
      contentFile: 'kube-prometheus-stack.md',
      artifactFile: 'kube-prometheus-stack.library.json',
      markdown: HELM_KUBE_PROMETHEUS_STACK_MARKDOWN
    });
    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8'));
    registry.entries.push(registryEntryFromArtifact(helmArtifact.artifact, {
      url: 'https://knowledge.example.com/public/kube-prometheus-stack.public-knowledge-library-artifact.json'
    }));
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    const catalogOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--json'
    ]));
    const catalog = parseJsonOutput(catalogOutput);

    assert.equal(catalog.kind, 'infra-agent.public-knowledge-library-catalog');
    assert.equal(catalog.mutationAllowed, false);
    assert.equal(catalog.summary.entryCount, 2);
    assert.equal(catalog.summary.matchedEntryCount, 2);
    assert.equal(catalog.summary.downloadableEntryCount, 2);
    assert.equal(catalog.summary.readyEntryCount, 1);
    assert.equal(catalog.summary.needsRefinementEntryCount, 1);
    assert.equal(catalog.summary.ecosystemCounts.terraform, 1);
    assert.equal(catalog.summary.ecosystemCounts.helm, 1);
    assert.equal(catalog.summary.artifactKindCounts['terraform-provider-resource'], 1);
    assert.equal(catalog.summary.artifactKindCounts['helm-chart-docs'], 1);

    const helmEntry = catalog.entries.find(entry => entry.classification.ecosystem === 'helm');
    assert.ok(helmEntry);
    assert.equal(helmEntry.artifact.location.kind, 'url');
    assert.equal(helmEntry.artifactDownload.requiresPrefetch, true);
    assert.equal(helmEntry.classification.chart, 'kube-prometheus-stack');
    assert.equal(helmEntry.quality.status, 'needs-refinement');
    assert.ok(catalog.warnings.some(warning => /LLM refinement/.test(warning)));

    const reportPath = join(tempRoot, 'reports/catalog-filtered.json');
    const filteredOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--domain',
      'terraform',
      '--provider',
      'hashicorp/aws',
      '--resource',
      'aws_s3_bucket',
      '--tag',
      terraformArtifact.artifact.classification.tags[0],
      '--quality',
      'ready',
      '--out',
      reportPath,
      '--json'
    ]));
    const filtered = parseJsonOutput(filteredOutput);

    assert.equal(filtered.summary.entryCount, 2);
    assert.equal(filtered.summary.matchedEntryCount, 1);
    assert.equal(filtered.summary.readyEntryCount, 1);
    assert.equal(filtered.entries[0].coordinates, terraformArtifact.artifact.coordinates);
    assert.equal(filtered.entries[0].classification.providerAddress, 'hashicorp/aws');
    assert.equal(filtered.entries[0].artifact.location.kind, 'workspace-path');
    assert.equal(filtered.entries[0].artifactDownload.requiresPrefetch, false);
    assert.equal(filtered.entries[0].llmRefinement.unitTypeComplete, true);
    assert.equal(filtered.entries[0].llmRefinement.reviewPacketHash, registry.entries[0].llmRefinement.reviewPacketHash);
    assert.equal(filtered.outputPath, reportPath);
    assert.doesNotMatch(filteredOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(filteredOutput, /```hcl/);

    const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(writtenReport.kind, 'infra-agent.public-knowledge-library-catalog');
    assert.equal(writtenReport.entries.length, 1);

    const helmFilteredOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--domain',
      'helm',
      '--chart',
      'kube-prometheus-stack',
      '--json'
    ]));
    const helmFiltered = parseJsonOutput(helmFilteredOutput);

    assert.equal(helmFiltered.summary.matchedEntryCount, 1);
    assert.equal(helmFiltered.entries[0].coordinates, helmArtifact.artifact.coordinates);
    assert.equal(helmFiltered.entries[0].classification.chart, 'kube-prometheus-stack');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-catalog reads URL registries and resolves relative artifact URLs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-catalog-url-'));

  try {
    const terraformArtifact = await buildLibraryArtifact(tempRoot, {
      url: S3_BUCKET_URL,
      contentFile: 'aws_s3_bucket.md',
      artifactFile: 'aws_s3_bucket.library.json',
      markdown: S3_BUCKET_MARKDOWN
    });
    const registry = {
      kind: 'infra-agent.public-knowledge-library-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      entries: [
        registryEntryFromArtifact(terraformArtifact.artifact, {
          path: 'artifacts/aws-s3-bucket.public-knowledge-library-artifact.json'
        })
      ]
    };
    const registryContent = `${JSON.stringify(registry, null, 2)}\n`;

    const output = await withMockFetch(new Map([
      [REMOTE_PUBLIC_LIBRARY_REGISTRY_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-registry+json',
        content: registryContent
      }]
    ]), () => captureStdout(() => main([
      'knowledge',
      'library-catalog',
      REMOTE_PUBLIC_LIBRARY_REGISTRY_URL,
      '--coordinate',
      terraformArtifact.artifact.coordinates,
      '--json'
    ])));
    const catalog = parseJsonOutput(output);

    assert.equal(catalog.registryPath, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    assert.equal(catalog.registry.locationKind, 'url');
    assert.equal(catalog.registry.status, 'downloaded');
    assert.equal(catalog.registry.contentHash, sha256Hex(registryContent));
    assert.equal(catalog.summary.entryCount, 1);
    assert.equal(catalog.summary.matchedEntryCount, 1);
    assert.equal(catalog.entries[0].artifact.location.kind, 'url');
    assert.equal(catalog.entries[0].artifact.location.url, REMOTE_PUBLIC_LIBRARY_ARTIFACT_URL);
    assert.equal(catalog.entries[0].artifactDownload.requiresPrefetch, true);
    assert.doesNotMatch(output, /Provides an S3 bucket resource/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
