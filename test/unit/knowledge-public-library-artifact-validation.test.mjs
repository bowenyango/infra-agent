import test from 'node:test';
import assert from 'node:assert/strict';
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
