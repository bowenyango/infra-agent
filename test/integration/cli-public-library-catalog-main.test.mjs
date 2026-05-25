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

function catalogFacetValue(catalog, field, value) {
  return catalog.facets.fields[field].values.find(entry => entry.value === value);
}

function assertCatalogOmitsRawContent(catalog) {
  const serialized = JSON.stringify(catalog);
  assert.doesNotMatch(serialized, /Provides an S3 bucket resource/);
  assert.doesNotMatch(serialized, /```hcl/);
  assert.doesNotMatch(serialized, /unitsByType/);
  assert.doesNotMatch(serialized, /"llmRefinementInput":/);
  assert.doesNotMatch(serialized, /"reviewPacket":/);
}

async function withMockFetch(routes, action) {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async url => {
    requestedUrls.push(String(url));
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
    return await action(requestedUrls);
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
    assert.equal(catalog.summary.returnedEntryCount, 2);
    assert.equal(catalog.summary.omittedEntryCount, 0);
    assert.equal(catalog.summary.downloadableEntryCount, 2);
    assert.equal(catalog.summary.readyEntryCount, 1);
    assert.equal(catalog.summary.needsRefinementEntryCount, 1);
    assert.equal(catalog.summary.ecosystemCounts.terraform, 1);
    assert.equal(catalog.summary.ecosystemCounts.helm, 1);
    assert.equal(catalog.summary.artifactKindCounts['terraform-provider-resource'], 1);
    assert.equal(catalog.summary.artifactKindCounts['helm-chart-docs'], 1);
    assert.equal(catalog.facets, undefined);
    assertCatalogOmitsRawContent(catalog);

    const terraformEntry = catalog.entries.find(entry => entry.classification.ecosystem === 'terraform');
    assert.ok(terraformEntry);
    assert.equal(terraformEntry.artifact.location.kind, 'workspace-path');
    assert.equal(terraformEntry.artifactDownload.requiresPrefetch, false);
    assert.equal(terraformEntry.downloadGuidance.mode, 'coordinate');
    assert.equal(terraformEntry.downloadGuidance.command.registryArgument, registryPath);
    assert.equal(terraformEntry.downloadGuidance.command.coordinateArgument, terraformArtifact.artifact.coordinates);
    assert.deepEqual(terraformEntry.downloadGuidance.command.requiredUserArguments, ['--workspace']);
    assert.equal(terraformEntry.downloadGuidance.command.recommendedStoreDir, 'knowledge/downloaded-public-library');
    assert.deepEqual(terraformEntry.downloadGuidance.command.argv, [
      'infra-agent',
      'knowledge',
      'library-download',
      registryPath,
      '--coordinate',
      terraformArtifact.artifact.coordinates,
      '--workspace',
      '<workspace>',
      '--store-dir',
      'knowledge/downloaded-public-library',
      '--json'
    ]);
    assert.ok(terraformEntry.downloadGuidance.command.optionalArguments.includes('--review-out <review.json>'));
    assert.equal(terraformEntry.downloadGuidance.artifactFetch.catalogStatus, 'not-attempted');
    assert.equal(terraformEntry.downloadGuidance.artifactFetch.downloadWillFetchArtifact, false);
    assert.equal(terraformEntry.downloadGuidance.artifactFetch.locationKind, 'workspace-path');
    assert.equal(terraformEntry.downloadGuidance.verification.performedBy, 'knowledge library-download');
    assert.ok(terraformEntry.downloadGuidance.verification.checks.includes('artifact-content-hash'));
    assert.equal(terraformEntry.downloadGuidance.postDownload.reviewOutSupported, true);

    const helmEntry = catalog.entries.find(entry => entry.classification.ecosystem === 'helm');
    assert.ok(helmEntry);
    assert.equal(helmEntry.artifact.location.kind, 'url');
    assert.equal(helmEntry.artifactDownload.requiresPrefetch, true);
    assert.equal(helmEntry.downloadGuidance.artifactFetch.downloadWillFetchArtifact, true);
    assert.equal(helmEntry.downloadGuidance.artifactFetch.locationKind, 'url');
    assert.equal(helmEntry.classification.chart, 'kube-prometheus-stack');
    assert.equal(helmEntry.quality.status, 'needs-refinement');
    assert.ok(catalog.warnings.some(warning => /LLM refinement/.test(warning)));

    const facetedOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--facets',
      '--json'
    ]));
    const faceted = parseJsonOutput(facetedOutput);

    assert.equal(faceted.facets.scope, 'matched-before-limit');
    assert.equal(faceted.facets.matchedEntryCount, 2);
    assert.equal(faceted.facets.limit, 10);
    assert.deepEqual(faceted.facets.fields.ecosystem.values, [
      { value: 'helm', count: 1 },
      { value: 'terraform', count: 1 }
    ]);
    assert.equal(catalogFacetValue(faceted, 'artifactKind', 'terraform-provider-resource').count, 1);
    assert.equal(catalogFacetValue(faceted, 'artifactKind', 'helm-chart-docs').count, 1);
    assert.equal(catalogFacetValue(faceted, 'providerAddress', 'hashicorp/aws').count, 1);
    assert.equal(catalogFacetValue(faceted, 'providerAddress', 'prometheus-community/kube-prometheus-stack').count, 1);
    assert.equal(catalogFacetValue(faceted, 'chart', 'kube-prometheus-stack').count, 1);
    assert.equal(catalogFacetValue(faceted, 'tags', 'public-reference').count, 2);
    assert.equal(catalogFacetValue(faceted, 'qualityStatus', 'ready').count, 1);
    assert.equal(catalogFacetValue(faceted, 'qualityStatus', 'needs-refinement').count, 1);
    assert.equal(faceted.facets.fields.resourceToken.totalValueCount, 0);
    assert.doesNotMatch(facetedOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(facetedOutput, /```hcl/);

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
    assert.equal(filtered.summary.returnedEntryCount, 1);
    assert.equal(filtered.summary.omittedEntryCount, 0);
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

    const searchedOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--search',
      'aws s3 bucket',
      '--json'
    ]));
    const searched = parseJsonOutput(searchedOutput);

    assert.equal(searched.search.query, 'aws s3 bucket');
    assert.deepEqual(searched.search.terms, ['aws', 's3', 'bucket']);
    assert.ok(searched.search.searchableFields.includes('coordinates'));
    assert.ok(searched.search.searchableFields.includes('tags'));
    assert.equal(searched.search.matchedCount, 1);
    assert.equal(searched.summary.matchedEntryCount, 1);
    assert.equal(searched.summary.returnedEntryCount, 1);
    assert.equal(searched.summary.omittedEntryCount, 0);
    assert.equal(searched.entries[0].coordinates, terraformArtifact.artifact.coordinates);
    assert.equal(searched.entries[0].searchMatch.rank, 1);
    assert.equal(searched.entries[0].searchMatch.matchedTerms.join(','), 'aws,s3,bucket');
    assert.ok(searched.entries[0].searchMatch.score > 0);
    assert.ok(searched.entries[0].searchMatch.matchedFields.includes('sourceName'));
    assert.doesNotMatch(searchedOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(searchedOutput, /```hcl/);

    const limitedSearchOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--query',
      'public-reference',
      '--limit',
      '1',
      '--facets',
      '--facet-limit',
      '1',
      '--json'
    ]));
    const limitedSearch = parseJsonOutput(limitedSearchOutput);

    assert.equal(limitedSearch.search.query, 'public-reference');
    assert.deepEqual(limitedSearch.search.terms, ['public-reference']);
    assert.equal(limitedSearch.search.matchedCount, 2);
    assert.equal(limitedSearch.limit.requested, 1);
    assert.equal(limitedSearch.limit.matchedEntryCount, 2);
    assert.equal(limitedSearch.limit.returnedEntryCount, 1);
    assert.equal(limitedSearch.limit.omittedEntryCount, 1);
    assert.equal(limitedSearch.summary.entryCount, 2);
    assert.equal(limitedSearch.summary.matchedEntryCount, 2);
    assert.equal(limitedSearch.summary.returnedEntryCount, 1);
    assert.equal(limitedSearch.summary.omittedEntryCount, 1);
    assert.equal(limitedSearch.summary.downloadableEntryCount, 2);
    assert.equal(limitedSearch.summary.readyEntryCount, 1);
    assert.equal(limitedSearch.summary.needsRefinementEntryCount, 1);
    assert.equal(limitedSearch.summary.ecosystemCounts.terraform, 1);
    assert.equal(limitedSearch.summary.ecosystemCounts.helm, 1);
    assert.ok(limitedSearch.warnings.some(warning => /LLM refinement/.test(warning)));
    assert.equal(limitedSearch.entries.length, 1);
    assert.equal(limitedSearch.entries[0].searchMatch.rank, 1);
    assert.ok(limitedSearch.entries[0].searchMatch.matchedFields.includes('tags'));
    assert.equal(limitedSearch.facets.scope, 'matched-before-limit');
    assert.equal(limitedSearch.facets.matchedEntryCount, 2);
    assert.equal(limitedSearch.facets.limit, 1);
    assert.deepEqual(limitedSearch.facets.fields.ecosystem.values, [
      { value: 'helm', count: 1 }
    ]);
    assert.equal(limitedSearch.facets.fields.ecosystem.omittedValueCount, 1);
    assert.deepEqual(limitedSearch.facets.fields.tags.values, [
      { value: 'public-reference', count: 2 }
    ]);
    assert.ok(limitedSearch.facets.fields.tags.omittedValueCount > 0);

    const remoteRegistryContent = await readFile(registryPath, 'utf8');
    let remoteRequestedUrls = [];
    const remoteCatalogOutput = await withMockFetch(new Map([
      [REMOTE_PUBLIC_LIBRARY_REGISTRY_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-registry+json',
        content: remoteRegistryContent
      }]
    ]), requestedUrls => {
      remoteRequestedUrls = requestedUrls;
      return captureStdout(() => main([
        'knowledge',
        'library-catalog',
        REMOTE_PUBLIC_LIBRARY_REGISTRY_URL,
        '--query',
        'kube prometheus',
        '--facets',
        '--json'
      ]));
    });
    const remoteCatalog = parseJsonOutput(remoteCatalogOutput);

    assert.deepEqual(remoteRequestedUrls, [REMOTE_PUBLIC_LIBRARY_REGISTRY_URL]);
    assert.equal(remoteCatalog.registry.locationKind, 'url');
    assert.equal(remoteCatalog.search.matchedCount, 1);
    assert.equal(remoteCatalog.entries[0].coordinates, helmArtifact.artifact.coordinates);
    assert.equal(remoteCatalog.entries[0].artifact.location.kind, 'url');
    assert.equal(remoteCatalog.entries[0].artifactDownload.requiresPrefetch, true);
    assert.equal(remoteCatalog.entries[0].downloadGuidance.command.registryArgument, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    assert.equal(remoteCatalog.entries[0].downloadGuidance.command.coordinateArgument, helmArtifact.artifact.coordinates);
    assert.equal(remoteCatalog.entries[0].downloadGuidance.artifactFetch.catalogStatus, 'not-attempted');
    assert.equal(remoteCatalog.entries[0].downloadGuidance.artifactFetch.downloadWillFetchArtifact, true);
    assert.equal(remoteCatalog.facets.matchedEntryCount, 1);
    assert.equal(catalogFacetValue(remoteCatalog, 'chart', 'kube-prometheus-stack').count, 1);
    assertCatalogOmitsRawContent(remoteCatalog);

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
    assert.equal(helmFiltered.summary.returnedEntryCount, 1);
    assert.equal(helmFiltered.summary.omittedEntryCount, 0);
    assert.equal(helmFiltered.entries[0].coordinates, helmArtifact.artifact.coordinates);
    assert.equal(helmFiltered.entries[0].classification.chart, 'kube-prometheus-stack');

    const limitedOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--limit',
      '1',
      '--json'
    ]));
    const limited = parseJsonOutput(limitedOutput);

    assert.equal(limited.search, undefined);
    assert.equal(limited.limit.requested, 1);
    assert.equal(limited.limit.matchedEntryCount, 2);
    assert.equal(limited.limit.returnedEntryCount, 1);
    assert.equal(limited.limit.omittedEntryCount, 1);
    assert.equal(limited.summary.matchedEntryCount, 2);
    assert.equal(limited.summary.returnedEntryCount, 1);
    assert.equal(limited.summary.omittedEntryCount, 1);
    assert.equal(limited.summary.readyEntryCount, 1);
    assert.equal(limited.summary.needsRefinementEntryCount, 1);
    assert.equal(limited.entries.length, 1);
    assert.equal(limited.entries[0].searchMatch, undefined);
    assert.equal(limited.entries[0].downloadGuidance.command.coordinateArgument, limited.entries[0].coordinates);

    const textOutput = await captureStdout(() => main([
      'knowledge',
      'library-catalog',
      registryPath,
      '--query',
      'aws_s3_bucket',
      '--facets'
    ]));

    assert.match(textOutput, /query: aws_s3_bucket terms=aws_s3_bucket matched=1/);
    assert.match(textOutput, /entries: returned=1 matched=1 total=2 omitted=0/);
    assert.match(textOutput, /facets scope: matched-before-limit matched=1 limit=10/);
    assert.match(textOutput, /facet ecosystem: terraform=1 omitted=0/);
    assert.match(textOutput, /rank=1/);
    assert.match(textOutput, /matchScore=\d+/);
    assert.match(textOutput, /matchFields=/);
    assert.match(textOutput, /matchTerms=aws_s3_bucket/);
    assert.match(textOutput, /downloadArgv=infra-agent knowledge library-download .* --coordinate .* --workspace <workspace> --store-dir knowledge\/downloaded-public-library --json/);
    assert.doesNotMatch(textOutput, /Provides an S3 bucket resource/);
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

    let requestedUrls = [];
    const output = await withMockFetch(new Map([
      [REMOTE_PUBLIC_LIBRARY_REGISTRY_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-registry+json',
        content: registryContent
      }]
    ]), urls => {
      requestedUrls = urls;
      return captureStdout(() => main([
        'knowledge',
        'library-catalog',
        REMOTE_PUBLIC_LIBRARY_REGISTRY_URL,
        '--coordinate',
        terraformArtifact.artifact.coordinates,
        '--facets',
        '--json'
      ]));
    });
    const catalog = parseJsonOutput(output);

    assert.deepEqual(requestedUrls, [REMOTE_PUBLIC_LIBRARY_REGISTRY_URL]);
    assert.equal(catalog.registryPath, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    assert.equal(catalog.registry.locationKind, 'url');
    assert.equal(catalog.registry.status, 'downloaded');
    assert.equal(catalog.registry.contentHash, sha256Hex(registryContent));
    assert.equal(catalog.summary.entryCount, 1);
    assert.equal(catalog.summary.matchedEntryCount, 1);
    assert.equal(catalog.summary.returnedEntryCount, 1);
    assert.equal(catalog.summary.omittedEntryCount, 0);
    assert.equal(catalog.entries[0].artifact.location.kind, 'url');
    assert.equal(catalog.entries[0].artifact.location.url, REMOTE_PUBLIC_LIBRARY_ARTIFACT_URL);
    assert.equal(catalog.entries[0].artifactDownload.requiresPrefetch, true);
    assert.equal(catalog.entries[0].downloadGuidance.command.registryArgument, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    assert.equal(catalog.entries[0].downloadGuidance.command.coordinateArgument, terraformArtifact.artifact.coordinates);
    assert.equal(catalog.entries[0].downloadGuidance.artifactFetch.catalogStatus, 'not-attempted');
    assert.equal(catalog.entries[0].downloadGuidance.artifactFetch.downloadWillFetchArtifact, true);
    assert.equal(catalog.entries[0].downloadGuidance.artifactFetch.locationKind, 'url');
    assert.equal(catalog.facets.matchedEntryCount, 1);
    assert.equal(catalogFacetValue(catalog, 'providerAddress', 'hashicorp/aws').count, 1);
    assertCatalogOmitsRawContent(catalog);
    assert.doesNotMatch(output, /Provides an S3 bucket resource/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
