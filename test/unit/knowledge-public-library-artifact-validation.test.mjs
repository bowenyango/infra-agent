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
        sourceName: classification.sourceName,
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
          versionRef: {
            ...report.centralLibraryCandidate.classification.versionRef,
            value: '5.0.0'
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
      '$.summary.includedUnitCount',
      '$.summary.unitCounts.fact',
      '$.summary.compactByteLength',
      '$.centralLibraryCandidate.sourceId',
      '$.centralLibraryCandidate.sourceContentHash',
      '$.centralLibraryCandidate.candidateId',
      '$.centralLibraryCandidate.classification.coordinates',
      '$.centralLibraryCandidate.classification.versionRef.value',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.sourceContentHash',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef.kind',
      '$.centralLibraryCandidate.llmRefinementInput.reviewPacket.unitCount',
      '$.unitsByType.fact[0].summary'
    ]) {
      assert.ok(validation.issues.some(issue => issue.path === path), path);
    }
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
      classification: {
        ...artifact.classification,
        coordinates: 'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket_wrong'
      },
      llmRefinementInput: {
        ...artifact.llmRefinementInput,
        inputRefs: artifact.llmRefinementInput.inputRefs.filter(ref => ref !== 'report.summary'),
        reviewPacket: {
          ...artifact.llmRefinementInput.reviewPacket,
          sourceContentHash: 'c'.repeat(64),
          coordinates: `${artifact.coordinates}/llm-drift`,
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
      '$.classification.coordinates',
      '$.coordinates',
      '$.summary.unitCount',
      '$.summary.unitCounts.fact',
      '$.summary.compactByteLength',
      '$.llmRefinementInput.inputRefs',
      '$.llmRefinementInput.reviewPacket.sourceContentHash',
      '$.llmRefinementInput.reviewPacket.coordinates',
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
    invalidRegistry.entries[0].artifact.versionRef.kind = 'pinned-version';
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
      '$.entries[0].artifact.versionRef.kind',
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
