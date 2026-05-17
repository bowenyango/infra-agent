import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture
} from '../support/compact-fixtures.mjs';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { printDoctorReport } from '../../src/cli/output.ts';
import {
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion
} from '../../src/cli/main.ts';
import { buildDoctorReport } from '../../src/cli/doctor.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import {
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES
} from '../../src/cli/exit-codes.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';

test('graph CLI args accept workspace and json flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Terraform plan impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/terraform-workspace',
    '--terraform-plan',
    'plan.json',
    '--target',
    'terraform/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/terraform-workspace');
  assert.deepEqual(parsed.terraformPlanPaths, ['plan.json']);
  assert.deepEqual(parsed.targetPaths, ['terraform/payments-api']);
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Pulumi preview impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--pulumi-preview',
    'preview.json',
    '--target',
    'infra/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.pulumiPreviewPaths, ['preview.json']);
  assert.deepEqual(parsed.targetPaths, ['infra/payments-api']);
  assert.equal(parsed.json, true);
});

test('inventory CLI args accept workspace and context filters', () => {
  const parsed = parseArgs([
    'inventory',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'inventory');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.json, true);
});

test('pack CLI args accept workspace, scope, and domain filters', () => {
  const parsed = parseArgs([
    'pack',
    'fixtures/sample-workspace',
    '--scope',
    'charts/payments-api',
    '--domain',
    'helm',
    '--json'
  ]);

  assert.equal(parsed.command, 'pack');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.packScope, 'charts/payments-api');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.equal(parsed.json, true);
});

test('changed CLI args accept git diff and context filters', () => {
  const parsed = parseArgs([
    'changed',
    'fixtures/sample-workspace',
    '--base',
    'main',
    '--head',
    'HEAD',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'changed');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.changedBaseRef, 'main');
  assert.equal(parsed.changedHeadRef, 'HEAD');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.json, true);
});

test('changed CLI args accept explicit files for non-git callers', () => {
  const parsed = parseArgs([
    'changed',
    'fixtures/sample-workspace',
    '--file',
    'charts/payments-api/values.yaml',
    '--file',
    'README.md',
    '--json'
  ]);

  assert.equal(parsed.command, 'changed');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.changedFilePaths, [
    'charts/payments-api/values.yaml',
    'README.md'
  ]);
  assert.equal(parsed.changedBaseRef, null);
  assert.equal(parsed.changedHeadRef, null);
  assert.equal(parsed.json, true);
});

test('inventory command emits compact read-only inventory JSON through the entrypoint', async () => {
  const output = await captureStdout(() => main([
    'inventory',
    'fixtures/sample-workspace',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.inventory');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.totalTargetCount, 2);
  assert.deepEqual(report.summary.domains, ['helm', 'pulumi']);
  assert.ok(report.targets.some(target =>
    target.domain === 'helm'
    && target.kind === 'helm-chart'
    && target.path === 'charts/payments-api'
  ));
  assert.ok(report.targets.some(target =>
    target.domain === 'pulumi'
    && target.kind === 'pulumi-project'
    && target.path === 'infra/payments-api'
  ));
  assert.doesNotMatch(output, /example-api-secret/i);
});

test('pack command emits scoped read-only JSON through the entrypoint', async () => {
  const output = await captureStdout(() => main([
    'pack',
    'fixtures/sample-workspace',
    '--scope',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.scoped-pack');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.scope.requested, 'charts/payments-api');
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.ok(report.targets.some(target =>
    target.domain === 'helm'
    && target.kind === 'helm-chart'
    && target.path === 'charts/payments-api'
  ));
  assert.ok(report.suggestedFiles.includes('charts/payments-api/values.yaml'));
  assert.doesNotMatch(output, /example-api-secret/i);
});

test('pack command emits compact Markdown by default', async () => {
  const output = await captureStdout(() => main([
    'pack',
    'fixtures/sample-workspace',
    '--scope',
    'infra/payments-api'
  ]));

  assert.match(output, /^# Context Pack: infra\/payments-api/m);
  assert.match(output, /Mutation allowed: no/);
  assert.match(output, /pulumi-project/);
  assert.match(output, /Pulumi\.dev\.yaml/);
  assert.doesNotMatch(output, /example-api-secret/i);
});

test('changed command emits read-only affected context JSON through the entrypoint', async () => {
  const output = await captureStdout(() => main([
    'changed',
    'fixtures/sample-workspace',
    '--file',
    'charts/payments-api/values.yaml',
    '--file',
    'infra/payments-api/Pulumi.dev.yaml',
    '--file',
    'README.md',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.changed-context');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.changedFileCount, 3);
  assert.ok(report.affectedComponents.some(component =>
    component.domain === 'helm'
    && component.kind === 'helm-chart'
    && component.targetPath === 'charts/payments-api'
  ));
  assert.ok(report.affectedComponents.some(component =>
    component.domain === 'pulumi'
    && component.targetPath === 'infra/payments-api'
  ));
  assert.ok(report.omitted.unmappedFiles.some(file => file.path === 'README.md'));
  assert.doesNotMatch(output, /example-api-secret/i);
});

test('identity-report CLI args accept compact result input path', () => {
  const parsed = parseArgs([
    'identity-report',
    'agent-result.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'identity-report');
  assert.equal(parsed.inputPath, 'agent-result.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('impact-report CLI args accept infra graph input path', () => {
  const parsed = parseArgs([
    'impact-report',
    'graph.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'impact-report');
  assert.equal(parsed.inputPath, 'graph.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('report CLI commands emit read-only JSON through the entrypoint', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-report-cli-'));
  const identityInputPath = join(tempRoot, 'agent-result.json');
  const graphInputPath = join(tempRoot, 'graph.json');

  try {
    await writeFile(identityInputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'review terraform listener rule conflict',
      workspaceRoot: '/workspace',
      outcome: 'validation-blocked',
      modelName: 'rule-based',
      turnsUsed: 1,
      profileId: 'generic',
      requestedDomains: ['terraform'],
      changedFiles: [],
      resultCard: [],
      nextSteps: [],
      suggestedCommands: [],
      handoffCheckpoint: {
        schemaVersion: 1,
        source: 'agent-result',
        compact: true,
        primaryArtifact: 'agent --json',
        debugArtifact: 'agent --json-full',
        mutationAllowed: false,
        exclusions: {
          rawRuntimeIncluded: false,
          rawPreflightIncluded: false,
          rawToolOutputIncluded: false,
          rawPromptIncluded: false,
          rawKnowledgeExcerptIncluded: false
        },
        summary: {
          outcome: 'validation-blocked',
          activeBlocker: 'validation',
          nextControlAction: 'resolve-validation',
          readinessStatus: 'pass',
          validationStatus: 'failed',
          validationIssueCount: 1,
          identityConflictCount: 1,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture(),
        continuation: {
          required: true,
          reason: 'validation',
          nextControlAction: 'resolve-validation',
          approvalRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          mutationAllowed: false
        },
        durableSections: [
          'root',
          'harness',
          'validation',
          'approval',
          'knowledge',
          'readiness',
          'result-card'
        ]
      },
      validation: {
        status: 'failed',
        selectedPlan: [],
        issueSummary: {
          totalCount: 1,
          omittedIssueCount: 0,
          repairableCount: 0,
          nonRepairableCount: 1,
          maxGroups: 8,
          omittedGroupCount: 0,
          groups: [
            {
              kind: 'terraform-create-before-delete-conflict',
              repairable: false,
              count: 1,
              sourceCommandCount: 1,
              blocking: true
            }
          ],
          flags: {
            hasRepairableIssues: false,
            hasNonRepairableIssues: true,
            hasUnsafeValidationCommand: false,
            hasYamlSyntaxFailure: false,
            hasIdentityConflict: true
          }
        },
        issueDetails: {
          maxEntries: 5,
          omittedCount: 0
        },
        issues: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            message: 'Listener rule priority is already in use.',
            guidance: 'Review Terraform listener rule ownership before changing the priority.',
            metadata: {
              listenerRulePriorities: '100'
            }
          }
        ],
        safetyBlockers: {
          maxEntries: 5,
          omittedCount: 0,
          entries: []
        },
        identityConflictSummary: {
          totalCount: 1,
          includedCount: 1,
          maxEntries: 5,
          omittedCount: 0,
          mutationAllowed: false,
          byEngine: {
            terraform: 1,
            pulumi: 0
          },
          byRiskCategory: {
            'create-before-delete-ordering': 1,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        },
        identityConflicts: [
          {
            engine: 'terraform',
            issueKind: 'terraform-create-before-delete-conflict',
            conflictCode: 'PriorityInUse',
            conflictFamily: 'aws-lb-listener-rule',
            conflictLabel: 'AWS Load Balancer Listener Rule',
            resourceAddress: 'aws_lb_listener_rule.api',
            resourceName: null,
            resourceType: 'aws_lb_listener_rule',
            identity: {
              listenerRulePriorities: '100'
            },
            riskCategory: 'create-before-delete-ordering',
            reviewSteps: [
              'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
            ],
            suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
            sourceCommand: 'terraform -chdir=terraform/payments-api plan'
          }
        ]
      },
      approval: {
        requiredWriteRisks: [],
        requiredToolCategories: [],
        grants: buildEmptyApprovalGrantsFixture(),
        signals: [],
        resume: {
          continuationRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          primarySignal: null,
          additionalCommands: [],
          additionalSignalCount: 0,
          additionalWriteRisks: [],
          additionalWritePaths: [],
          additionalToolCategories: [],
          pendingScope: buildEmptyApprovalPendingScopeFixture(),
          writeRisks: [],
          writePaths: [],
          toolCategories: [],
          signalCount: 0
        }
      },
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'workspace-config: knowledgeCache.root'
      },
      knowledgeContext: {
        maxPackets: 5,
        maxTokens: 1000,
        maxExcerptChars: 1200,
        totalPacketCount: 0,
        includedPacketCount: 0,
        omittedPacketCount: 0,
        includedTokenEstimate: 0,
        omittedTokenEstimate: 0,
        omittedByPacketLimit: 0,
        omittedByTokenBudget: 0,
        packets: []
      },
      knowledgeFacts: buildEmptyKnowledgeFactsFixture()
    }), 'utf8');

    await writeFile(graphInputPath, JSON.stringify({
      kind: 'infra-agent.infra-graph',
      schemaVersion: 1,
      mutationAllowed: false,
      workspaceRoot: '/workspace',
      nodes: [],
      edges: [],
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        nodesByKind: {},
        edgesByKind: {}
      }
    }), 'utf8');

    const identityOutput = await captureStdout(() => main([
      'identity-report',
      identityInputPath,
      '--json'
    ]));
    const identityReport = JSON.parse(identityOutput);
    assert.equal(identityReport.kind, 'infra-agent.identity-conflict-report');
    assert.equal(identityReport.mutationAllowed, false);
    assert.equal(identityReport.incidentCount, 1);
    assert.equal(identityReport.incidentSummary.byEngine.terraform, 1);

    const impactOutput = await captureStdout(() => main([
      'impact-report',
      graphInputPath,
      '--json'
    ]));
    const impactReport = JSON.parse(impactOutput);
    assert.equal(impactReport.kind, 'infra-agent.infra-graph-impact-report');
    assert.equal(impactReport.mutationAllowed, false);
    assert.equal(impactReport.sourceKind, 'infra-agent.infra-graph');
    assert.equal(impactReport.counts.plannedChanges, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
