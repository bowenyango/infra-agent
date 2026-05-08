import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import {
  buildKnowledgeCacheEntryPath,
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import { resolveKnowledgeCacheRoot } from '../../src/knowledge/cache-root.ts';
import { createFileKnowledgeStore } from '../../src/knowledge/knowledge-store.ts';
import {
  resolveKnowledgeStoragePolicy,
  summarizeKnowledgeStoragePolicies
} from '../../src/knowledge/storage-policy.ts';
import {
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS
} from '../../src/types/knowledge.ts';
import { parseKnowledgeFactSet } from '../../src/knowledge/facts-contract.ts';
import {
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles
} from '../../src/knowledge/local-source-fingerprint.ts';

test('knowledge cache ids include version-sensitive source metadata', () => {
  const sourceV1 = {
    kind: 'terraform-registry',
    name: 'aws_instance',
    provider: 'hashicorp/aws',
    version: '5.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/5.0.0/docs/resources/instance'
  };
  const sourceV2 = {
    ...sourceV1,
    version: '6.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/6.0.0/docs/resources/instance'
  };

  assert.notEqual(buildKnowledgeCacheId(sourceV1), buildKnowledgeCacheId(sourceV2));
});

test('knowledge fact schema constants cover planned extraction surfaces', () => {
  assert.deepEqual(KNOWLEDGE_FACT_KINDS, [
    'argument',
    'attribute',
    'nested-block',
    'example',
    'identity-field',
    'replacement-sensitive-field',
    'module-input',
    'module-output',
    'chart-metadata',
    'chart-dependency',
    'chart-value',
    'pulumi-config-parameter',
    'pulumi-component-input',
    'pulumi-component-output',
    'pulumi-docs-guidance'
  ]);
  assert.deepEqual(KNOWLEDGE_FACT_EXTRACTION_METHODS, [
    'terraform-registry-markdown',
    'pulumi-docs-markdown',
    'helm-chart-docs-markdown',
    'terraform-provider-schema',
    'helm-values-schema',
    'repo-local-static'
  ]);
});

test('knowledge fact contracts keep Helm chart docs facts medium-confidence', () => {
  const chartDocsSource = {
    kind: 'chart-docs',
    name: 'api:home',
    url: 'https://example.com/charts/api',
    chart: 'api',
    packageName: 'api'
  };
  const chartDocsSourceId = buildKnowledgeCacheId(chartDocsSource);
  const chartDocsFactSet = {
    kind: 'infra-agent.knowledge-facts',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: chartDocsSourceId,
    source: chartDocsSource,
    sourceContentHash: 'c'.repeat(64),
    sourceFetchedAt: '2026-05-06T00:00:00.000Z',
    sourceStaleAfter: '2026-06-05T00:00:00.000Z',
    sourceStale: false,
    extractedAt: '2026-05-06T01:00:00.000Z',
    factCount: 1,
    facts: [
      {
        kind: 'chart-value',
        path: 'chart.api.image.repository',
        summary: 'Container image repository.',
        values: ['image.repository'],
        confidence: 'medium',
        extractionMethod: 'helm-chart-docs-markdown',
        source: {
          id: chartDocsSourceId,
          source: chartDocsSource,
          contentHash: 'c'.repeat(64),
          locator: 'Chart docs: image.repository'
        }
      }
    ]
  };

  assert.equal(parseKnowledgeFactSet(chartDocsFactSet).facts[0]?.confidence, 'medium');
  assert.throws(
    () => parseKnowledgeFactSet({
      ...chartDocsFactSet,
      facts: [
        {
          ...chartDocsFactSet.facts[0],
          confidence: 'high'
        }
      ]
    }),
    /helm-chart-docs-markdown/
  );
});

test('knowledge source contracts include local infra sources', () => {
  const terraformModuleSource = {
    kind: 'terraform-module',
    name: 'terraform-module:terraform/app:queue-worker',
    localPath: 'terraform/app/modules/queue-worker',
    module: 'terraform/app',
    packageName: 'queue-worker'
  };
  const terraformModuleSourceId = buildKnowledgeCacheId(terraformModuleSource);
  const terraformModuleFactSet = {
    kind: 'infra-agent.knowledge-facts',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: terraformModuleSourceId,
    source: terraformModuleSource,
    sourceContentHash: 'b'.repeat(64),
    sourceFetchedAt: '2026-05-05T00:00:00.000Z',
    sourceStale: false,
    extractedAt: '2026-05-05T01:00:00.000Z',
    factCount: 1,
    facts: [
      {
        kind: 'module-input',
        path: 'module.queue-worker.input.image_tag',
        summary: 'module.queue-worker.input.image_tag is required by the Terraform module interface.',
        required: true,
        type: 'string',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: terraformModuleSourceId,
          source: terraformModuleSource,
          contentHash: 'b'.repeat(64),
          locator: 'variables.tf: variable.image_tag'
        }
      }
    ]
  };
  const pulumiConfigSource = {
    kind: 'pulumi-config',
    name: 'pulumi-config:infra/payments-api',
    localPath: 'infra/payments-api',
    module: 'infra/payments-api',
    packageName: 'payments-api'
  };
  const pulumiConfigSourceId = buildKnowledgeCacheId(pulumiConfigSource);
  const pulumiConfigFactSet = {
    ...terraformModuleFactSet,
    sourceId: pulumiConfigSourceId,
    source: pulumiConfigSource,
    facts: [
      {
        kind: 'pulumi-config-parameter',
        path: 'config.payments-api:imageTag',
        summary: 'config.payments-api:imageTag is declared by Pulumi project config and has no default.',
        required: true,
        type: 'string',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: pulumiConfigSourceId,
          source: pulumiConfigSource,
          contentHash: 'b'.repeat(64),
          locator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag'
        }
      }
    ]
  };
  const helmChartMetadataSource = {
    kind: 'chart-metadata',
    name: 'payments-api:Chart.yaml',
    localPath: 'charts/payments-api/Chart.yaml',
    module: 'charts/payments-api',
    chart: 'payments-api',
    version: '0.1.0',
    packageName: 'payments-api'
  };
  const helmChartMetadataSourceId = buildKnowledgeCacheId(helmChartMetadataSource);
  const helmChartMetadataFactSet = {
    ...terraformModuleFactSet,
    sourceId: helmChartMetadataSourceId,
    source: helmChartMetadataSource,
    factCount: 2,
    facts: [
      {
        kind: 'chart-metadata',
        path: 'chart.payments-api.metadata.version',
        summary: 'chart.payments-api declares Helm chart version 0.1.0.',
        values: ['0.1.0'],
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: helmChartMetadataSourceId,
          source: helmChartMetadataSource,
          contentHash: 'b'.repeat(64),
          locator: 'charts/payments-api/Chart.yaml: version'
        }
      },
      {
        kind: 'chart-dependency',
        path: 'chart.payments-api.dependencies.redis',
        summary: 'chart.payments-api declares Helm dependency redis.',
        values: ['version=17.3.0', 'repository=https://charts.bitnami.com/bitnami'],
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: helmChartMetadataSourceId,
          source: helmChartMetadataSource,
          contentHash: 'b'.repeat(64),
          locator: 'charts/payments-api/Chart.yaml: dependencies.redis'
        }
      }
    ]
  };
  const pulumiComponentSource = {
    kind: 'pulumi-component',
    name: 'pulumi-component:infra/api:ApiService',
    localPath: 'infra/api/components.ts',
    module: 'infra/api',
    packageName: 'api'
  };
  const pulumiComponentSourceId = buildKnowledgeCacheId(pulumiComponentSource);
  const pulumiComponentFactSet = {
    ...terraformModuleFactSet,
    sourceId: pulumiComponentSourceId,
    source: pulumiComponentSource,
    factCount: 2,
    facts: [
      {
        kind: 'pulumi-component-input',
        path: 'component.ApiService.inputs.image',
        summary: 'component.ApiService.inputs.image is required by the Pulumi component interface.',
        values: ['image'],
        required: true,
        type: 'string',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: pulumiComponentSourceId,
          source: pulumiComponentSource,
          contentHash: 'b'.repeat(64),
          locator: 'infra/api/components.ts: ApiServiceArgs.image'
        }
      },
      {
        kind: 'pulumi-component-output',
        path: 'component.ApiService.outputs.url',
        summary: 'component.ApiService.outputs.url is exposed by the Pulumi component.',
        values: ['url'],
        type: 'pulumi.Output<string>',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: {
          id: pulumiComponentSourceId,
          source: pulumiComponentSource,
          contentHash: 'b'.repeat(64),
          locator: 'infra/api/components.ts: ApiService.url'
        }
      }
    ]
  };

  assert.equal(parseKnowledgeFactSet(terraformModuleFactSet).source.kind, 'terraform-module');
  assert.equal(parseKnowledgeFactSet(pulumiConfigFactSet).source.kind, 'pulumi-config');
  assert.equal(parseKnowledgeFactSet(helmChartMetadataFactSet).source.kind, 'chart-metadata');
  assert.equal(parseKnowledgeFactSet(pulumiComponentFactSet).source.kind, 'pulumi-component');
  assert.deepEqual(
    parseKnowledgeFactSet(pulumiComponentFactSet).facts.map(fact => fact.kind),
    ['pulumi-component-input', 'pulumi-component-output']
  );
});

test('knowledge storage policy separates public references from workspace-private sources', () => {
  const publicPolicy = resolveKnowledgeStoragePolicy({
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  });
  const privatePolicy = resolveKnowledgeStoragePolicy({
    kind: 'terraform-module',
    name: 'module:queue-worker',
    localPath: 'terraform/app/modules/queue-worker',
    module: 'terraform/app/modules/queue-worker'
  });
  const unknownPolicy = resolveKnowledgeStoragePolicy({
    kind: 'repo-example',
    name: 'example:payments-api'
  });
  const summary = summarizeKnowledgeStoragePolicies([publicPolicy, privatePolicy, unknownPolicy]);

  assert.equal(publicPolicy.scope, 'public-reference');
  assert.equal(publicPolicy.defaultStore, 'local-or-explicit-team-cache');
  assert.equal(publicPolicy.shareableByDefault, true);
  assert.equal(publicPolicy.requiresExplicitOptIn, false);
  assert.equal(privatePolicy.scope, 'workspace-private');
  assert.equal(privatePolicy.defaultStore, 'local-only');
  assert.equal(privatePolicy.shareableByDefault, false);
  assert.equal(privatePolicy.requiresExplicitOptIn, true);
  assert.equal(unknownPolicy.scope, 'workspace-private');
  assert.equal(summary.publicReference, 1);
  assert.equal(summary.workspacePrivate, 2);
  assert.equal(summary.shareableByDefault, 1);
  assert.equal(summary.explicitOptInRequired, 2);
});

test('knowledge fact contract validates source-linked fact sets', () => {
  const source = {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'a'.repeat(64);
  const factSet = {
    kind: 'infra-agent.knowledge-facts',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    sourceFetchedAt: '2026-05-05T00:00:00.000Z',
    sourceStaleAfter: '2026-06-05T00:00:00.000Z',
    sourceStale: false,
    extractedAt: '2026-05-05T01:00:00.000Z',
    factCount: 2,
    facts: [
      {
        kind: 'argument',
        path: 'resource.aws_s3_bucket.bucket',
        summary: 'Bucket name argument.',
        values: ['bucket'],
        required: false,
        type: 'string',
        confidence: 'high',
        extractionMethod: 'terraform-registry-markdown',
        source: {
          id: sourceId,
          source,
          contentHash: sourceContentHash,
          locator: 'Argument Reference: bucket'
        }
      },
      {
        kind: 'example',
        path: 'resource.aws_s3_bucket.example',
        summary: 'Minimal bucket example.',
        confidence: 'medium',
        extractionMethod: 'terraform-registry-markdown',
        source: {
          id: sourceId,
          source,
          contentHash: sourceContentHash,
          locator: 'Example Usage'
        }
      }
    ]
  };

  assert.equal(parseKnowledgeFactSet(factSet).kind, 'infra-agent.knowledge-facts');
  const sourceFingerprint = buildKnowledgeSourceFingerprint([{
    path: 'charts/payments-api/Chart.yaml',
    contentHash: 'c'.repeat(64),
    stale: false
  }]);
  assert.equal(parseKnowledgeFactSet({
    ...factSet,
    sourceFingerprint
  }).sourceFingerprint.fileCount, 1);
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      mutationAllowed: true
    }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      factCount: 1
    }),
    /factCount/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      facts: [
        {
          ...factSet.facts[0],
          source: {
            ...factSet.facts[0].source,
            id: 'different'
          }
        }
      ],
      factCount: 1
    }),
    /facts\[0\]\.source\.id/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      facts: [
        {
          ...factSet.facts[0],
          confidence: 'high'
        }
      ],
      sourceStale: true,
      factCount: 1
    }),
    /confidence/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      facts: [
        {
          ...factSet.facts[0],
          values: ['api token']
        }
      ],
      factCount: 1
    }),
    /secret-like/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      sourceFingerprint: {
        ...sourceFingerprint,
        digest: 'd'.repeat(64)
      }
    }),
    /digest/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      sourceFingerprint: {
        ...sourceFingerprint,
        digest: 'd'.repeat(64),
        files: [{
          path: '/tmp/provider-schema.json',
          contentHash: 'c'.repeat(64)
        }]
      }
    }),
    /Invalid local knowledge source path/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      sourceStaleReason: 'local-file-hash-mismatch'
    }),
    /sourceStaleReason/
  );
  assert.throws(
    () => parseKnowledgeFactSet({
      ...factSet,
      sourceFingerprint: buildKnowledgeSourceFingerprint([{
        path: 'charts/payments-api/Chart.yaml',
        contentHash: 'c'.repeat(64),
        stale: true
      }])
    }),
    /stale files/
  );
});

test('knowledge cache writes versioned entries and detects staleness', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-cache-'));

  try {
    const source = {
      kind: 'helm-docs',
      name: 'values.schema.json',
      chart: 'payments-api',
      version: '1.2.3',
      url: 'https://helm.sh/docs/topics/charts/'
    };
    const fingerprint = buildKnowledgeSourceFingerprint([{
      path: 'charts/payments-api/Chart.yaml',
      contentHash: 'f'.repeat(64)
    }]);
    const written = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Values Schema\nUse JSON Schema for chart values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z',
      fingerprint,
      summary: 'Helm chart values schema reference.',
      metadata: {
        sourceAuthority: 'official-docs'
      }
    });
    const readBack = await readKnowledgeCacheEntry(tempRoot, source);

    assert.ok(readBack);
    assert.equal(readBack?.id, written.id);
    assert.equal(readBack?.contentHash, written.contentHash);
    assert.equal(readBack?.source.version, '1.2.3');
    assert.deepEqual(written.fingerprint, fingerprint);
    assert.deepEqual(readBack?.fingerprint, fingerprint);
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-05-01T00:00:00.000Z')), false);
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-06-01T00:00:00.000Z')), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('file knowledge store preserves local cache entry behavior', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-store-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'aws_lb_listener_rule',
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb_listener_rule'
    };
    const store = createFileKnowledgeStore(tempRoot);
    const written = await store.write({
      source,
      contentType: 'text/markdown',
      content: '# aws_lb_listener_rule\nListener rule docs.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });
    const readBack = await store.read(source);
    const directRead = await readKnowledgeCacheEntry(tempRoot, source);

    assert.equal(store.root, tempRoot);
    assert.equal(store.buildId(source), buildKnowledgeCacheId(source));
    assert.equal(written.id, buildKnowledgeCacheId(source));
    assert.deepEqual(readBack, directRead);
    assert.equal(store.isStale(written, new Date('2026-05-01T00:00:00.000Z')), false);
    assert.equal(store.isStale(written, new Date('2026-06-01T00:00:00.000Z')), true);

    const missingSource = {
      ...source,
      name: 'aws_s3_bucket'
    };
    assert.equal(await store.read(missingSource), null);

    await writeFile(buildKnowledgeCacheEntryPath(tempRoot, source), '{"invalid":true}\n', 'utf8');
    assert.equal(await store.read(source), null);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge source fingerprints are deterministic and path-safe', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-fingerprint-'));

  try {
    await mkdir(join(tempRoot, 'charts/api'), { recursive: true });
    await writeFile(join(tempRoot, 'charts/api/Chart.yaml'), 'name: api\nversion: 0.1.0\n', 'utf8');
    await writeFile(join(tempRoot, 'charts/api/Chart.lock'), 'dependencies: []\n', 'utf8');

    const first = await fingerprintWorkspaceFiles(tempRoot, [
      'charts/api/Chart.lock',
      'charts/api/Chart.yaml'
    ]);
    const second = await fingerprintWorkspaceFiles(tempRoot, [
      'charts/api/Chart.yaml',
      'charts/api/Chart.lock'
    ]);

    assert.equal(first.algorithm, 'sha256');
    assert.equal(first.digest, second.digest);
    assert.equal(first.fileCount, 2);
    assert.deepEqual(first.files.map(file => file.path), [
      'charts/api/Chart.lock',
      'charts/api/Chart.yaml'
    ]);
    assert.ok(first.files.every(file => /^[a-f0-9]{64}$/.test(file.contentHash)));
    assert.ok(first.files.every(file => file.stale === false));

    assert.throws(
      () => buildKnowledgeSourceFingerprint([
        {
          path: '/abs/Chart.yaml',
          contentHash: 'a'.repeat(64)
        }
      ]),
      /Invalid local knowledge source path/
    );
    assert.throws(
      () => buildKnowledgeSourceFingerprint([
        {
          path: 'charts/api/secret-values.yaml',
          contentHash: 'a'.repeat(64)
        }
      ]),
      /Invalid local knowledge source path/
    );
    assert.throws(
      () => buildKnowledgeSourceFingerprint([
        {
          path: 'charts/api/Chart.yaml',
          contentHash: 'bad'
        }
      ]),
      /Invalid local knowledge source hash/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge source fingerprints detect local file changes and missing files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-fingerprint-check-'));

  try {
    await mkdir(join(tempRoot, 'charts/api'), { recursive: true });
    await writeFile(join(tempRoot, 'charts/api/Chart.yaml'), 'name: api\nversion: 0.1.0\n', 'utf8');
    await writeFile(join(tempRoot, 'charts/api/Chart.lock'), 'dependencies: []\n', 'utf8');
    const fingerprint = await fingerprintWorkspaceFiles(tempRoot, [
      'charts/api/Chart.yaml',
      'charts/api/Chart.lock'
    ]);

    assert.equal((await checkKnowledgeSourceFingerprint(tempRoot, fingerprint)).sourceStale, false);

    await writeFile(join(tempRoot, 'charts/api/Chart.yaml'), 'name: api\nversion: 0.2.0\n', 'utf8');
    const changed = await checkKnowledgeSourceFingerprint(tempRoot, fingerprint);
    assert.equal(changed.sourceStale, true);
    assert.equal(changed.sourceStaleReason, 'local-file-hash-mismatch');
    assert.ok(changed.fingerprint.files.some(file =>
      file.path === 'charts/api/Chart.yaml'
      && file.stale === true
    ));

    await rm(join(tempRoot, 'charts/api/Chart.lock'), { force: true });
    const missing = await checkKnowledgeSourceFingerprint(tempRoot, fingerprint);
    assert.equal(missing.sourceStale, true);
    assert.equal(missing.sourceStaleReason, 'local-file-missing');
    assert.ok(missing.fingerprint.files.some(file =>
      file.path === 'charts/api/Chart.lock'
      && file.stale === true
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge cache root resolver uses workspace config inside the workspace', () => {
  const workspaceRoot = resolve('/tmp/infra-agent-workspace');
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot,
    workspaceConfig: {
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    },
    env: {},
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve(workspaceRoot, '.infra-agent/knowledge-cache'));
  assert.equal(resolved.source, 'workspace-config: knowledgeCache.root');
});

test('knowledge cache root resolver lets explicit env override workspace config', () => {
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot: resolve('/tmp/infra-agent-workspace'),
    workspaceConfig: {
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    },
    env: {
      INFRA_AGENT_KNOWLEDGE_CACHE: '~/infra-agent-cache'
    },
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve('/home/tester/infra-agent-cache'));
  assert.equal(resolved.source, 'environment: INFRA_AGENT_KNOWLEDGE_CACHE');
});

test('knowledge cache root resolver defaults to user cache when unconfigured', () => {
  const resolved = resolveKnowledgeCacheRoot({
    workspaceRoot: resolve('/tmp/infra-agent-workspace'),
    workspaceConfig: null,
    env: {
      XDG_CACHE_HOME: '/tmp/xdg-cache'
    },
    homeDir: '/home/tester'
  });

  assert.equal(resolved.root, resolve('/tmp/xdg-cache/infra-agent/knowledge'));
  assert.equal(resolved.source, 'default: user cache');
});

test('knowledge cache root resolver rejects workspace config paths outside the workspace', () => {
  assert.throws(
    () => resolveKnowledgeCacheRoot({
      workspaceRoot: resolve('/tmp/infra-agent-workspace'),
      workspaceConfig: {
        knowledgeCache: {
          root: '../shared-cache'
        }
      },
      env: {},
      homeDir: '/home/tester'
    }),
    /must stay inside the workspace/
  );
});
