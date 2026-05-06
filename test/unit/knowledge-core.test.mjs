import {
  test,
  assert,
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
  tmpdir,
  resolve,
  join,
  inspectWorkspace,
  runSingleStep,
  executeDecision,
  buildTargetCandidates,
  detectRequestedService,
  buildRunPreflight,
  selectValidationCommands,
  buildValidationPreflight,
  classifyValidationIssues,
  RuleBasedPlanningModel,
  LLMModelClient,
  createModelClient,
  createModelClientSelection,
  resolveLLMClientConfig,
  createLLMProviderAdapter,
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities,
  parsePlannerDecision,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildEditPlan,
  collectApprovalSignals,
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
  summarizeAgentSnapshot,
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizeInfraGraphImpact,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands,
  printPlannerProviderCatalogReport,
  printDoctorReport,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands,
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion,
  buildDoctorReport,
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND,
  parsePlannerProviderCatalogReport,
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES,
  parseCompactAgentRunResult,
  parseInfraGraphResult,
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport,
  loadIdentityConflictIncidentReport,
  parseIdentityConflictIncidentReport,
  executeTool,
  PulumiConfigSetTool,
  SearchWorkspaceTool,
  ValidateTargetsTool,
  classifyUnsafeValidationCommand,
  resolveEffectiveApprovalPolicy,
  resolveEffectiveEditPolicy,
  inferRequestedDomains,
  prioritizeEditPlanKinds,
  buildInspectionCandidateFiles,
  buildInspectionSearchPattern,
  deriveConfigSemanticsFromValidationIssues,
  mergeConfigSemantics,
  resolveQueryLoopConfig,
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry,
  resolveKnowledgeCacheRoot,
  fetchOfficialKnowledgeSource,
  retrieveKnowledgeContextPacket,
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets,
  buildTerraformLocalModuleKnowledgeContent,
  buildTerraformLocalModuleKnowledgeSources,
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets,
  buildPulumiConfigKnowledgeContent,
  buildPulumiConfigKnowledgeSources,
  buildHelmChartMetadataKnowledgeContent,
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets,
  prefetchWorkspaceKnowledge,
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS,
  parseKnowledgeFactSet,
  extractKnowledgeFactSetFromCacheEntry,
  extractWorkspaceKnowledgeFacts,
  validateKnowledgePayload,
  validateKnowledgePayloadWithLocalSources,
  buildKnowledgePack,
  budgetKnowledgePackFacts,
  rankKnowledgePackFacts,
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles,
  buildStableInfraGraphSnapshot,
  normalizeInfraGraphImpactReviewTargets,
  buildWorkspaceInfraGraph,
  summarizeInfraGraph,
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges,
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges,
  captureStdout,
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture,
  buildGraphSnapshotBaseGraph,
  buildGraphSnapshotTerraformPlan,
  buildGraphSnapshotPulumiPreview,
  writeTerraformProviderSchemaWorkspace
} from '../support/cli-smoke-harness.mjs';

test('inspectWorkspace extracts Helm values schema semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const helmSemantics = inspection.configSemantics.find(summary => summary.targetPath === 'charts/payments-api');

  assert.ok(helmSemantics);
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'required-field'
    && fact.path === 'service.port'
    && fact.source.kind === 'helm-values-schema'
  ));
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'defaulted-field'
    && fact.path === 'replicaCount'
    && fact.values?.includes('1')
  ));
  assert.ok(helmSemantics.facts.some(fact =>
    fact.kind === 'enum'
    && fact.path === 'ingress.className'
    && fact.values?.includes('alb')
  ));
});

test('inspectWorkspace extracts Terraform variable semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const terraformSemantics = inspection.configSemantics.find(summary =>
    summary.targetKind === 'terraform-root'
    && summary.targetPath === 'terraform/payments-api'
  );

  assert.ok(terraformSemantics);
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'required-field'
    && fact.path === 'var.image_tag'
    && fact.source.kind === 'terraform-variable'
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'defaulted-field'
    && fact.path === 'var.service_name'
    && fact.values?.includes('payments-api')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'type-constraint'
    && fact.path === 'var.environment'
    && fact.values?.includes('string')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'enum'
    && fact.path === 'var.environment'
    && fact.values?.includes('dev')
    && fact.values?.includes('prod')
  ));
  assert.ok(terraformSemantics.facts.some(fact =>
    fact.kind === 'validation-rule'
    && fact.path === 'var.environment'
    && fact.message.includes('dev, stage, or prod')
  ));
});

test('inspectWorkspace extracts Pulumi stack config semantic facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pulumiSemantics = inspection.configSemantics.find(summary =>
    summary.targetKind === 'pulumi-project'
    && summary.targetPath === 'infra/payments-api'
  );

  assert.ok(pulumiSemantics);
  assert.ok(pulumiSemantics.facts.some(fact =>
    fact.kind === 'type-constraint'
    && fact.path === 'config.payments-api:environment'
    && fact.values?.includes('string')
    && fact.source.path === 'infra/payments-api/Pulumi.yaml'
  ));
  assert.ok(pulumiSemantics.facts.some(fact =>
    fact.kind === 'configured-field'
    && fact.path === 'config.payments-api:imageTag'
    && fact.values?.includes('latest')
    && fact.source.path === 'infra/payments-api/Pulumi.dev.yaml'
  ));
});

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
    'pulumi-config-parameter'
  ]);
  assert.deepEqual(KNOWLEDGE_FACT_EXTRACTION_METHODS, [
    'terraform-registry-markdown',
    'terraform-provider-schema',
    'helm-values-schema',
    'repo-local-static'
  ]);
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

  assert.equal(parseKnowledgeFactSet(terraformModuleFactSet).source.kind, 'terraform-module');
  assert.equal(parseKnowledgeFactSet(pulumiConfigFactSet).source.kind, 'pulumi-config');
  assert.equal(parseKnowledgeFactSet(helmChartMetadataFactSet).source.kind, 'chart-metadata');
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
    const written = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Values Schema\nUse JSON Schema for chart values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z',
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
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-05-01T00:00:00.000Z')), false);
    assert.equal(isKnowledgeCacheEntryStale(written, new Date('2026-06-01T00:00:00.000Z')), true);
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

test('knowledge context retrieval uses fresh cache entries before fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fresh-'));

  try {
    const source = {
      kind: 'pulumi-docs',
      name: 'config',
      packageName: '@pulumi/pulumi',
      version: '3.0.0',
      url: 'https://www.pulumi.com/docs/iac/concepts/config/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Pulumi Config\nUse stack config for environment-specific values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Pulumi stack config task',
      now: new Date('2026-05-01T00:00:00.000Z')
    });

    assert.ok(packet);
    assert.equal(packet.confidence, 'high');
    assert.match(packet.excerpt ?? '', /Pulumi Config/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Terraform Registry markdown from cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-terraform-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'resource:aws_s3_bucket',
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# aws_s3_bucket',
        '',
        '## Example Usage',
        '',
        '```hcl',
        'resource "aws_s3_bucket" "example" {',
        '  bucket = "example-bucket"',
        '}',
        '```',
        '',
        '## Argument Reference',
        '',
        '- `bucket` - (Optional) Name of the bucket. Forces replacement.',
        '- `tags` - (Optional) Map of tags for the bucket.',
        '',
        '## Attributes Reference',
        '',
        '- `arn` - ARN of the bucket.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-06T00:00:00.000Z')
    });

    assert.equal(factSet.kind, 'infra-agent.knowledge-facts');
    assert.equal(factSet.sourceId, entry.id);
    assert.equal(factSet.sourceContentHash, entry.contentHash);
    assert.equal(factSet.sourceStale, false);
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_s3_bucket.bucket'
      && fact.required === false
      && fact.source.locator === 'Argument Reference: bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'identity-field'
      && fact.path === 'resource.aws_s3_bucket.bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'replacement-sensitive-field'
      && fact.path === 'resource.aws_s3_bucket.bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'attribute'
      && fact.path === 'resource.aws_s3_bucket.arn'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'example'
      && fact.path === 'resource.aws_s3_bucket.example'
    ));
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Helm values schema from cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-helm-'));

  try {
    const source = {
      kind: 'chart-schema',
      name: 'payments-api:values.schema.json',
      chart: 'payments-api',
      version: '1.2.3',
      localPath: 'charts/payments-api/values.schema.json'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        type: 'object',
        required: ['image'],
        properties: {
          image: {
            type: 'object',
            required: ['tag'],
            properties: {
              tag: {
                type: 'string',
                description: 'Container image tag.',
                default: 'latest'
              }
            }
          },
          ingress: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                enum: ['nginx', 'internal'],
                description: 'Ingress class name.'
              }
            }
          }
        }
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image'
      && fact.required === true
      && fact.type === 'object'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image.tag'
      && fact.required === true
      && fact.defaultValue === 'latest'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.ingress.className'
      && fact.values?.includes('nginx')
      && fact.values?.includes('internal')
    ));
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Helm chart metadata and dependencies', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-helm-metadata-'));

  try {
    const source = {
      kind: 'chart-metadata',
      name: 'api:Chart.yaml',
      chart: 'api',
      module: 'charts/api',
      version: '0.2.0',
      localPath: 'charts/api/Chart.yaml',
      packageName: 'api'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.helm-chart-metadata-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        chartRoot: 'charts/api',
        chartFile: 'charts/api/Chart.yaml',
        lockFile: 'charts/api/Chart.lock',
        chartName: 'api',
        apiVersion: 'v2',
        version: '0.2.0',
        appVersion: '1.4.0',
        kubeVersion: '>=1.27.0',
        chartType: 'application',
        home: 'https://example.com/api-chart',
        sources: ['https://example.com/api-chart/source'],
        lockDigest: 'sha256:abc123',
        lockGenerated: '2026-04-28T00:00:00Z',
        dependencies: [
          {
            name: 'redis',
            sourcePath: 'charts/api/Chart.yaml',
            locked: false,
            version: '17.3.0',
            repository: 'https://charts.bitnami.com/bitnami',
            alias: 'cache'
          },
          {
            name: 'redis',
            sourcePath: 'charts/api/Chart.lock',
            locked: true,
            version: '17.3.1',
            repository: 'https://charts.bitnami.com/bitnami'
          },
          {
            name: 'api_token_helper',
            sourcePath: 'charts/api/Chart.yaml',
            locked: false,
            version: '0.1.0'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
      && fact.relatedPaths?.includes('charts/api/Chart.yaml')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.lockDigest'
      && fact.values?.includes('sha256:abc123')
      && fact.relatedPaths?.includes('charts/api/Chart.lock')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.summary.includes('locked')
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
      && fact.relatedPaths?.includes('charts/api/Chart.lock')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token_helper|"content"\s*:|apiVersion:\s*v2|generated:/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes compact Terraform provider schema context', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-provider-schema-'));

  try {
    const source = {
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      version: 'hashicorp/aws@5.37.0',
      localPath: 'terraform/app/.infra-agent/terraform-provider-schema.json',
      module: 'terraform/app'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        schemaFile: 'terraform/app/.infra-agent/terraform-provider-schema.json',
        blocks: [
          {
            type: 'aws_lb_listener_rule',
            kind: 'resource',
            sourcePaths: ['terraform/app/main.tf'],
            requiredAttributes: [
              { name: 'listener_arn', type: 'string', required: true }
            ],
            configuredAttributes: [
              { name: 'priority', type: 'number', optional: true },
              { name: 'arn', type: 'string', computed: true },
              { name: 'api_token', type: 'string', optional: true, sensitive: true }
            ],
            requiredBlocks: ['action nesting_mode=list min_items=1 max_items=1'],
            configuredBlocks: ['condition nesting_mode=list min_items=1']
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.required === true
      && fact.type === 'string'
      && fact.relatedPaths?.includes('terraform/app/main.tf')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.required === false
      && fact.type === 'number'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'attribute'
      && fact.path === 'resource.aws_lb_listener_rule.arn'
      && fact.summary.includes('do not set')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'nested-block'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.values?.includes('min_items=1')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Terraform local module interfaces', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-terraform-module-'));

  try {
    const source = {
      kind: 'terraform-module',
      name: 'terraform-module:terraform/app:queue_worker',
      localPath: 'terraform/app/modules/queue-worker',
      module: 'terraform/app',
      packageName: 'queue_worker'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.terraform-local-module-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        rootPath: 'terraform/app',
        callName: 'queue_worker',
        modulePath: 'terraform/app/modules/queue-worker',
        callSourcePaths: ['terraform/app/main.tf'],
        moduleSourcePaths: [
          'terraform/app/modules/queue-worker/variables.tf',
          'terraform/app/modules/queue-worker/outputs.tf'
        ],
        inputs: [
          {
            name: 'image_tag',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: true,
            type: 'string',
            description: 'Container image tag.'
          },
          {
            name: 'environment',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: false,
            type: 'string',
            defaultValue: 'dev',
            values: ['dev', 'stage', 'prod']
          },
          {
            name: 'api_token',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: true,
            type: 'string'
          }
        ],
        outputs: [
          {
            name: 'queue_name',
            sourcePath: 'terraform/app/modules/queue-worker/outputs.tf',
            description: 'Queue name.'
          },
          {
            name: 'secret_value',
            sourcePath: 'terraform/app/modules/queue-worker/outputs.tf'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'module.queue_worker.source'
      && fact.values?.includes('terraform/app/modules/queue-worker')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
      && fact.required === true
      && fact.type === 'string'
      && fact.relatedPaths?.includes('terraform/app/main.tf')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.environment'
      && fact.required === false
      && fact.defaultValue === 'dev'
      && fact.values?.includes('prod')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-output'
      && fact.path === 'module.queue_worker.outputs.queue_name'
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token|secret_value/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Pulumi config parameters', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-pulumi-config-'));

  try {
    const source = {
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      localPath: 'infra/payments-api',
      module: 'infra/payments-api',
      packageName: 'payments-api'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.pulumi-config-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        projectRoot: 'infra/payments-api',
        projectFile: 'infra/payments-api/Pulumi.yaml',
        projectName: 'payments-api',
        stackFiles: ['infra/payments-api/Pulumi.dev.yaml'],
        declarations: [
          {
            key: 'payments-api:imageTag',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'string',
            defaultValue: 'latest'
          },
          {
            key: 'payments-api:replicas',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'integer'
          },
          {
            key: 'payments-api:apiToken',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'string'
          }
        ],
        stackValues: [
          {
            key: 'payments-api:imageTag',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: false,
            value: 'dev-2026'
          },
          {
            key: 'payments-api:replicas',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: false,
            value: '2'
          },
          {
            key: 'payments-api:signingKey',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: true,
            value: 'ciphertext'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.type === 'string'
      && fact.defaultValue === 'latest'
      && fact.required === false
      && fact.values?.includes('dev-2026')
      && fact.relatedPaths?.includes('infra/payments-api/Pulumi.dev.yaml')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:replicas'
      && fact.type === 'integer'
      && fact.values?.includes('2')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /apiToken|signingKey|ciphertext/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract local Helm schema sources without fetching', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  assert.equal(report.factSetCount, report.factSets.length);
  assert.ok(report.factSetCount >= 1);
  assert.ok(report.factCount >= 5);

  const chartSchemaSource = report.sources.find(source => source.source.kind === 'chart-schema');
  assert.equal(chartSchemaSource?.status, 'extracted');
  const chartMetadataSource = report.sources.find(source => source.source.kind === 'chart-metadata');
  assert.equal(chartMetadataSource?.status, 'extracted');
  const chartSchemaFactSet = report.factSets.find(factSet => factSet.source.kind === 'chart-schema');
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.fileCount, 1);
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.files[0]?.path, 'charts/payments-api/values.schema.json');
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.files[0]?.stale, false);
  const chartMetadataFactSet = report.factSets.find(factSet => factSet.source.kind === 'chart-metadata');
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.fileCount, 1);
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.files[0]?.path, 'charts/payments-api/Chart.yaml');
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.files[0]?.stale, false);
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'chart-schema'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image.repository'
      && fact.required === true
    )
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'chart-metadata'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.payments-api.metadata.version'
      && fact.values?.includes('0.1.0')
    )
  ));
  assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|apiVersion:\s*v2|replicaCount":\s*\{|"\$schema"/);
});

test('knowledge validation accepts extraction reports and rejects count drift', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const validReport = validateKnowledgePayload(extraction, 'inline');
  assert.equal(validReport.kind, 'infra-agent.knowledge-validation');
  assert.equal(validReport.mutationAllowed, false);
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-extraction');
  assert.equal(validReport.valid, true);
  assert.equal(validReport.factSetCount, extraction.factSetCount);
  assert.equal(validReport.factCount, extraction.factCount);

  const invalidReport = validateKnowledgePayload({
    ...extraction,
    factCount: extraction.factCount + 1
  }, 'inline');
  assert.equal(invalidReport.valid, false);
  assert.ok(invalidReport.issues.some(issue =>
    issue.severity === 'error'
    && issue.path === '$.factCount'
  ));
});

test('knowledge validation rechecks local source fingerprints against a workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-stale-'));

  try {
    await cp(resolve('fixtures/sample-workspace'), tempRoot, { recursive: true });
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    const freshReport = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });
    assert.equal(freshReport.valid, true);
    assert.equal(freshReport.staleSourceCount, 0);
    assert.equal(freshReport.uncheckedLocalSourceCount, 0);

    await writeFile(
      join(tempRoot, 'charts/payments-api/Chart.yaml'),
      `${await readFile(join(tempRoot, 'charts/payments-api/Chart.yaml'), 'utf8')}\n# changed after extraction\n`
    );
    const staleReport = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });
    assert.equal(staleReport.valid, false);
    assert.equal(staleReport.staleSourceCount, 1);
    assert.ok(staleReport.issues.some(issue =>
      issue.severity === 'error'
      && issue.path.endsWith('.sourceFingerprint')
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack builds bounded planner-safe fact packs', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.mutationAllowed, false);
  assert.match(pack.packId, /^[a-f0-9]{24}$/);
  assert.deepEqual(pack.requestedDomains, ['helm']);
  assert.deepEqual(pack.targetPaths, ['charts/payments-api']);
  assert.equal(pack.maxFacts, 3);
  assert.equal(pack.includedFactCount, Math.min(3, pack.factCount));
  assert.equal(pack.facts.length, pack.includedFactCount);
  assert.ok(pack.omittedFactCount >= 1);
  assert.ok(pack.sources.some(source =>
    source.kind === 'chart-schema'
    && source.domain === 'helm'
    && source.factCount > 0
  ));
  const localSource = pack.sources.find(source => source.kind === 'chart-schema');
  assert.equal(localSource?.freshness, 'fresh');
  assert.match(localSource?.fingerprintDigest ?? '', /^[a-f0-9]{64}$/);
  assert.equal(localSource?.fingerprintFileCount, 1);
  assert.ok(localSource && !('sourceFingerprint' in localSource));
  assert.ok(pack.facts.every(fact => typeof fact.sourceId === 'string' && !('source' in fact)));
  assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|replicaCount":\s*\{|"\$schema"|resource "aws_/);
});

test('knowledge fact budget summarizes packs without raw source payloads', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 6,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const summary = budgetKnowledgePackFacts(pack, {
    maxFacts: 2
  });

  assert.equal(summary.kind, 'infra-agent.knowledge-facts-summary');
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.mutationAllowed, false);
  assert.equal(summary.packId, pack.packId);
  assert.equal(summary.maxFacts, 2);
  assert.equal(summary.includedFactCount, 2);
  assert.equal(summary.omittedFactCount, pack.factCount - 2);
  assert.equal(summary.sourceCount, pack.sourceCount);
  assert.ok(summary.sources.some(source =>
    source.kind === 'chart-schema'
    && source.domain === 'helm'
    && source.freshness === 'fresh'
    && typeof source.fingerprintDigest === 'string'
    && source.fingerprintFileCount === 1
    && source.factCount > 0
  ));
  assert.ok(summary.facts.every(fact =>
    typeof fact.sourceId === 'string'
    && typeof fact.sourceLocator === 'string'
    && !('source' in fact)
  ));
  assert.doesNotMatch(JSON.stringify(summary), /contentHash|fetchedAt|"content"\s*:|"\$schema"|replicaCount":\s*\{/);
});

test('knowledge fact ranking prioritizes local required facts before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 2,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'medium',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'resource.aws_lb_listener_rule.listener_arn is required by the Terraform provider schema.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_lb_listener_rule.listener_arn',
      required: true,
      type: 'string'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_lb_listener_rule.listener_arn');
  assert.equal(ranked[1]?.path, 'resource.aws_lb_listener_rule.example');
});

test('knowledge fact ranking is deterministic across target order and staleness', () => {
  const sources = [
    {
      id: 'target-b',
      domain: 'terraform',
      targetPath: 'terraform/b',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/b',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'target-a',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'stale-schema',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a-stale',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-04-01T00:00:00.000Z',
      stale: true
    },
    {
      id: 'fresh-registry',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'd'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-b',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-a',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.priority',
      summary: 'priority is required.',
      confidence: 'medium',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'stale-schema',
      sourceLocator: 'provider schema: priority',
      required: true,
      type: 'number'
    },
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'fresh-registry',
      sourceLocator: 'Example Usage'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/a', 'terraform/b']
  });

  assert.equal(ranked[0]?.sourceId, 'target-a');
  assert.equal(ranked[1]?.sourceId, 'target-b');
  assert.ok(
    ranked.findIndex(fact => fact.sourceId === 'stale-schema')
    < ranked.findIndex(fact => fact.sourceId === 'fresh-registry')
  );
});

test('knowledge fact ranking places required module inputs before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'module-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-module',
      name: 'terraform-module:terraform/app:queue_worker',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_sqs_queue',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_sqs_queue.example',
      summary: 'Queue example.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'module-input',
      path: 'module.queue_worker.inputs.image_tag',
      summary: 'module.queue_worker.inputs.image_tag is required by the local Terraform module interface.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'module-source',
      sourceLocator: 'variables.tf: variable.image_tag'
    },
    {
      kind: 'argument',
      path: 'resource.aws_sqs_queue.name',
      summary: 'resource.aws_sqs_queue.name is required by the Terraform provider schema.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_sqs_queue.name'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_sqs_queue.name');
  assert.equal(ranked[1]?.path, 'module.queue_worker.inputs.image_tag');
  assert.equal(ranked[2]?.path, 'resource.aws_sqs_queue.example');
  assert.ok(ranked.every(fact => !('rank' in fact)));
});

test('knowledge fact ranking places Pulumi config parameters before examples', () => {
  const sources = [
    {
      id: 'pulumi-config-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'pulumi-docs-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-docs',
      name: 'pulumi-config-docs',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'pulumi.config.example',
      summary: 'Pulumi config example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-docs-source',
      sourceLocator: 'Pulumi config docs'
    },
    {
      kind: 'pulumi-config-parameter',
      path: 'config.payments-api:imageTag',
      summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-config-source',
      sourceLocator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag',
      type: 'string',
      values: ['latest']
    }
  ], {
    sources,
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/payments-api']
  });

  assert.equal(ranked[0]?.path, 'config.payments-api:imageTag');
  assert.equal(ranked[1]?.path, 'pulumi.config.example');
});

test('knowledge fact ranking places Helm dependency facts before chart docs examples', () => {
  const sources = [
    {
      id: 'chart-metadata-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-metadata',
      name: 'api:Chart.yaml',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:dependency:redis',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'chart.api.example',
      summary: 'Helm chart dependency example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-docs-source',
      sourceLocator: 'chart docs'
    },
    {
      kind: 'chart-dependency',
      path: 'chart.api.dependencies.redis',
      summary: 'chart.api locked Helm dependency redis.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-metadata-source',
      sourceLocator: 'charts/api/Chart.lock: dependencies.redis',
      values: ['version=17.3.1', 'locked=true']
    }
  ], {
    sources,
    requestedDomains: ['helm'],
    targetPaths: ['charts/api']
  });

  assert.equal(ranked[0]?.path, 'chart.api.dependencies.redis');
  assert.equal(ranked[1]?.path, 'chart.api.example');
});

test('knowledge context retrieval fetches missing sources and writes cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fetch-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'aws_instance',
      provider: 'hashicorp/aws',
      version: '5.0.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
    };
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Terraform resource docs',
      fetcher: async fetchedSource => ({
        source: fetchedSource,
        contentType: 'text/markdown',
        content: '# aws_instance\nInstance docs.',
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });
    const cached = await readKnowledgeCacheEntry(tempRoot, source);

    assert.ok(packet);
    assert.equal(packet?.confidence, 'high');
    assert.match(packet?.excerpt ?? '', /aws_instance/);
    assert.ok(cached);
    assert.equal(cached?.content, '# aws_instance\nInstance docs.');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge context retrieval falls back to stale cache when refresh is unavailable', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-stale-'));

  try {
    const source = {
      kind: 'helm-docs',
      name: 'chart-template-guide',
      version: '3.14.0',
      url: 'https://helm.sh/docs/chart_template_guide/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Helm Templates\nStale but version-scoped docs.',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      staleAfter: '2026-02-01T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Helm template task',
      now: new Date('2026-04-28T00:00:00.000Z'),
      fetcher: async () => {
        throw new Error('network unavailable');
      }
    });

    assert.ok(packet);
    assert.equal(packet?.confidence, 'medium');
    assert.match(packet?.reason ?? '', /stale cached context/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('official knowledge fetcher normalizes response content type', async () => {
  const source = {
    kind: 'terraform-registry',
    name: 'aws_instance',
    provider: 'hashicorp/aws',
    version: '5.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
  };
  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-04-28T00:00:00.000Z',
    fetchImpl: async url => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/markdown; charset=utf-8' : null
      },
      text: async () => `# fetched from ${url}`
    })
  });

  assert.ok(fetched);
  assert.equal(fetched?.contentType, 'text/markdown');
  assert.match(fetched?.content ?? '', /fetched from/);
  assert.equal(fetched?.metadata?.retrieval, 'official-url');
});

test('Terraform Registry context sources use provider requirements and lockfile versions', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-sources-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {',
        '  ami           = "ami-123456"',
        '  instance_type = "t3.micro"',
        '}',
        '',
        'data "aws_ami" "ubuntu" {',
        '  most_recent = true',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version     = "5.37.0"',
        '  constraints = "~> 5.0"',
        '  hashes      = []',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const sources = await buildTerraformRegistryKnowledgeSources(tempRoot, root);
    const instanceSource = sources.find(source => source.name === 'resource:aws_instance');
    const amiSource = sources.find(source => source.name === 'data-source:aws_ami');

    assert.ok(instanceSource);
    assert.equal(instanceSource.provider, 'hashicorp/aws');
    assert.equal(instanceSource.version, '5.37.0');
    assert.match(instanceSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/resources\/instance$/);
    assert.ok(amiSource);
    assert.match(amiSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/data-sources\/ami$/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform local module knowledge sources include only literal workspace modules', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-local-module-sources-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(join(terraformRoot, 'modules/queue-worker'), { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        '',
        'module "registry_module" {',
        '  source = "hashicorp/consul/aws"',
        '}',
        '',
        'module "git_module" {',
        '  source = "git::https://example.com/org/mod.git"',
        '}',
        '',
        'module "dynamic_module" {',
        '  source = var.module_source',
        '}',
        '',
        'module "outside_workspace" {',
        '  source = "../../../outside-workspace"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const sources = await buildTerraformLocalModuleKnowledgeSources(tempRoot, root);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'terraform-module');
    assert.equal(sources[0]?.name, 'terraform-module:terraform/app:queue_worker');
    assert.equal(sources[0]?.localPath, 'terraform/app/modules/queue-worker');
    assert.equal(sources[0]?.module, 'terraform/app');
    assert.equal(sources[0]?.packageName, 'queue_worker');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi config knowledge sources summarize discovered project metadata', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
  assert.ok(project);

  const sources = await buildPulumiConfigKnowledgeSources(inspection.workspaceRoot, project);

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.kind, 'pulumi-config');
  assert.equal(sources[0]?.name, 'pulumi-config:infra/payments-api');
  assert.equal(sources[0]?.localPath, 'infra/payments-api');
  assert.equal(sources[0]?.module, 'infra/payments-api');
  assert.equal(sources[0]?.packageName, 'payments-api');
});

test('Pulumi config knowledge content summarizes safe project and stack config', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-config-content-'));

  try {
    const projectRoot = join(tempRoot, 'infra/payments-api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: payments-api',
        'runtime: yaml',
        'config:',
        '  payments-api:imageTag:',
        '    type: string',
        '    default: latest',
        '  payments-api:replicas:',
        '    type: integer',
        '  payments-api:apiToken:',
        '    type: string',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'Pulumi.dev.yaml'),
      [
        'config:',
        '  payments-api:imageTag: dev-2026',
        '  payments-api:replicas: 2',
        '  payments-api:databasePassword:',
        '    secure: ciphertext',
        '  payments-api:signingKey:',
        '    secure: redacted',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiConfigKnowledgeSources(tempRoot, project))[0];
    assert.ok(source);
    const content = await buildPulumiConfigKnowledgeContent({
      workspaceRoot: tempRoot,
      project,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.pulumi-config-summary');
    assert.equal(summary.mutationAllowed, false);
    assert.equal(summary.projectRoot, 'infra/payments-api');
    assert.deepEqual(summary.stackFiles, ['infra/payments-api/Pulumi.dev.yaml']);
    assert.ok(summary.declarations.some(declaration =>
      declaration.key === 'payments-api:imageTag'
      && declaration.type === 'string'
      && declaration.defaultValue === 'latest'
    ));
    assert.ok(summary.stackValues.some(value =>
      value.key === 'payments-api:replicas'
      && value.value === '2'
      && value.stackName === 'dev'
    ));
    assert.doesNotMatch(content, /apiToken|databasePassword|signingKey|ciphertext|redacted/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform local module knowledge content summarizes variables and outputs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-local-module-content-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type        = string',
        '  description = "Container image tag."',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '  validation {',
        '    condition     = contains(["dev", "stage", "prod"], var.environment)',
        '    error_message = "Environment must be supported."',
        '  }',
        '}',
        '',
        'variable "api_token" {',
        '  type = string',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  description = "Queue name."',
        '  value       = aws_sqs_queue.worker.name',
        '}',
        '',
        'output "secret_value" {',
        '  sensitive = true',
        '  value     = random_password.secret.result',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const source = (await buildTerraformLocalModuleKnowledgeSources(tempRoot, root))[0];
    assert.ok(source);
    const content = await buildTerraformLocalModuleKnowledgeContent({
      workspaceRoot: tempRoot,
      root,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.terraform-local-module-summary');
    assert.equal(summary.mutationAllowed, false);
    assert.deepEqual(summary.callSourcePaths, ['terraform/app/main.tf']);
    assert.ok(summary.inputs.some(input =>
      input.name === 'image_tag'
      && input.required === true
      && input.type === 'string'
      && input.description === 'Container image tag.'
    ));
    assert.ok(summary.inputs.some(input =>
      input.name === 'environment'
      && input.required === false
      && input.defaultValue === 'dev'
      && input.values.includes('prod')
    ));
    assert.ok(summary.outputs.some(output => output.name === 'queue_name'));
    assert.doesNotMatch(content, /api_token|secret_value|random_password/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('inspectWorkspace extracts compact Terraform provider schema semantics', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    assert.deepEqual(root.providerSchemaFiles, ['terraform/app/.infra-agent/terraform-provider-schema.json']);
    const targeting = buildTargetCandidates('update terraform app listener rule priority', inspection);
    assert.ok(targeting.targetCandidates[0]?.details?.some(detail =>
      detail.includes('provider schema: terraform/app/.infra-agent/terraform-provider-schema.json')
    ));

    const providerSchemaSummary = inspection.configSemantics.find(summary =>
      summary.targetKind === 'terraform-root'
      && summary.targetPath === 'terraform/app'
      && summary.facts.some(fact => fact.source.kind === 'terraform-provider-schema')
    );
    assert.ok(providerSchemaSummary);
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.source.kind === 'terraform-provider-schema'
      && fact.source.version === 'hashicorp/aws@5.37.0'
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.values?.includes('string')
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'type-constraint'
      && fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.values?.includes('number')
    ));
    assert.ok(providerSchemaSummary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.values?.includes('max_items=1')
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform provider schema context stays local and compact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-context-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);

    const sources = await buildTerraformProviderSchemaKnowledgeSources(tempRoot, root);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'provider-schema');
    assert.equal(sources[0]?.localPath, 'terraform/app/.infra-agent/terraform-provider-schema.json');
    assert.equal(sources[0]?.version, 'hashicorp/aws@5.37.0');

    const packets = await retrieveTerraformProviderSchemaContextPackets({
      workspaceRoot: tempRoot,
      root,
      reason: 'Local provider schema for Terraform planning'
    });
    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'provider-schema');
    assert.equal(packets[0]?.source.version, 'hashicorp/aws@5.37.0');
    assert.match(packets[0]?.excerpt ?? '', /aws_lb_listener_rule/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersions": \{\n    "hashicorp\/aws": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersion": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /listener_arn/);
    assert.doesNotMatch(packets[0]?.excerpt ?? '', /aws_instance/);

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}`,
        fetchedAt: '2026-04-29T00:00:00.000Z',
        staleAfter: '2026-05-29T00:00:00.000Z'
      })
    });
    assert.ok(prefetch.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'provider-schema'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract focused Terraform provider schema facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-facts-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    const providerSchemaResult = report.sources.find(source =>
      source.source.kind === 'provider-schema'
      && source.targetPath === 'terraform/app'
    );
    assert.equal(providerSchemaResult?.status, 'extracted');
    const providerSchemaFactSet = report.factSets.find(factSet => factSet.source.kind === 'provider-schema');
    assert.ok(providerSchemaFactSet?.sourceFingerprint);
    assert.equal(providerSchemaFactSet.sourceFingerprint.fileCount, 3);
    assert.deepEqual(providerSchemaFactSet.sourceFingerprint.files.map(file => file.path), [
      'terraform/app/.infra-agent/terraform-provider-schema.json',
      'terraform/app/.terraform.lock.hcl',
      'terraform/app/main.tf'
    ]);
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.source.version === 'hashicorp/aws@5.37.0'
      && factSet.facts.some(fact =>
        fact.kind === 'argument'
        && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
        && fact.required === true
        && fact.type === 'string'
      )
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.facts.some(fact =>
        fact.kind === 'argument'
        && fact.path === 'resource.aws_lb_listener_rule.priority'
        && fact.required === false
        && fact.type === 'number'
      )
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.facts.some(fact =>
        fact.kind === 'nested-block'
        && fact.path === 'resource.aws_lb_listener_rule.action'
        && fact.required === true
        && fact.values?.includes('max_items=1')
      )
    ));
    assert.doesNotMatch(JSON.stringify(report.factSets), /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract Terraform local module facts without fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-module-facts-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        '',
        'module "missing_module" {',
        '  source = "./modules/missing-module"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  value = "queue"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.source.packageName === 'queue_worker'
      && source.status === 'extracted'
      && source.factCount > 0
    ));
    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.source.packageName === 'missing_module'
      && source.status === 'unreadable'
    ));
    const moduleFactSet = report.factSets.find(factSet => factSet.source.kind === 'terraform-module');
    assert.ok(moduleFactSet?.sourceFingerprint);
    assert.equal(moduleFactSet.sourceFingerprint.fileCount, 3);
    assert.deepEqual(moduleFactSet.sourceFingerprint.files.map(file => file.path), [
      'terraform/app/main.tf',
      'terraform/app/modules/queue-worker/outputs.tf',
      'terraform/app/modules/queue-worker/variables.tf'
    ]);
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'terraform-module'
      && factSet.facts.some(fact =>
        fact.kind === 'module-input'
        && fact.path === 'module.queue_worker.inputs.image_tag'
        && fact.required === true
      )
      && factSet.facts.some(fact =>
        fact.kind === 'module-output'
        && fact.path === 'module.queue_worker.outputs.queue_name'
      )
    ));
    assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|variable "image_tag"|output "queue_name"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract Pulumi config parameters locally', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['pulumi'],
    targetPaths: ['infra/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const pulumiConfigResult = report.sources.find(source =>
    source.source.kind === 'pulumi-config'
    && source.targetPath === 'infra/payments-api'
  );
  assert.equal(pulumiConfigResult?.status, 'extracted');
  assert.ok((pulumiConfigResult?.factCount ?? 0) > 0);
  const pulumiConfigFactSet = report.factSets.find(factSet => factSet.source.kind === 'pulumi-config');
  assert.ok(pulumiConfigFactSet?.sourceFingerprint);
  assert.deepEqual(pulumiConfigFactSet.sourceFingerprint.files.map(file => file.path), [
    'infra/payments-api/Pulumi.dev.yaml',
    'infra/payments-api/Pulumi.yaml'
  ]);
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'pulumi-config'
    && factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.type === 'string'
      && fact.values?.includes('latest')
    )
  ));
  assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge pack includes focused Terraform provider schema facts under small budgets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-pack-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxFacts: 2,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.includedFactCount, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'provider-schema'
      && source.domain === 'terraform'
      && source.targetPath === 'terraform/app'
      && source.freshness === 'fresh'
      && typeof source.fingerprintDigest === 'string'
      && source.fingerprintFileCount === 3
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.required === true
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.required === true
    ));
    assert.doesNotMatch(JSON.stringify(pack), /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack includes Terraform local module inputs under small budgets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-module-pack-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  value = "queue"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxFacts: 2,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.includedFactCount, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'terraform-module'
      && source.targetPath === 'terraform/app'
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
      && fact.required === true
    ));
    assert.ok(pack.facts.some(fact =>
      fact.path === 'module.queue_worker.source'
      && fact.values?.includes('terraform/app/modules/queue-worker')
    ));
    assert.doesNotMatch(JSON.stringify(pack), /variable "image_tag"|output "queue_name"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack includes Pulumi config parameters under small budgets', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['pulumi'],
    targetPaths: ['infra/payments-api'],
    maxFacts: 2,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.mutationAllowed, false);
  assert.equal(pack.includedFactCount, 2);
  assert.ok(pack.sources.some(source =>
    source.kind === 'pulumi-config'
    && source.domain === 'pulumi'
    && source.targetPath === 'infra/payments-api'
    && source.factCount > 0
  ));
  assert.ok(pack.facts.every(fact => fact.kind === 'pulumi-config-parameter'));
  assert.ok(pack.facts.some(fact =>
    fact.path === 'config.payments-api:imageTag'
    && fact.type === 'string'
    && fact.values?.includes('latest')
  ));
  assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge pack includes Helm chart metadata and dependency facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-helm-metadata-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/api'],
      maxFacts: 8,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.ok(pack.sources.some(source =>
      source.kind === 'chart-metadata'
      && source.domain === 'helm'
      && source.targetPath === 'charts/api'
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
    ));
    assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform Registry context packets retrieve selected source docs through the cache layer', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-retrieve-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-cache-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const packets = await retrieveTerraformRegistryContextPackets({
      workspaceRoot: tempRoot,
      root,
      cacheRoot,
      reason: 'Terraform AWS resource docs for selected root',
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nVersion ${source.version} docs for ${source.provider}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'terraform-registry');
    assert.equal(packets[0]?.confidence, 'high');
    assert.match(packets[0]?.excerpt ?? '', /Version 5\.37\.0 docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads cached Terraform Registry context for Terraform tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-context-runtime-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const source = (await buildTerraformRegistryKnowledgeSources(tempRoot, root))[0];
    assert.ok(source);
    await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: '# aws_instance\nCached docs for planning.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });

    const checkingModel = {
      name: 'context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'terraform-registry'
          && packet.source.name === 'resource:aws_instance'
          && packet.confidence === 'high'
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded cached Terraform Registry context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update terraform aws instance', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet => packet.source.name === 'resource:aws_instance'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include local schema and chart docs metadata', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-sources-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        'sources:',
        '  - https://example.com/api-chart/source',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","properties":{"service":{"type":"object"}}}\n',
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const metadataSource = sources.find(source => source.kind === 'chart-metadata');
    const schemaSource = sources.find(source => source.kind === 'chart-schema');
    const helmDocsSource = sources.find(source => source.kind === 'helm-docs');
    const chartDocsSource = sources.find(source => source.kind === 'chart-docs' && source.name === 'api:home');

    assert.ok(metadataSource);
    assert.equal(metadataSource.localPath, 'charts/api/Chart.yaml');
    assert.equal(metadataSource.module, 'charts/api');
    assert.equal(metadataSource.version, '0.2.0');
    assert.equal(metadataSource.packageName, 'api');
    assert.ok(schemaSource);
    assert.equal(schemaSource.localPath, 'charts/api/values.schema.json');
    assert.equal(schemaSource.version, '0.2.0');
    assert.ok(helmDocsSource);
    assert.match(helmDocsSource.url ?? '', /helm\.sh\/docs\/topics\/charts/);
    assert.ok(chartDocsSource);
    assert.equal(chartDocsSource.url, 'https://example.com/api-chart');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include chart lock and dependency repositories', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-context-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: local-helper',
        '    version: 0.1.0',
        '    repository: file://../local-helper',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const lockSource = sources.find(source => source.kind === 'chart-lock');
    const redisSource = sources.find(source => source.name === 'api:dependency:redis');
    const postgresqlSource = sources.find(source => source.name === 'api:dependency:postgresql');
    const localSource = sources.find(source => source.name === 'api:dependency:local-helper');

    assert.ok(lockSource);
    assert.equal(lockSource.localPath, 'charts/api/Chart.lock');
    assert.equal(lockSource.version, '0.2.0');
    assert.ok(redisSource);
    assert.equal(redisSource.chart, 'redis');
    assert.equal(redisSource.module, 'api');
    assert.equal(redisSource.packageName, 'redis');
    assert.equal(redisSource.version, '17.3.0');
    assert.equal(redisSource.url, 'https://charts.bitnami.com/bitnami');
    assert.ok(postgresqlSource);
    assert.equal(postgresqlSource.version, '12.1.0');
    assert.equal(localSource, undefined);

    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm dependency docs for selected chart',
      maxExternalSources: 0
    });
    const lockPacket = packets.find(packet => packet.source.kind === 'chart-lock');

    assert.ok(lockPacket);
    assert.equal(lockPacket.contentType, 'application/yaml');
    assert.match(lockPacket.excerpt ?? '', /postgresql/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('Helm chart metadata knowledge content summarizes safe metadata and dependencies', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-metadata-content-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'description: api token should not be retained',
        'type: application',
        'version: 0.2.0',
        'appVersion: "1.4.0"',
        'kubeVersion: ">=1.27.0"',
        'home: https://example.com/api-chart?token=bad',
        'sources:',
        '  - https://example.com/api-chart/source',
        '  - https://example.com/api-chart/source?token=bad',
        'dependencies:',
        '  - name: redis',
        '    alias: cache',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: api-token-helper',
        '    version: 0.1.0',
        '    repository: https://example.com/secret-helper',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: oci://registry.example.com/charts',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const source = (await buildHelmChartKnowledgeSources(tempRoot, chart))
      .find(candidate => candidate.kind === 'chart-metadata');
    assert.ok(source);
    const content = await buildHelmChartMetadataKnowledgeContent({
      workspaceRoot: tempRoot,
      chart,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.helm-chart-metadata-summary');
    assert.equal(summary.schemaVersion, 1);
    assert.equal(summary.mutationAllowed, false);
    assert.equal(summary.chartRoot, 'charts/api');
    assert.equal(summary.chartFile, 'charts/api/Chart.yaml');
    assert.equal(summary.lockFile, 'charts/api/Chart.lock');
    assert.equal(summary.chartName, 'api');
    assert.equal(summary.apiVersion, 'v2');
    assert.equal(summary.version, '0.2.0');
    assert.equal(summary.appVersion, '1.4.0');
    assert.equal(summary.kubeVersion, '>=1.27.0');
    assert.equal(summary.chartType, 'application');
    assert.equal(summary.lockDigest, 'sha256:abc123');
    assert.equal(summary.lockGenerated, '2026-04-28T00:00:00Z');
    assert.deepEqual(summary.sources, ['https://example.com/api-chart/source']);
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'redis'
      && dependency.version === '17.3.0'
      && dependency.alias === 'cache'
      && dependency.locked === false
    ));
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'redis'
      && dependency.version === '17.3.1'
      && dependency.locked === true
    ));
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'postgresql'
      && dependency.locked === true
      && dependency.repository === 'oci://registry.example.com/charts'
    ));
    assert.doesNotMatch(content, /api-token-helper|secret-helper|token=bad|api token should not be retained/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context packets include local schema and cached external docs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-packets-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","required":["image"]}\n',
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm chart docs for selected chart',
      maxExternalSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nExternal Helm docs.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 2);
    assert.equal(packets[0]?.source.kind, 'chart-schema');
    assert.equal(packets[0]?.contentType, 'application/json');
    assert.match(packets[0]?.excerpt ?? '', /required/);
    assert.equal(packets[1]?.source.kind, 'helm-docs');
    assert.match(packets[1]?.excerpt ?? '', /External Helm docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Helm chart schema context for Helm tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-runtime-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      [
        '{',
        '  "type": "object",',
        '  "required": ["image"],',
        '  "properties": {',
        '    "image": {',
        '      "type": "object",',
        '      "required": ["repository", "tag"],',
        '      "properties": {',
        '        "repository": { "type": "string" },',
        '        "tag": { "type": "string" }',
        '      }',
        '    }',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'helm-context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'chart-schema'
          && packet.source.localPath === 'charts/api/values.schema.json'
          && packet.confidence === 'high'
          && packet.contentType === 'application/json'
          && packet.excerpt.includes('"repository"')
        ));
        assert.ok(runtime.knowledgeFacts);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-value'
          && fact.path === 'chart.api.image.repository'
          && fact.required === true
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded local Helm chart schema context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update helm chart image repository', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet =>
      packet.source.kind === 'chart-schema'
      && packet.source.name === 'api:values.schema.json'
    ));
    assert.ok(result.runtime.knowledgeFacts);
    assert.equal(result.runtime.knowledgeFacts.requestedDomains.includes('helm'), true);
    assert.equal(result.runtime.knowledgeFacts.targetPaths.includes('charts/api'), true);
    assert.ok(result.runtime.knowledgeFacts.facts.some(fact => fact.path === 'chart.api.image.tag'));
    assert.doesNotMatch(JSON.stringify(result.runtime.knowledgeFacts), /"content"\s*:|"\$schema"|repository":\s*\{/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Helm chart metadata and dependency knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-metadata-runtime-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'helm-metadata-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('helm'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('charts/api'), true);
        assert.ok(runtime.knowledgeFacts.sources.some(source =>
          source.kind === 'chart-metadata'
          && source.targetPath === 'charts/api'
          && source.factCount > 0
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-metadata'
          && fact.path === 'chart.api.metadata.version'
          && fact.values?.includes('0.2.0')
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-dependency'
          && fact.path === 'chart.api.dependencies.redis'
          && fact.values?.includes('version=17.3.1')
          && fact.values?.includes('locked=true')
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Helm metadata facts checked.',
            rationale: 'The runtime loaded compact Helm chart metadata and dependency facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep('update helm dependency redis version', tempRoot, checkingModel);

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads focused Terraform provider schema knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-provider-schema-facts-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const checkingModel = {
      name: 'terraform-provider-schema-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('terraform'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('terraform/app'), true);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.extractionMethod === 'terraform-provider-schema'
          && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
          && fact.required === true
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'nested-block'
          && fact.path === 'resource.aws_lb_listener_rule.action'
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /aws_instance|provider_schemas|"content"\s*:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Provider schema facts checked.',
            rationale: 'The runtime loaded focused Terraform provider schema facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep(
      'update terraform app listener rule priority',
      tempRoot,
      checkingModel
    );

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.extractionMethod === 'terraform-provider-schema'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Terraform local module knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-terraform-module-facts-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'terraform-module-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('terraform'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('terraform/app'), true);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'module-input'
          && fact.path === 'module.queue_worker.inputs.image_tag'
          && fact.required === true
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /variable "image_tag"|"content"\s*:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Terraform module facts checked.',
            rationale: 'The runtime loaded local Terraform module facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep(
      'update terraform app queue worker image tag',
      tempRoot,
      checkingModel
    );

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.path === 'module.queue_worker.source'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Pulumi config knowledge facts', async () => {
  const checkingModel = {
    name: 'pulumi-config-knowledge-check',
    async decideNextAction({ runtime }) {
      assert.ok(runtime.knowledgeFacts);
      assert.equal(runtime.knowledgeFacts.requestedDomains.includes('pulumi'), true);
      assert.equal(runtime.knowledgeFacts.targetPaths.includes('infra/payments-api'), true);
      assert.ok(runtime.knowledgeFacts.facts.some(fact =>
        fact.kind === 'pulumi-config-parameter'
        && fact.path === 'config.payments-api:imageTag'
        && fact.type === 'string'
        && fact.values?.includes('latest')
      ));
      assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Pulumi config facts checked.',
          rationale: 'The runtime loaded local Pulumi config facts.',
          payload: {
            stopReason: 'no-safe-action'
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'update pulumi payments-api dev image tag',
    'fixtures/sample-workspace',
    checkingModel
  );

  assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
    fact.path === 'config.payments-api:environment'
  ));
});

test('agent runtime loads knowledge facts for generic tasks with selected targets', async () => {
  const checkingModel = {
    name: 'generic-target-knowledge-check',
    async decideNextAction({ runtime }) {
      assert.deepEqual(runtime.preflight.requestedDomains, []);
      assert.ok(runtime.knowledgeFacts);
      assert.deepEqual(runtime.knowledgeFacts.requestedDomains, ['helm']);
      assert.equal(runtime.knowledgeFacts.targetPaths.includes('charts/payments-api'), true);
      assert.ok(runtime.knowledgeFacts.facts.some(fact => fact.path === 'chart.payments-api.image.repository'));
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Generic target facts checked.',
          rationale: 'Knowledge facts loaded from the selected target domain.',
          payload: {
            stopReason: 'no-safe-action'
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'update api image repository',
    'fixtures/sample-workspace',
    checkingModel,
    'rule-based',
    undefined,
    {
      retrievedContextBudget: {
        maxFacts: 2
      }
    }
  );

  assert.deepEqual(result.preflight.requestedDomains, []);
  assert.ok(result.runtime.knowledgeFacts);
  assert.deepEqual(result.runtime.knowledgeFacts.requestedDomains, ['helm']);
  assert.ok(result.runtime.knowledgeFacts.targetPaths.includes('charts/payments-api'));
});

test('knowledge prefetch fetches bounded external docs and skips local schema', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-prefetch-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(terraformRoot, { recursive: true });
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","required":["image"]}\n',
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform', 'helm'],
      targetPaths: ['terraform/app', 'charts/api'],
      maxSources: 2,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nPrefetched docs for ${source.kind}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
    assert.equal(result.summary.fetched, 2);
    assert.equal(result.summary.local, 2);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.cacheRoot, join(tempRoot, '.infra-agent/knowledge-cache'));
    assert.ok(result.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'chart-schema'
      && source.source.localPath === 'charts/api/values.schema.json'
    ));
    assert.ok(result.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'chart-metadata'
      && source.source.localPath === 'charts/api/Chart.yaml'
    ));
    const fetchedTerraform = result.sources.find(source =>
      source.status === 'fetched'
      && source.source.kind === 'terraform-registry'
    );
    assert.ok(fetchedTerraform);
    const cachedTerraform = await readKnowledgeCacheEntry(result.cacheRoot, fetchedTerraform.source);
    assert.match(cachedTerraform?.content ?? '', /Prefetched docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
