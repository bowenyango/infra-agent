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

const S3_BUCKET_INLINE_MARKDOWN = S3_BUCKET_MARKDOWN
  .replace(/\n+/g, ' ')
  .replace(/- `bucket`/g, '* `bucket`')
  .replace(/- `tags`/g, '* `tags`')
  .replace(/- `arn`/g, '* `arn`');

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
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('aws_s3_bucket'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('floating-alias'));
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.status, 'not-run');
    assert.ok(report.centralLibraryCandidate.llmRefinementInput.inputRefs.includes('report.unitsByType'));
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
    assert.equal(libraryArtifact.sourceContentHash, report.sourceContentHash);
    assert.equal(libraryArtifact.summary.unitCount, report.summary.includedUnitCount);
    assert.deepEqual(libraryArtifact.summary.unitCounts, report.summary.unitCounts);
    assert.deepEqual(libraryArtifact.unitsByType, report.unitsByType);
    assert.equal(libraryArtifact.download.mode, 'local-content');
    assert.equal(libraryArtifact.llmRefinementInput.status, 'not-run');
    assert.equal(libraryArtifact.llmRefinementInput.reviewPacket.coordinates, libraryArtifact.coordinates);
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

test('knowledge from-url falls back to Terraform provider repository docs when Registry returns a JavaScript shell', async () => {
  const requestedUrls = [];
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

  assert.deepEqual(requestedUrls.slice(0, 2), [S3_BUCKET_URL, rawDocsUrl]);
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
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.mode, 'offline-review');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.usedRole, 'fallback');
  assert.deepEqual(
    report.centralLibraryCandidate.llmRefinementInput.reviewPacket.versionRef,
    report.centralLibraryCandidate.classification.versionRef
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
