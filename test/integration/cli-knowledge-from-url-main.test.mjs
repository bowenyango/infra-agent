import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';
const S3_BUCKET_DATA_SOURCE_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/s3_bucket';
const PULUMI_AWS_BUCKET_URL = 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/';
const HELM_KUBE_PROMETHEUS_STACK_URL = 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/';

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
  '- `force_destroy` - (Optional, Default:false) Delete [locked objects](https://example.invalid/object-lock) when the bucket is destroyed.',
  '- `tags` - (Optional) Map of tags to assign to the bucket.',
  '',
  '## Attribute Reference',
  '',
  '- `arn` - ARN of the bucket.',
  '',
  '## Best Practices',
  '',
  'Review Terraform plan output before changing bucket identity fields.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Change non-identity arguments first.',
  '2. Run terraform plan.',
  '3. Review replacement output before merge.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means the bucket name conflicts with an existing remote object.',
  '',
  '- Check whether this is a logical rename or a new physical bucket.',
  '- Consider import or moved-block review before replacing the bucket.',
  ''
].join('\n');

const S3_BUCKET_DATA_SOURCE_MARKDOWN = [
  '# aws_s3_bucket',
  '',
  'Provides information about an S3 bucket.',
  '',
  '## Example Usage',
  '',
  '```hcl',
  'data "aws_s3_bucket" "selected" {',
  '  bucket = "example-bucket"',
  '}',
  '```',
  '',
  '## Argument Reference',
  '',
  '- `bucket` - (Required) Name of the bucket.',
  '',
  '## Attribute Reference',
  '',
  '- `arn` - ARN of the bucket.',
  ''
].join('\n');

const S3_BUCKET_INLINE_MARKDOWN = S3_BUCKET_MARKDOWN
  .replace(/\n+/g, ' ')
  .replace(/- `bucket`/g, '* `bucket`')
  .replace(/- `tags`/g, '* `tags`')
  .replace(/- `arn`/g, '* `arn`');

const PULUMI_AWS_BUCKET_MARKDOWN = [
  '# Bucket',
  '',
  '## Inputs',
  '',
  '| Name | Type | Description |',
  '| --- | --- | --- |',
  '| `bucket` | string | Name of the bucket to create. |',
  '',
  '## Example Usage',
  '',
  '```typescript',
  'const bucket = new aws.s3.Bucket("site", {',
  '  bucket: "site-bucket",',
  '});',
  '```',
  '',
  '## Compatibility Warnings',
  '',
  'Bucket names are globally unique and incompatible replacements should be reviewed before changing identity fields.',
  '',
  '## Migration Workflow',
  '',
  '1. Confirm whether the bucket name is changing or only the Pulumi logical name is changing.',
  '2. Add aliases or import/state review when preserving the physical bucket.',
  '3. Run pulumi preview and inspect replacements.',
  '',
  '## Importing resources',
  '',
  '1. Review the existing cloud resource and matching Pulumi type.',
  '2. Run pulumi import with the provider ID before previewing updates.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means another stack or account owns the requested bucket name.',
  '',
  '- Confirm the owning account and region.',
  '- Use import or aliases when preserving an existing bucket.',
  ''
].join('\n');

const HELM_KUBE_PROMETHEUS_STACK_MARKDOWN = [
  '# kube-prometheus-stack',
  '',
  'Installs core components of the kube-prometheus stack with Prometheus Operator, Grafana dashboards, and Prometheus rules.',
  '',
  '## Values',
  '',
  '| Key | Type | Default | Description |',
  '| --- | --- | --- | --- |',
  '| `grafana.enabled` | bool | `true` | Whether to deploy Grafana with the chart. |',
  '| `prometheus.prometheusSpec.retention` | string | `10d` | Retention period for Prometheus data. |',
  '| `alertmanager.enabled` | bool | `true` | Whether to deploy Alertmanager with the stack. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'grafana:',
  '  enabled: true',
  'prometheus:',
  '  prometheusSpec:',
  '    retention: 10d',
  '```',
  '',
  '## Compatibility Warnings',
  '',
  'CRDs must be reviewed during chart upgrades because Kubernetes ownership and Prometheus Operator API compatibility can affect rendered manifests.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Render the chart with helm template and the selected values files.',
  '2. Review CRD and ownership changes before merge.',
  '3. Run helm diff or the repository validator before applying changes.',
  '',
  '## Troubleshooting',
  '',
  '`rendered manifests contain a resource that already exists` usually means a Kubernetes object is owned by a different release or namespace.',
  '',
  '- Review Helm ownership annotations on the existing object.',
  '- Confirm the release name and destination namespace before changing values.',
  ''
].join('\n');

test('knowledge from-url emits five compact unit types from a Terraform Registry resource URL', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-from-url-'));

  try {
    const contentPath = join(tempRoot, 'aws_s3_bucket.md');
    const outputPath = join(tempRoot, 'aws_s3_bucket.knowledge.json');
    const libraryOutputPath = join(tempRoot, 'aws_s3_bucket.library.json');
    await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'from-url',
      S3_BUCKET_URL,
      '--content',
      contentPath,
      '--max-units',
      '20',
      '--out',
      outputPath,
      '--library-out',
      libraryOutputPath,
      '--json'
    ])));
    const writtenReport = JSON.parse(await readFile(outputPath, 'utf8'));
    const libraryArtifact = JSON.parse(await readFile(libraryOutputPath, 'utf8'));
    const serialized = JSON.stringify(report);

    assert.equal(report.kind, 'infra-agent.public-knowledge-url-report');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.domain, 'terraform');
    assert.equal(report.source.kind, 'terraform-registry');
    assert.equal(report.source.name, 'resource:aws_s3_bucket');
    assert.equal(report.source.provider, 'hashicorp/aws');
    assert.equal(report.source.version, 'latest');
    assert.equal(report.sourceUrl, S3_BUCKET_URL);
    assert.equal(report.summary.unitTypeComplete, true);
    assert.equal(report.summary.qualityStatus, 'ready');
    assert.equal(report.summary.qualityScore, 100);
    assert.deepEqual(report.summary.qualityWarnings, []);
    assert.equal(report.quality.llmUsed, false);
    assert.equal(report.quality.refinementMode, 'deterministic');
    assert.equal(report.download.mode, 'local-content');
    assert.equal(report.download.strategy, 'local-content-fixture');
    assert.equal(report.download.attemptedCount, 0);
    assert.equal(report.download.fallbackUsed, false);
    assert.equal(report.download.usedRole, 'local-content');
    assert.equal(report.download.usedContentType, 'text/markdown');
    assert.equal(report.sourceOutline.contentType, 'text/markdown');
    assert.equal(report.sourceOutline.headingCount, 7);
    assert.equal(report.sourceOutline.omittedHeadingCount, 0);
    assert.deepEqual(report.sourceOutline.signals, [
      'argument-reference',
      'attribute-reference',
      'example-usage'
    ]);
    assert.deepEqual(report.sourceOutline.headings.slice(0, 3), [
      { level: 1, title: 'aws_s3_bucket' },
      { level: 2, title: 'Basic Usage' },
      { level: 4, title: 'Arguments' }
    ]);
    assert.deepEqual(report.summary.includedUnitTypes, ['fact', 'guidance', 'example', 'diagnostic', 'recipe']);
    assert.deepEqual(report.summary.missingUnitTypes, []);
    assert.ok(report.summary.unitCounts.fact > 0);
    assert.ok(report.summary.unitCounts.guidance > 0);
    assert.ok(report.summary.unitCounts.example > 0);
    assert.ok(report.summary.unitCounts.diagnostic > 0);
    assert.ok(report.summary.unitCounts.recipe > 0);
    assert.ok(report.unitsByType.fact.some(unit =>
      unit.path === 'resource.aws_s3_bucket.bucket'
      && unit.factKind === 'argument'
    ));
    assert.ok(report.unitsByType.guidance.some(unit =>
      unit.topic === 'replacement-sensitive-field'
      || unit.topic === 'provider-identity-field'
    ));
    assert.ok(report.unitsByType.example.some(unit =>
      unit.exampleType === 'terraform-resource-snippet'
      && unit.language === 'hcl'
    ));
    assert.ok(report.unitsByType.diagnostic.some(unit =>
      unit.engine === 'provider'
      && /resource\.aws_s3_bucket\.bucket/.test(unit.signature)
    ));
    assert.ok(report.unitsByType.recipe.some(unit =>
      unit.name === 'Plan Terraform identity-sensitive edits'
      && unit.mutationAllowed === false
    ));
    assert.equal(report.unitsByType.recipe.some(unit => unit.path.startsWith('recipe.markdown.')), false);
    assert.equal(report.unitsByType.fact.some(unit => unit.factKind === 'example'), false);
    assert.ok(Object.values(report.unitsByType).flat().every(unit =>
      !Object.hasOwn(unit, 'source')
      && typeof unit.sourceId === 'string'
      && typeof unit.sourceLocator === 'string'
    ));
    assert.doesNotMatch(JSON.stringify(report.unitsByType), /\]\(https?:\/\//);
    assert.equal(report.centralLibraryCandidate.kind, 'infra-agent.central-knowledge-candidate');
    assert.equal(report.centralLibraryCandidate.storageScope, 'public-reference');
    assert.equal(report.centralLibraryCandidate.privacyScope, 'public-reference');
    assert.equal(report.centralLibraryCandidate.quality.status, 'ready');
    assert.equal(report.centralLibraryCandidate.source.name, 'resource:aws_s3_bucket');
    assert.equal(report.centralLibraryCandidate.unitRef, 'report.unitsByType');
    assert.deepEqual(report.centralLibraryCandidate.unitCounts, report.summary.unitCounts);
    assert.equal(
      report.centralLibraryCandidate.classification.coordinates,
      'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket'
    );
    assert.equal(report.centralLibraryCandidate.classification.artifactKind, 'terraform-provider-resource');
    assert.deepEqual(report.centralLibraryCandidate.classification.versionRef, {
      value: 'latest',
      kind: 'floating-alias',
      mutable: true,
      source: 'url-path'
    });
    assert.deepEqual(report.centralLibraryCandidate.classification.versionResolution, {
      requestedVersion: 'latest',
      status: 'unavailable',
      mutable: true,
      source: 'not-attempted-local-content',
      url: 'https://registry.terraform.io/v1/providers/hashicorp/aws/versions',
      reason: 'content-fixture-no-network'
    });
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('aws_s3_bucket'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('floating-alias'));
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.status, 'not-run');
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.inputRefs.includes('report.unitsByType'));
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.inputRefs.includes('report.sourceOutline'));
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.inputRefs.includes('report.summary'));
    assert.equal(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.coordinates,
      report.centralLibraryCandidate.classification.coordinates
    );
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.version, 'latest');
    assert.deepEqual(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef,
      report.centralLibraryCandidate.classification.versionRef
    );
    assert.deepEqual(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionResolution,
      report.centralLibraryCandidate.classification.versionResolution
    );
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceContentHash, report.sourceContentHash);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, report.download.strategy);
    assert.match(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.traceHash, /^[a-f0-9]{64}$/);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.attemptedCount, 0);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, null);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedRole, 'local-content');
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedContentType, 'text/markdown');
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.fallbackUsed, false);
    assert.deepEqual(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.attemptedRoles, []);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.rejectedAttemptCount, 0);
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.failedAttemptCount, 0);
    assert.deepEqual(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceOutline, report.sourceOutline);
    assert.equal(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.pathSamples[0],
      'resource.aws_s3_bucket.bucket'
    );
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.omittedPathCount > 0, true);
    assert.ok(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.signals.argumentCount > 0
    );
    assert.ok(
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.signals.replacementCount > 0
    );
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitCount, report.summary.includedUnitCount);
    assert.deepEqual(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitCounts, report.summary.unitCounts);
    assert.deepEqual(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.missingUnitTypes, report.summary.missingUnitTypes);
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.reviewChecklist.some(check =>
      /download trace/.test(check)
    ));
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.rejectionCriteria.some(criterion =>
      /raw documentation/.test(criterion)
    ));
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.constraints.some(constraint =>
      /Do not invent provider fields/.test(constraint)
    ));
    assert.equal(writtenReport.kind, report.kind);
    assert.equal(writtenReport.sourceContentHash, report.sourceContentHash);
    assert.equal(report.libraryOutputPath, libraryOutputPath);
    assert.equal(libraryArtifact.kind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(libraryArtifact.mutationAllowed, false);
    assert.equal(libraryArtifact.storageScope, 'public-reference');
    assert.equal(libraryArtifact.privacyScope, 'public-reference');
    assert.equal(libraryArtifact.artifactId, report.centralLibraryCandidate.candidateId);
    assert.equal(libraryArtifact.coordinates, report.centralLibraryCandidate.classification.coordinates);
    assert.deepEqual(libraryArtifact.classification.versionRef, report.centralLibraryCandidate.classification.versionRef);
    assert.deepEqual(libraryArtifact.classification.versionResolution, report.centralLibraryCandidate.classification.versionResolution);
    assert.equal(libraryArtifact.sourceContentHash, report.sourceContentHash);
    assert.equal(libraryArtifact.summary.unitCount, report.summary.includedUnitCount);
    assert.deepEqual(libraryArtifact.summary.unitCounts, report.summary.unitCounts);
    assert.deepEqual(libraryArtifact.unitsByType, report.unitsByType);
    assert.equal(libraryArtifact.download.mode, 'local-content');
    assert.deepEqual(libraryArtifact.sourceOutline, report.sourceOutline);
    assert.equal(libraryArtifact.llmRefinementInput.status, 'not-run');
    assert.equal(libraryArtifact.llmRefinementInput.reviewPacket.coordinates, libraryArtifact.coordinates);
    assert.deepEqual(libraryArtifact.llmRefinementInput.reviewPacket.sourceOutline, report.sourceOutline);
    assert.deepEqual(
      libraryArtifact.llmRefinementInput.reviewPacket.unitDigest,
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest
    );
    assert.deepEqual(
      libraryArtifact.llmRefinementInput.reviewPacket.downloadEvidence,
      report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence
    );
    assert.equal(libraryArtifact.llmRefinementInput.reviewPacket.unitCount, libraryArtifact.summary.unitCount);
    assert.equal(libraryArtifact.publication.downloadable, true);
    assert.equal(libraryArtifact.publication.uploadRequired, false);
    assert.equal(typeof libraryArtifact.unitPayloadHash, 'string');
    assert.equal(libraryArtifact.unitPayloadHash.length, 64);
    assert.doesNotMatch(JSON.stringify(libraryArtifact), /"content"\s*:|"rawContent"\s*:|example-bucket-password|authorization|bearer/);
    const reportValidation = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ])));
    assert.equal(reportValidation.inputKind, 'infra-agent.public-knowledge-url-report');
    assert.equal(reportValidation.valid, true);
    assert.equal(reportValidation.unitCount, report.summary.includedUnitCount);
    assert.equal(reportValidation.factCount, report.summary.unitCounts.fact);
    const validation = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'validate',
      libraryOutputPath,
      '--json'
    ])));
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(validation.valid, true);
    assert.equal(validation.unitCount, report.summary.includedUnitCount);
    assert.equal(validation.factCount, report.summary.unitCounts.fact);
    assert.equal(Object.hasOwn(writtenReport, 'unitSet'), false);
    assert.doesNotMatch(serialized, /"content"\s*:|"rawContent"\s*:|example-bucket-password|authorization|bearer/);
    assert.ok(Buffer.byteLength(serialized) < 16000);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge from-url classifies Terraform Registry data source URLs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-from-url-data-source-'));

  try {
    const contentPath = join(tempRoot, 'aws_s3_bucket_data_source.md');
    await writeFile(contentPath, S3_BUCKET_DATA_SOURCE_MARKDOWN, 'utf8');

    const report = await buildPublicKnowledgeUrlReport({
      url: S3_BUCKET_DATA_SOURCE_URL,
      contentPath,
      maxUnits: 20
    });
    const artifact = buildPublicKnowledgeLibraryArtifact(report);
    const validation = validateKnowledgePayload(artifact, 'inline');

    assert.equal(report.source.name, 'data-source:aws_s3_bucket');
    assert.equal(report.centralLibraryCandidate.classification.artifactKind, 'terraform-provider-data-source');
    assert.equal(
      report.centralLibraryCandidate.classification.coordinates,
      'terraform/provider/hashicorp/aws/latest/data-source/aws_s3_bucket'
    );
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('data-source'));
    assert.ok(report.unitsByType.fact.some(unit =>
      unit.path === 'data.aws_s3_bucket.bucket'
      && unit.factKind === 'argument'
    ));
    assert.equal(report.summary.unitTypeComplete, true);
    assert.equal(artifact.classification.artifactKind, 'terraform-provider-data-source');
    assert.equal(validation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge from-url emits Pulumi Registry resource URL public-library context', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-from-url-pulumi-'));

  try {
    const contentPath = join(tempRoot, 'pulumi_aws_bucket.md');
    await writeFile(contentPath, PULUMI_AWS_BUCKET_MARKDOWN, 'utf8');

    const report = await buildPublicKnowledgeUrlReport({
      url: PULUMI_AWS_BUCKET_URL,
      contentPath,
      maxUnits: 20
    });
    const artifact = buildPublicKnowledgeLibraryArtifact(report);
    const reportValidation = validateKnowledgePayload(report, 'inline');
    const artifactValidation = validateKnowledgePayload(artifact, 'inline');

    assert.equal(report.domain, 'pulumi');
    assert.equal(report.source.kind, 'pulumi-docs');
    assert.equal(report.source.name, 'pulumi-docs:resource:aws:s3/bucket');
    assert.equal(report.source.packageName, '@pulumi/aws');
    assert.equal(report.source.module, 'aws:s3/bucket:Bucket');
    assert.equal(report.source.version, 'unversioned');
    assert.equal(report.download.mode, 'local-content');
    assert.deepEqual(report.sourceOutline.signals, [
      'argument-reference',
      'example-usage',
      'import'
    ]);
    assert.equal(report.centralLibraryCandidate.classification.ecosystem, 'pulumi');
    assert.equal(report.centralLibraryCandidate.classification.artifactKind, 'pulumi-package-resource');
    assert.equal(
      report.centralLibraryCandidate.classification.coordinates,
      'pulumi/package/@pulumi/aws/unversioned/resource/aws:s3/bucket:Bucket'
    );
    assert.equal(report.centralLibraryCandidate.classification.providerAddress, '@pulumi/aws');
    assert.equal(report.centralLibraryCandidate.classification.resourceToken, 'aws:s3/bucket:Bucket');
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('package-docs'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('@pulumi/aws'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('aws:s3/bucket:Bucket'));
    assert.deepEqual(report.centralLibraryCandidate.classification.versionRef, {
      value: 'unversioned',
      kind: 'pinned-version',
      mutable: false,
      source: 'url-path'
    });
    assert.deepEqual(report.centralLibraryCandidate.classification.versionResolution, {
      requestedVersion: 'unversioned',
      resolvedVersion: 'unversioned',
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    });
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.ecosystem, 'pulumi');
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.artifactKind, 'pulumi-package-resource');
    assert.ok(report.unitsByType.fact.some(unit =>
      unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
      && unit.factKind === 'argument'
    ));
    assert.ok(report.unitsByType.example.some(unit =>
      unit.exampleType === 'pulumi-docs-example'
      && unit.language === 'typescript'
      && /new aws\.s3\.Bucket/.test(unit.snippet)
    ));
    assert.ok(report.unitsByType.diagnostic.some(unit =>
      unit.engine === 'pulumi'
      && unit.signature === 'BucketAlreadyExists'
    ));
    assert.ok(report.unitsByType.recipe.some(unit =>
      unit.name === 'Migration Workflow'
      && unit.mutationAllowed === false
    ));
    assert.equal(report.summary.unitTypeComplete, true);
    assert.equal(report.summary.qualityStatus, 'ready');
    assert.equal(artifact.classification.artifactKind, 'pulumi-package-resource');
    assert.equal(reportValidation.valid, true);
    assert.equal(artifactValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge from-url fetches Pulumi Registry resources through primary official URL only', async () => {
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);
    assert.equal(url, PULUMI_AWS_BUCKET_URL);

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-type' ? 'text/markdown' : null;
        }
      },
      async text() {
        return PULUMI_AWS_BUCKET_MARKDOWN;
      }
    };
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: PULUMI_AWS_BUCKET_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const validation = validateKnowledgePayload(report, 'inline');

  assert.deepEqual(requestedUrls, [PULUMI_AWS_BUCKET_URL]);
  assert.equal(report.download.mode, 'live-fetch');
  assert.equal(report.download.strategy, 'official-url-primary-only');
  assert.equal(report.download.usedRole, 'primary');
  assert.equal(report.download.fallbackUsed, false);
  assert.equal(report.download.usedUrl, PULUMI_AWS_BUCKET_URL);
  assert.equal(report.download.attemptedCount, 1);
  assert.equal(report.download.attempts[0].role, 'primary');
  assert.equal(report.download.attempts[0].status, 'used');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, 'official-url-primary-only');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, 0);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl, PULUMI_AWS_BUCKET_URL);
  assert.equal(validation.valid, true);
});

test('knowledge from-url emits Artifact Hub Helm chart public-library context', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-from-url-helm-'));

  try {
    const contentPath = join(tempRoot, 'kube-prometheus-stack.md');
    await writeFile(contentPath, HELM_KUBE_PROMETHEUS_STACK_MARKDOWN, 'utf8');

    const report = await buildPublicKnowledgeUrlReport({
      url: HELM_KUBE_PROMETHEUS_STACK_URL,
      contentPath,
      maxUnits: 20
    });
    const artifact = buildPublicKnowledgeLibraryArtifact(report);
    const reportValidation = validateKnowledgePayload(report, 'inline');
    const artifactValidation = validateKnowledgePayload(artifact, 'inline');

    assert.equal(report.domain, 'helm');
    assert.equal(report.source.kind, 'chart-docs');
    assert.equal(report.source.name, 'chart-docs:prometheus-community/kube-prometheus-stack');
    assert.equal(report.source.chart, 'kube-prometheus-stack');
    assert.equal(report.source.version, 'unversioned');
    assert.equal(report.download.mode, 'local-content');
    assert.deepEqual(report.sourceOutline.signals, [
      'argument-reference',
      'example-usage'
    ]);
    assert.equal(report.centralLibraryCandidate.classification.ecosystem, 'helm');
    assert.equal(report.centralLibraryCandidate.classification.artifactKind, 'helm-chart-docs');
    assert.equal(
      report.centralLibraryCandidate.classification.coordinates,
      'helm/chart/prometheus-community/kube-prometheus-stack/unversioned'
    );
    assert.equal(report.centralLibraryCandidate.classification.providerAddress, 'prometheus-community/kube-prometheus-stack');
    assert.equal(report.centralLibraryCandidate.classification.repository, 'prometheus-community');
    assert.equal(report.centralLibraryCandidate.classification.chart, 'kube-prometheus-stack');
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('chart-docs'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('prometheus-community'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('kube-prometheus-stack'));
    assert.deepEqual(report.centralLibraryCandidate.classification.versionRef, {
      value: 'unversioned',
      kind: 'pinned-version',
      mutable: false,
      source: 'url-path'
    });
    assert.deepEqual(report.centralLibraryCandidate.classification.versionResolution, {
      requestedVersion: 'unversioned',
      resolvedVersion: 'unversioned',
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    });
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.ecosystem, 'helm');
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.artifactKind, 'helm-chart-docs');
    assert.ok(report.unitsByType.fact.some(unit =>
      unit.path === 'chart.kube-prometheus-stack.grafana.enabled'
      && unit.factKind === 'chart-value'
      && unit.defaultValue === 'true'
    ));
    assert.ok(report.unitsByType.example.some(unit =>
      unit.exampleType === 'helm-docs-example'
      && unit.language === 'yaml'
      && /grafana: enabled: true/.test(unit.snippet)
    ));
    assert.ok(report.unitsByType.diagnostic.some(unit =>
      unit.engine === 'helm'
      && unit.signature === 'rendered manifests contain a resource that already exists'
    ));
    assert.ok(report.unitsByType.recipe.some(unit =>
      /Helm|Upgrade Workflow/.test(unit.name)
      && unit.mutationAllowed === false
    ));
    assert.equal(report.summary.unitTypeComplete, true);
    assert.equal(report.summary.qualityStatus, 'ready');
    assert.equal(artifact.classification.artifactKind, 'helm-chart-docs');
    assert.equal(reportValidation.valid, true);
    assert.equal(artifactValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge from-url fetches Artifact Hub Helm chart docs through primary official URL only', async () => {
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);
    assert.equal(url, HELM_KUBE_PROMETHEUS_STACK_URL);

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-type' ? 'text/markdown' : null;
        }
      },
      async text() {
        return HELM_KUBE_PROMETHEUS_STACK_MARKDOWN;
      }
    };
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: HELM_KUBE_PROMETHEUS_STACK_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const validation = validateKnowledgePayload(report, 'inline');

  assert.deepEqual(requestedUrls, [HELM_KUBE_PROMETHEUS_STACK_URL]);
  assert.equal(report.download.mode, 'live-fetch');
  assert.equal(report.download.strategy, 'official-url-primary-only');
  assert.equal(report.download.usedRole, 'primary');
  assert.equal(report.download.fallbackUsed, false);
  assert.equal(report.download.usedUrl, HELM_KUBE_PROMETHEUS_STACK_URL);
  assert.equal(report.download.attemptedCount, 1);
  assert.equal(report.download.attempts[0].role, 'primary');
  assert.equal(report.download.attempts[0].status, 'used');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, 'official-url-primary-only');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, 0);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl, HELM_KUBE_PROMETHEUS_STACK_URL);
  assert.equal(validation.valid, true);
});

test('knowledge from-url falls back to Terraform provider repository docs when Registry returns a JavaScript shell', async () => {
  const requestedUrls = [];
  const versionsUrl = 'https://registry.terraform.io/v1/providers/hashicorp/aws/versions';
  const rawDocsUrl = 'https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/s3_bucket.html.markdown';
  const fetchImpl = async url => {
    requestedUrls.push(url);
    if (url === S3_BUCKET_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/html' : null;
          }
        },
        async text() {
          return '<html><body>Please enable Javascript to use this application</body></html>';
        }
      };
    }

    if (url === rawDocsUrl) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
          }
        },
        async text() {
          return S3_BUCKET_INLINE_MARKDOWN;
        }
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get() {
          return null;
        }
      },
      async text() {
        return 'not found';
      }
    };
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const libraryArtifact = buildPublicKnowledgeLibraryArtifact(report);
  const validation = validateKnowledgePayload(libraryArtifact, 'inline');

  assert.deepEqual(requestedUrls.slice(0, 3), [versionsUrl, S3_BUCKET_URL, rawDocsUrl]);
  assert.equal(report.sourceUrl, S3_BUCKET_URL);
  assert.equal(report.source.url, S3_BUCKET_URL);
  assert.equal(report.source.name, 'resource:aws_s3_bucket');
  assert.equal(report.download.mode, 'live-fetch');
  assert.equal(report.download.strategy, 'terraform-registry-primary-then-provider-repo-raw');
  assert.equal(report.download.fallbackUsed, true);
  assert.equal(report.download.usedRole, 'fallback');
  assert.equal(report.download.usedUrl, rawDocsUrl);
  assert.equal(report.download.attemptedCount, 2);
  assert.equal(report.download.attempts[0].role, 'primary');
  assert.equal(report.download.attempts[0].status, 'rejected');
  assert.equal(report.download.attempts[0].reason, 'content-not-extractable');
  assert.equal(report.download.attempts[1].role, 'fallback');
  assert.equal(report.download.attempts[1].status, 'used');
  assert.equal(report.download.attempts[1].contentType, 'text/plain');
  assert.equal(report.download.usedContentType, 'text/markdown');
  assert.equal(validation.valid, true);
  assert.equal(report.centralLibraryCandidate.classification.providerAddress, 'hashicorp/aws');
  assert.equal(
    report.centralLibraryCandidate.classification.coordinates,
    'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket'
  );
  assert.equal(report.centralLibraryCandidate.classification.versionRef.kind, 'floating-alias');
  assert.equal(report.centralLibraryCandidate.classification.versionRef.mutable, true);
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.status, 'unavailable');
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.source, 'terraform-registry-provider-versions');
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.reason, 'http-error');
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.url, 'https://registry.terraform.io/v1/providers/hashicorp/aws/versions');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.mode, 'offline-review');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.usedRole, 'fallback');
  assert.deepEqual(
    report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef,
    report.centralLibraryCandidate.classification.versionRef
  );
  assert.deepEqual(
    report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionResolution,
    report.centralLibraryCandidate.classification.versionResolution
  );
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.fallbackUsed, true);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, report.download.strategy);
  assert.match(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.traceHash, /^[a-f0-9]{64}$/);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.attemptedCount, 2);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, 1);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedRole, 'fallback');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl, rawDocsUrl);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedContentType, 'text/markdown');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.fallbackUsed, true);
  assert.deepEqual(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.attemptedRoles, ['primary', 'fallback']);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.rejectedAttemptCount, 1);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.failedAttemptCount, 0);
  assert.equal(report.summary.unitTypeComplete, true);
  assert.equal(report.summary.qualityStatus, 'ready');
  assert.deepEqual(report.summary.missingUnitTypes, []);
  assert.ok(report.unitsByType.fact.some(unit => unit.path === 'resource.aws_s3_bucket.bucket'));
  assert.ok(report.unitsByType.example.some(unit => unit.exampleType === 'terraform-resource-snippet'));
  assert.ok(report.unitsByType.diagnostic.some(unit => /resource\.aws_s3_bucket\.bucket/.test(unit.signature)));
  assert.equal(report.unitsByType.fact.some(unit => unit.factKind === 'example'), false);
});

test('knowledge from-url resolves latest Terraform provider version metadata when live fetch succeeds', async () => {
  const versionsUrl = 'https://registry.terraform.io/v1/providers/hashicorp/aws/versions';
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);
    if (url === S3_BUCKET_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
          }
        },
        async text() {
          return S3_BUCKET_MARKDOWN;
        }
      };
    }

    if (url === versionsUrl) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          }
        },
        async text() {
          return JSON.stringify({
            versions: [
              { version: '6.2.0' },
              { version: '6.10.1-beta.1' },
              { version: '5.99.0' },
              { version: '6.10.1' }
            ]
          });
        }
      };
    }

    throw new Error(`unexpected URL: ${url}`);
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const validation = validateKnowledgePayload(report, 'inline');

  assert.deepEqual(requestedUrls, [versionsUrl, S3_BUCKET_URL]);
  assert.deepEqual(report.centralLibraryCandidate.classification.versionResolution, {
    requestedVersion: 'latest',
    resolvedVersion: '6.10.1',
    status: 'resolved',
    mutable: true,
    source: 'terraform-registry-provider-versions',
    url: versionsUrl,
    fetchedAt: '2026-05-18T00:00:00.000Z'
  });
  assert.deepEqual(
    report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionResolution,
    report.centralLibraryCandidate.classification.versionResolution
  );
  assert.equal(validation.valid, true);
});

test('knowledge from-url prefers resolved Terraform provider version for raw-doc fallback', async () => {
  const versionsUrl = 'https://registry.terraform.io/v1/providers/hashicorp/aws/versions';
  const resolvedRawDocsUrl = 'https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/v6.10.1/website/docs/r/s3_bucket.html.markdown';
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);
    if (url === versionsUrl) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          }
        },
        async text() {
          return JSON.stringify({
            versions: [
              { version: '6.2.0' },
              { version: '6.10.1' }
            ]
          });
        }
      };
    }

    if (url === S3_BUCKET_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/html' : null;
          }
        },
        async text() {
          return '<html><body>Please enable Javascript to use this application</body></html>';
        }
      };
    }

    if (url === resolvedRawDocsUrl) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
          }
        },
        async text() {
          return S3_BUCKET_INLINE_MARKDOWN;
        }
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get() {
          return null;
        }
      },
      async text() {
        return 'not found';
      }
    };
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const validation = validateKnowledgePayload(report, 'inline');

  assert.deepEqual(requestedUrls, [versionsUrl, S3_BUCKET_URL, resolvedRawDocsUrl]);
  assert.equal(report.download.usedRole, 'fallback');
  assert.equal(report.download.usedUrl, resolvedRawDocsUrl);
  assert.equal(report.download.attemptedCount, 2);
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.status, 'resolved');
  assert.equal(report.centralLibraryCandidate.classification.versionResolution.resolvedVersion, '6.10.1');
  assert.equal(
    report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl,
    resolvedRawDocsUrl
  );
  assert.equal(validation.valid, true);
});
