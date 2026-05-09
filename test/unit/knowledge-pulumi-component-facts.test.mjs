import test from 'node:test';
import assert from 'node:assert/strict';
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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { rankKnowledgePackFacts } from '../../src/knowledge/fact-ranking.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { validateKnowledgePayloadWithLocalSources } from '../../src/knowledge/validate.ts';

test('extracts Pulumi component input and output facts from summary cache entries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-component-facts-'));

  try {
    const source = {
      kind: 'pulumi-component',
      name: 'pulumi-component:infra/api:ApiService',
      localPath: 'infra/api/components.ts',
      module: 'infra/api',
      packageName: 'ApiService'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.pulumi-component-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        projectRoot: 'infra/api',
        className: 'ApiService',
        sourcePath: 'infra/api/components.ts',
        sourceLocator: 'infra/api/components.ts:7',
        typeToken: 'pkg:index:ApiService',
        argsType: 'ApiServiceArgs',
        inputs: [
          {
            name: 'image',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:3',
            required: true,
            type: 'string'
          },
          {
            name: 'replicas',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:4',
            required: false,
            type: 'number'
          },
          {
            name: 'secretToken',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:5',
            required: false,
            type: 'string'
          }
        ],
        outputs: [
          {
            name: 'endpoint',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:8',
            type: 'pulumi.Output<string>'
          },
          {
            name: 'bearerToken',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:9',
            type: 'string'
          }
        ],
        childResources: [
          {
            name: 'assets',
            type: 'aws:s3/bucket:Bucket',
            packageName: 'aws',
            moduleName: 's3/bucket',
            typeName: 'Bucket',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:10'
          },
          {
            name: 'apiKeyBucket',
            type: 'aws:s3/bucket:Bucket',
            packageName: 'aws',
            moduleName: 's3/bucket',
            typeName: 'Bucket',
            sourcePath: 'infra/api/components.ts',
            sourceLocator: 'infra/api/components.ts:11'
          }
        ]
      }),
      fetchedAt: '1970-01-01T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      extractedAt: '2026-05-08T00:00:00.000Z'
    });

    assert.equal(factSet.kind, 'infra-agent.knowledge-facts');
    assert.equal(factSet.source.kind, 'pulumi-component');
    assert.equal(factSet.factCount, 4);
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-component-input'
      && fact.path === 'component.ApiService.inputs.image'
      && fact.required === true
      && fact.type === 'string'
      && fact.relatedPaths?.includes('infra/api/components.ts')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-component-input'
      && fact.path === 'component.ApiService.inputs.replicas'
      && fact.required === false
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-component-output'
      && fact.path === 'component.ApiService.outputs.endpoint'
      && fact.type === 'pulumi.Output<string>'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-component-child-resource'
      && fact.path === 'component.ApiService.childResources.assets'
      && fact.type === 'aws:s3/bucket:Bucket'
      && fact.values?.includes('assets')
      && fact.values?.includes('aws:s3/bucket:Bucket')
      && fact.source.locator === 'infra/api/components.ts:10: ApiService.assets'
      && fact.relatedPaths?.includes('infra/api/components.ts')
    ));
    assert.ok(factSet.facts.every(fact => fact.extractionMethod === 'repo-local-static'));
    assert.doesNotMatch(JSON.stringify(factSet), /secretToken|bearerToken|apiKeyBucket|class ApiService|super\(|@pulumi\/pulumi/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validates Pulumi component fact fingerprints against the workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-component-fingerprint-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      'name: api\nruntime: nodejs\n',
      'utf8'
    );
    const componentPath = join(projectRoot, 'components.ts');
    await writeFile(
      componentPath,
      [
        'import * as pulumi from "@pulumi/pulumi";',
        'interface ApiServiceArgs {',
        '  image: string;',
        '}',
        'class ApiService extends pulumi.ComponentResource {',
        '  public readonly endpoint: string;',
        '  constructor(name: string, args: ApiServiceArgs) {',
        '    super("pkg:index:ApiService", name, {}, undefined);',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/api']
    });
    const componentFactSet = report.factSets.find(factSet => factSet.source.kind === 'pulumi-component');

    assert.ok(componentFactSet);
    assert.equal(componentFactSet.sourceFingerprint?.fileCount, 1);
    assert.equal(componentFactSet.sourceFingerprint?.files[0]?.path, 'infra/api/components.ts');
    const freshReport = await validateKnowledgePayloadWithLocalSources(componentFactSet, 'inline', {
      workspaceRoot: tempRoot
    });
    assert.equal(freshReport.valid, true);

    const originalContent = await readFile(componentPath, 'utf8');
    await writeFile(componentPath, `${originalContent}\n// component drift\n`, 'utf8');
    const staleReport = await validateKnowledgePayloadWithLocalSources(componentFactSet, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.equal(staleReport.valid, false);
    assert.equal(staleReport.staleSourceCount, 1);
    assert.ok(staleReport.issues.some(issue =>
      issue.path === '$.sourceFingerprint'
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('includes Pulumi component facts in bounded knowledge packs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-component-pack-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      'name: api\nruntime: nodejs\n',
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'components.ts'),
      [
        'import * as pulumi from "@pulumi/pulumi";',
        'import * as aws from "@pulumi/aws";',
        'interface ApiServiceArgs {',
        '  image: string;',
        '}',
        'class ApiService extends pulumi.ComponentResource {',
        '  public readonly endpoint: string;',
        '  constructor(name: string, args: ApiServiceArgs) {',
        '    super("pkg:index:ApiService", name, {}, undefined);',
        '    const assets = new aws.s3.Bucket("assets", { bucket: args.image });',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/api'],
      maxFacts: 2
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.maxFacts, 2);
    assert.equal(pack.includedFactCount, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'pulumi-component'
      && source.targetPath === 'infra/api'
      && source.fingerprintDigest
      && source.storagePolicy.scope === 'workspace-private'
    ));
    assert.equal(pack.facts[0]?.kind, 'pulumi-component-input');
    assert.equal(pack.facts[0]?.path, 'component.ApiService.inputs.image');
    assert.equal(pack.facts[0]?.sourceLocator, 'infra/api/components.ts:4: ApiService.image');
    assert.equal(pack.facts[1]?.kind, 'pulumi-component-child-resource');
    assert.equal(pack.facts[1]?.path, 'component.ApiService.childResources.assets');
    assert.equal(pack.facts[1]?.type, 'aws:s3/bucket:Bucket');
    assert.equal(pack.facts[1]?.sourceLocator, 'infra/api/components.ts:10: ApiService.assets');
    assert.doesNotMatch(JSON.stringify(pack), /class ApiService|super\(|@pulumi\/pulumi/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('ranks local Pulumi component interface facts above public docs guidance', () => {
  const componentSource = {
    id: 'component-source',
    domain: 'pulumi',
    targetPath: 'infra/api',
    kind: 'pulumi-component',
    name: 'pulumi-component:infra/api:ApiService',
    factCount: 1,
    contentHash: 'a'.repeat(64),
    fetchedAt: '1970-01-01T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: {
      scope: 'workspace-private',
      defaultStore: 'local-only',
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      reason: 'workspace-local'
    }
  };
  const docsSource = {
    ...componentSource,
    id: 'docs-source',
    kind: 'pulumi-docs',
    name: 'pulumi-docs:package:aws',
    storagePolicy: {
      scope: 'public-reference',
      defaultStore: 'local-or-explicit-team-cache',
      shareableByDefault: true,
      requiresExplicitOptIn: false,
      reason: 'public docs'
    }
  };
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'pulumi-docs-guidance',
      path: 'pulumi.package.aws.s3',
      summary: 'S3 resources for buckets.',
      confidence: 'medium',
      extractionMethod: 'pulumi-docs-markdown',
      sourceId: 'docs-source',
      sourceLocator: 'Pulumi package docs: s3'
    },
    {
      kind: 'pulumi-component-input',
      path: 'component.ApiService.inputs.image',
      summary: 'component.ApiService.inputs.image is required by the Pulumi component interface.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'component-source',
      sourceLocator: 'infra/api/components.ts:3: ApiService.image',
      required: true,
      type: 'string'
    }
  ], {
    sources: [docsSource, componentSource],
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/api']
  });

  assert.equal(ranked[0]?.kind, 'pulumi-component-input');
});
