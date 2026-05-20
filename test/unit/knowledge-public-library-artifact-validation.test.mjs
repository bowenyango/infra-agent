import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';
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
  '1. Confirm whether the bucket name is changing.',
  '2. Run pulumi preview and inspect replacements.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means another stack owns the requested bucket name.',
  '',
  '- Confirm the owning account and region.',
  '- Use import or aliases when preserving an existing bucket.',
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
  '| `prometheus.prometheusSpec.retention` | string | `10d` | Retention period for Prometheus data. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'grafana:',
  '  enabled: true',
  '```',
  '',
  '## Compatibility Warnings',
  '',
  'CRDs must be reviewed during chart upgrades because ownership and API compatibility can affect rendered manifests.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Render the chart with helm template.',
  '2. Review CRD and ownership changes before merge.',
  '',
  '## Troubleshooting',
  '',
  '`rendered manifests contain a resource that already exists` usually means a Kubernetes object is owned by a different release.',
  '',
  '- Review Helm ownership annotations.',
  '- Confirm the release name and destination namespace.',
  ''
].join('\n');

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function buildArtifactFixture() {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-artifact-'));
  const contentPath = join(tempRoot, 'aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');

  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);

  return {
    tempRoot,
    report,
    artifact
  };
}

async function buildPulumiArtifactFixture() {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-pulumi-artifact-'));
  const contentPath = join(tempRoot, 'pulumi_aws_bucket.md');
  await writeFile(contentPath, PULUMI_AWS_BUCKET_MARKDOWN, 'utf8');

  const report = await buildPublicKnowledgeUrlReport({
    url: PULUMI_AWS_BUCKET_URL,
    contentPath,
    maxUnits: 20
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);

  return {
    tempRoot,
    report,
    artifact
  };
}

async function buildHelmArtifactFixture() {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-helm-artifact-'));
  const contentPath = join(tempRoot, 'kube-prometheus-stack.md');
  await writeFile(contentPath, HELM_KUBE_PROMETHEUS_STACK_MARKDOWN, 'utf8');

  const report = await buildPublicKnowledgeUrlReport({
    url: HELM_KUBE_PROMETHEUS_STACK_URL,
    contentPath,
    maxUnits: 20
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);

  return {
    tempRoot,
    report,
    artifact
  };
}

function buildRegistryFixture(artifact) {
  const artifactContent = JSON.stringify(artifact);
  const { classification } = artifact;

  return {
    kind: 'infra-agent.public-knowledge-library-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    entries: [
      {
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
        artifact: {
          url: 'https://knowledge.example.com/public/aws-s3-bucket.public-knowledge-library-artifact.json',
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
        }
      }
    ]
  };
}

test('public knowledge library artifacts validate as downloadable central-library inputs', async () => {
  const { tempRoot, report, artifact } = await buildArtifactFixture();

  try {
    const validation = validateKnowledgePayload(artifact, 'inline');

    assert.equal(validation.kind, 'infra-agent.knowledge-validation');
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, 0);
    assert.equal(validation.factCount, report.summary.unitCounts.fact);
    assert.equal(validation.unitSetCount, 1);
    assert.equal(validation.unitCount, report.summary.includedUnitCount);
    assert.deepEqual(validation.issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge URL reports validate as bounded LLM review inputs', async () => {
  const { tempRoot, report } = await buildArtifactFixture();

  try {
    const validation = validateKnowledgePayload(report, 'inline');

    assert.equal(validation.kind, 'infra-agent.knowledge-validation');
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-url-report');
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, 0);
    assert.equal(validation.factCount, report.summary.unitCounts.fact);
    assert.equal(validation.unitSetCount, 1);
    assert.equal(validation.unitCount, report.summary.includedUnitCount);
    assert.deepEqual(validation.issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge URL report validation rejects drifted summary candidate and LLM review input', async () => {
  const { tempRoot, report } = await buildArtifactFixture();

  try {
    const invalidReport = {
      ...report,
      sourceId: 'wrong-source-id',
      sourceContentHash: 'c'.repeat(64),
      sourceOutline: {
        ...report.sourceOutline,
        headingCount: report.sourceOutline.headingCount + 1
      },
      summary: {
        ...report.summary,
        includedUnitCount: report.summary.includedUnitCount + 1,
        unitCounts: {
          ...report.summary.unitCounts,
          fact: report.summary.unitCounts.fact + 1
        },
        compactByteLength: report.summary.compactByteLength + 1
      },
      centralLibraryCandidate: {
        ...report.centralLibraryCandidate,
        sourceId: 'wrong-candidate-source-id',
        classification: {
          ...report.centralLibraryCandidate.classification,
          coordinates: 'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket_wrong',
          tags: report.centralLibraryCandidate.classification.tags.filter(tag => tag !== 'provider-docs'),
          versionRef: {
            ...report.centralLibraryCandidate.classification.versionRef,
            value: '5.0.0'
          },
          versionResolution: {
            ...report.centralLibraryCandidate.classification.versionResolution,
            status: 'resolved',
            resolvedVersion: '6.10.1'
          }
        },
        llmRefinementInput: {
          ...report.centralLibraryCandidate.llmRefinementInput,
          reviewPacket: {
            ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket,
            sourceContentHash: 'd'.repeat(64),
            versionRef: {
              ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef,
              kind: 'pinned-version'
            },
            versionResolution: {
              ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionResolution,
              source: 'url-path'
            },
            downloadEvidence: {
              ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence,
              traceHash: 'e'.repeat(64)
            },
            sourceOutline: {
              ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceOutline,
              signals: ['example-usage', 'argument-reference']
            },
            unitDigest: {
              ...report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest,
              omittedPathCount: report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.omittedPathCount + 1
            },
            unitCount: report.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitCount + 1
          }
        }
      },
      unitsByType: {
        ...report.unitsByType,
        fact: [
          {
            ...report.unitsByType.fact[0],
            summary: 'contains bearer token material'
          }
        ]
      },
      rawContent: '# raw provider docs should never be embedded'
    };

    const validation = validateKnowledgePayload(invalidReport, 'inline');

    assert.equal(validation.valid, false);
    for (const path of [
      '$.rawContent',
      '$.sourceId',
      '$.sourceOutline.omittedHeadingCount',
      '$.summary.includedUnitCount',
      '$.summary.unitCounts.fact',
      '$.summary.compactByteLength',
      '$.centralLibraryCandidate.sourceId',
      '$.centralLibraryCandidate.sourceContentHash',
      '$.centralLibraryCandidate.candidateId',
      '$.centralLibraryCandidate.classification.coordinates',
      '$.centralLibraryCandidate.classification.tags',
      '$.centralLibraryCandidate.classification.versionRef.value',
      '$.centralLibraryCandidate.classification.versionResolution.source',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceContentHash',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef.kind',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionResolution.source',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.traceHash',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceOutline',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceOutline.signals',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitDigest.omittedPathCount',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitCount',
      '$.unitsByType.fact[0].summary'
    ]) {
      assert.ok(validation.issues.some(issue => issue.path === path), path);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge URL report validation rejects invalid fallback download order', async () => {
  const { tempRoot, report } = await buildArtifactFixture();

  try {
    const invalidReport = JSON.parse(JSON.stringify(report));
    invalidReport.download = {
      mode: 'live-fetch',
      strategy: 'terraform-registry-primary-then-provider-repo-raw',
      attemptedCount: 1,
      fallbackUsed: true,
      usedRole: 'fallback',
      usedUrl: S3_BUCKET_URL,
      usedContentType: 'text/markdown',
      attempts: [
        {
          role: 'fallback',
          url: S3_BUCKET_URL,
          status: 'used',
          contentType: 'text/markdown',
          byteLength: 100
        }
      ]
    };

    const validation = validateKnowledgePayload(invalidReport, 'inline');

    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some(issue => issue.path === '$.download.attempts'));
    assert.ok(validation.issues.some(issue => issue.path === '$.download.attempts[0]'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge library artifact validation rejects drifted hashes classification and raw content', async () => {
  const { tempRoot, artifact } = await buildArtifactFixture();

  try {
    const invalidArtifact = {
      ...artifact,
      unitPayloadHash: 'b'.repeat(64),
      coordinates: `${artifact.coordinates}/drift`,
      sourceOutline: {
        ...artifact.sourceOutline,
        headings: [
          ...artifact.sourceOutline.headings,
          { level: 7, title: 'https://example.invalid/raw-doc' }
        ]
      },
      classification: {
        ...artifact.classification,
        coordinates: 'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket_wrong',
        tags: [
          ...artifact.classification.tags,
          'https://example.invalid/raw-doc'
        ],
        versionResolution: {
          ...artifact.classification.versionResolution,
          mutable: false
        }
      },
      llmRefinementInput: {
        ...artifact.llmRefinementInput,
        inputRefs: artifact.llmRefinementInput.inputRefs.filter(ref => ref !== 'report.summary'),
        reviewPacket: {
          ...artifact.llmRefinementInput.reviewPacket,
          sourceContentHash: 'c'.repeat(64),
          coordinates: `${artifact.coordinates}/llm-drift`,
          versionResolution: {
            ...artifact.llmRefinementInput.reviewPacket.versionResolution,
            reason: 'http-error'
          },
          downloadEvidence: {
            ...artifact.llmRefinementInput.reviewPacket.downloadEvidence,
            attemptedCount: artifact.llmRefinementInput.reviewPacket.downloadEvidence.attemptedCount + 1
          },
          sourceOutline: {
            ...artifact.llmRefinementInput.reviewPacket.sourceOutline,
            byteLength: artifact.llmRefinementInput.reviewPacket.sourceOutline.byteLength + 1
          },
          unitDigest: {
            ...artifact.llmRefinementInput.reviewPacket.unitDigest,
            signals: {
              ...artifact.llmRefinementInput.reviewPacket.unitDigest.signals,
              argumentCount: artifact.llmRefinementInput.reviewPacket.unitDigest.signals.argumentCount + 1
            }
          },
          unitCount: artifact.llmRefinementInput.reviewPacket.unitCount + 1
        },
        reviewChecklist: ['single check']
      },
      summary: {
        ...artifact.summary,
        unitCount: artifact.summary.unitCount + 1
      },
      unitsByType: {
        ...artifact.unitsByType,
        fact: [
          {
            ...artifact.unitsByType.fact[0],
            summary: 'contains bearer token material'
          }
        ]
      },
      rawContent: '# raw provider docs should never be embedded'
    };

    const validation = validateKnowledgePayload(invalidArtifact, 'inline');

    assert.equal(validation.valid, false);
    for (const path of [
      '$.rawContent',
      '$.unitPayloadHash',
      '$.sourceOutline.headings',
      '$.sourceOutline.headings[5].level',
      '$.sourceOutline.headings[5].title',
      '$.classification.coordinates',
      '$.classification.tags[8]',
      '$.classification.versionResolution.mutable',
      '$.coordinates',
      '$.summary.unitCount',
      '$.summary.unitCounts.fact',
      '$.summary.compactByteLength',
      '$.llmRefinementInput.inputRefs',
      '$.llmRefinementInput.reviewPacket.sourceContentHash',
      '$.llmRefinementInput.reviewPacket.coordinates',
      '$.llmRefinementInput.reviewPacket.versionResolution.reason',
      '$.llmRefinementInput.reviewPacket.downloadEvidence.attemptedCount',
      '$.llmRefinementInput.reviewPacket.sourceOutline',
      '$.llmRefinementInput.reviewPacket.unitDigest.signals.argumentCount',
      '$.llmRefinementInput.reviewPacket.unitCount',
      '$.llmRefinementInput.reviewChecklist',
      '$.unitsByType.fact[0].summary'
    ]) {
      assert.ok(validation.issues.some(issue => issue.path === path), path);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge library registry validation checks coordinates hashes and secret-safe artifact locations', async () => {
  const { tempRoot, artifact } = await buildArtifactFixture();

  try {
    const registry = buildRegistryFixture(artifact);
    const validRegistry = validateKnowledgePayload(registry, 'inline');

    assert.equal(validRegistry.inputKind, 'infra-agent.public-knowledge-library-registry');
    assert.equal(validRegistry.valid, true);
    assert.equal(validRegistry.factSetCount, 0);
    assert.equal(validRegistry.factCount, 0);
    assert.equal(validRegistry.unitSetCount, 0);
    assert.equal(validRegistry.unitCount, artifact.summary.unitCount);

    const invalidRegistry = JSON.parse(JSON.stringify(registry));
    invalidRegistry.entries[0].coordinates = `${artifact.coordinates}/drift`;
    invalidRegistry.entries[0].versionRef.value = '5.0.0';
    invalidRegistry.entries[0].versionResolution.requestedVersion = '5.0.0';
    invalidRegistry.entries[0].artifact.versionRef.kind = 'pinned-version';
    invalidRegistry.entries[0].artifact.versionResolution.source = 'url-path';
    invalidRegistry.entries[0].tags.push('https://example.invalid/raw-doc');
    invalidRegistry.entries[0].artifact.path = 'public/aws-s3-bucket.public-knowledge-library-artifact.json';
    invalidRegistry.entries[0].artifact.url = 'https://knowledge.example.com/public/aws-s3-bucket.public-knowledge-library-artifact.json';
    invalidRegistry.entries[0].artifact.contentHash = 'not-a-sha';
    invalidRegistry.entries[0].artifact.reviewRequired = false;

    const invalid = validateKnowledgePayload(invalidRegistry, 'inline');

    assert.equal(invalid.valid, false);
    for (const path of [
      '$.entries[0].coordinates',
      '$.entries[0].versionRef.value',
      '$.entries[0].versionResolution.requestedVersion',
      '$.entries[0].artifact.versionRef.kind',
      '$.entries[0].artifact.versionResolution.source',
      '$.entries[0].tags[8]',
      '$.entries[0].artifact',
      '$.entries[0].artifact.contentHash',
      '$.entries[0].artifact.reviewRequired'
    ]) {
      assert.ok(invalid.issues.some(issue => issue.path === path), path);
    }

    const unsafeUrlRegistry = JSON.parse(JSON.stringify(registry));
    unsafeUrlRegistry.entries[0].artifact.url = 'https://knowledge.example.com/public/aws-s3-bucket.public-knowledge-library-artifact.json?token=bad';
    const unsafeUrl = validateKnowledgePayload(unsafeUrlRegistry, 'inline');

    assert.equal(unsafeUrl.valid, false);
    assert.ok(unsafeUrl.issues.some(issue => issue.path === '$.entries[0].artifact.url'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge library registry validation accepts Pulumi package resource entries', async () => {
  const { tempRoot, report, artifact } = await buildPulumiArtifactFixture();

  try {
    const registry = buildRegistryFixture(artifact);
    registry.entries[0].artifact.url = 'https://knowledge.example.com/public/pulumi-aws-bucket.public-knowledge-library-artifact.json';
    const validation = validateKnowledgePayload(registry, 'inline');

    assert.equal(report.domain, 'pulumi');
    assert.equal(registry.entries[0].ecosystem, 'pulumi');
    assert.equal(registry.entries[0].artifactKind, 'pulumi-package-resource');
    assert.equal(registry.entries[0].providerAddress, '@pulumi/aws');
    assert.equal(registry.entries[0].resourceToken, 'aws:s3/bucket:Bucket');
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-registry');
    assert.equal(validation.valid, true);
    assert.equal(validation.unitCount, artifact.summary.unitCount);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public knowledge library registry validation accepts Helm chart docs entries', async () => {
  const { tempRoot, report, artifact } = await buildHelmArtifactFixture();

  try {
    const registry = buildRegistryFixture(artifact);
    registry.entries[0].artifact.url = 'https://knowledge.example.com/public/helm-kube-prometheus-stack.public-knowledge-library-artifact.json';
    const validation = validateKnowledgePayload(registry, 'inline');

    assert.equal(report.domain, 'helm');
    assert.equal(registry.entries[0].ecosystem, 'helm');
    assert.equal(registry.entries[0].artifactKind, 'helm-chart-docs');
    assert.equal(registry.entries[0].providerAddress, 'prometheus-community/kube-prometheus-stack');
    assert.equal(registry.entries[0].repository, 'prometheus-community');
    assert.equal(registry.entries[0].chart, 'kube-prometheus-stack');
    assert.equal(registry.entries[0].sourceName, 'chart-docs:prometheus-community/kube-prometheus-stack');
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-registry');
    assert.equal(validation.valid, true);
    assert.equal(validation.unitCount, artifact.summary.unitCount);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
