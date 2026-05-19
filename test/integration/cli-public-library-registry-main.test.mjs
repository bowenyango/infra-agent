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
import { main } from '../../src/cli/main.ts';
import { stagePublicKnowledgeLibraryArtifact } from '../../src/knowledge/public-library-stage.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';

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
  '- `bucket_prefix` - (Optional, Forces new resource) Creates a unique bucket name beginning with the specified prefix.',
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

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

async function writePublicLibraryWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        publicLibraryRegistries: [
          {
            path: 'knowledge/public-library-registry.json',
            name: 'local-public-library',
            provider: 'hashicorp/aws'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'terraform {',
      '  required_providers {',
      '    aws = {',
      '      source = "hashicorp/aws"',
      '      version = "5.37.0"',
      '    }',
      '  }',
      '}',
      '',
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  const artifactInputPath = join(root, 'knowledge/aws_s3_bucket.library.json');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  await writeFile(artifactInputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  await stagePublicKnowledgeLibraryArtifact({
    workspaceRoot: root,
    artifactPath: artifactInputPath,
    storeDir: 'knowledge/public-library',
    registryPath: 'knowledge/public-library-registry.json',
    createdAt: '2026-05-19T00:00:00.000Z'
  });
}

test('knowledge pack consumes staged public library registry artifacts as public-reference units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-'));

  try {
    await writePublicLibraryWorkspace(tempRoot);

    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const publicLibrarySource = sourcesReport.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(publicLibrarySource);
    assert.equal(publicLibrarySource.domain, 'terraform');
    assert.equal(publicLibrarySource.targetPath, 'terraform/app');
    assert.equal(publicLibrarySource.requiresFetch, false);
    assert.equal(publicLibrarySource.cacheStatus, 'local');
    assert.equal(publicLibrarySource.storagePolicy.scope, 'public-reference');
    assert.equal(publicLibrarySource.storagePolicy.shareableByDefault, true);
    assert.equal(publicLibrarySource.source.name, 'resource:aws_s3_bucket');
    assert.equal(publicLibrarySource.source.provider, 'hashicorp/aws');
    assert.match(publicLibrarySource.source.localPath, /^knowledge\/public-library\/[a-f0-9]{64}\.public-knowledge-library-artifact\.json$/);

    const extractOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const extraction = parseJsonOutput(extractOutput);
    const extractedSource = extraction.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );
    const unitSet = extraction.unitSets.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.factCount, 0);
    assert.ok((extractedSource?.unitCount ?? 0) > 0);
    assert.equal(extractedSource?.unitCount, unitSet?.unitCount);
    assert.deepEqual(
      [...new Set(unitSet?.units.map(unit => unit.unitType))].sort(),
      ['diagnostic', 'example', 'fact', 'guidance', 'recipe']
    );
    assert.ok(unitSet?.units.every(unit => unit.privacyScope === 'public-reference'));

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--max-units',
      '8',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);
    const packedSource = pack.sources.find(source =>
      source.kind === 'public-knowledge-library-artifact'
    );
    const packedUnits = pack.units.filter(unit => unit.sourceId === packedSource?.id);

    assert.ok(packedSource);
    assert.equal(packedSource.storagePolicy.scope, 'public-reference');
    assert.equal(packedSource.storagePolicy.shareableByDefault, true);
    assert.equal(packedSource.kind, 'public-knowledge-library-artifact');
    assert.equal(packedSource.name, 'resource:aws_s3_bucket');
    assert.equal(pack.storagePolicy.publicReference, pack.sourceCount);
    assert.ok(packedUnits.some(unit => unit.unitType === 'fact' && unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(packedUnits.some(unit => unit.unitType === 'guidance'));
    assert.ok(packedUnits.length > 0);
    assert.doesNotMatch(packOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(packOutput, /## Troubleshooting/);
    assert.doesNotMatch(packOutput, /```hcl/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
