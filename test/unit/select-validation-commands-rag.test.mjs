import test from 'node:test';
import assert from 'node:assert/strict';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';

const CHART_ROOT = 'charts/payments-api';
const TERRAFORM_ROOT = 'terraform/payments-api';

function baseUnit(overrides = {}) {
  return {
    path: 'unit.helm.validation',
    summary: 'Compact Helm validation unit',
    confidence: 'high',
    extractionMethod: 'repo-local-guidance',
    sourceId: 'helm-source',
    sourceLocator: 'README.md',
    privacyScope: 'public-reference',
    ...overrides
  };
}

function knowledgePack(units) {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'helm-validation-rag-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['helm'],
    targetPaths: [CHART_ROOT],
    sourceIds: ['helm-source'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: 6,
    maxUnits: 6,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      shareableByDefault: 1,
      explicitOptInRequired: 0
    },
    sources: [
      {
        id: 'helm-source',
        domain: 'helm',
        targetPath: CHART_ROOT,
        kind: 'chart-docs',
        name: 'chart-docs:payments-api',
        factCount: 0,
        contentHash: 'a'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Public Helm chart documentation source.'
        }
      }
    ],
    facts: [],
    units
  };
}

function terraformKnowledgePack(units) {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'terraform-validation-rag-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['terraform'],
    targetPaths: [TERRAFORM_ROOT],
    sourceIds: ['terraform-source'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: 6,
    maxUnits: 6,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 0,
      workspacePrivate: 1,
      shareableByDefault: 0,
      explicitOptInRequired: 0
    },
    sources: [
      {
        id: 'terraform-source',
        domain: 'terraform',
        targetPath: TERRAFORM_ROOT,
        kind: 'terraform-module',
        name: 'terraform-module:payments-api',
        factCount: 0,
        contentHash: 'b'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'workspace-private',
          defaultStore: 'local-only',
          shareableByDefault: false,
          requiresExplicitOptIn: false,
          reason: 'Workspace Terraform module guidance source.'
        }
      }
    ],
    facts: [],
    units
  };
}

function baseTerraformUnit(overrides = {}) {
  return {
    path: 'unit.terraform.validation',
    summary: 'Compact Terraform validation unit',
    confidence: 'high',
    extractionMethod: 'repo-local-guidance',
    sourceId: 'terraform-source',
    sourceLocator: 'knowledge/terraform-validation.json',
    privacyScope: 'workspace-private',
    ...overrides
  };
}

function runtime({ commands, knowledgeFacts = null }) {
  return {
    task: 'update payments-api Helm chart values',
    preflight: {
      profile: {
        id: 'generic'
      },
      requestedDomains: ['helm'],
      targetCandidates: [
        {
          kind: 'helm-chart',
          path: CHART_ROOT
        }
      ],
      validation: {
        plan: [
          {
            kind: 'helm',
            target: CHART_ROOT,
            commands
          }
        ]
      }
    },
    knowledgeFacts,
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
}

function terraformRuntime({ commands, knowledgeFacts = null }) {
  return {
    task: 'update payments-api Terraform root',
    preflight: {
      profile: {
        id: 'generic'
      },
      requestedDomains: ['terraform'],
      targetCandidates: [
        {
          kind: 'terraform-root',
          path: TERRAFORM_ROOT
        }
      ],
      validation: {
        plan: [
          {
            kind: 'terraform',
            target: TERRAFORM_ROOT,
            commands
          }
        ]
      }
    },
    knowledgeFacts,
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
}

test('Helm render diagnostic prioritizes helm template ahead of lint', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'diagnostic',
        engine: 'helm',
        signature: 'service.port is required',
        likelyCause: 'The values render is missing service.port.',
        recommendedReview: [
          'Run helm template after updating values to render manifests.'
        ]
      })
    ])
  }));

  assert.deepEqual(commands, [
    `helm template ${CHART_ROOT}`,
    `helm lint ${CHART_ROOT}`
  ]);
});

test('Helm RAG priorities keep template and lint commands inside the six-command cap', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'recipe',
        name: 'Helm values render and lint review',
        summary: 'Render manifests and lint chart schema before finishing values edits.',
        steps: [
          'Run helm template to render manifests and check ingress.enabled.',
          'Run helm lint to catch values schema drift.'
        ],
        requiresApproval: false,
        mutationAllowed: false
      })
    ])
  }));

  assert.equal(commands.length, 6);
  assert.equal(commands[0], `helm template ${CHART_ROOT}`);
  assert.equal(commands[1], `helm lint ${CHART_ROOT}`);
  assert.ok(commands.includes('custom validation 1'));
  assert.ok(commands.includes('custom validation 4'));
  assert.equal(commands.includes('custom validation 5'), false);
  assert.equal(commands.includes('custom validation 6'), false);
});

test('Helm schema guidance prioritizes helm lint', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      `helm template ${CHART_ROOT}`,
      `helm lint ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'guidance',
        topic: 'helm-values-schema',
        summary: 'Use chart lint when values schema changes.',
        appliesWhen: ['editing values schema'],
        risk: 'Schema drift is caught by helm lint.'
      })
    ])
  }));

  assert.deepEqual(commands, [
    `helm lint ${CHART_ROOT}`,
    `helm template ${CHART_ROOT}`
  ]);
});

test('Terraform moved-block rename recipe keeps terraform plan inside the six-command cap', () => {
  const planCommand = `terraform -chdir=${TERRAFORM_ROOT} plan`;
  const commands = selectValidationCommands(terraformRuntime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      planCommand
    ],
    knowledgeFacts: terraformKnowledgePack([
      baseTerraformUnit({
        unitType: 'recipe',
        name: 'Terraform logical resource rename',
        summary: 'Use moved blocks when a Terraform resource address rename must retain the remote object.',
        steps: [
          'Add a moved block for the old and new resource addresses.',
          'Review terraform plan to prevent replacement and avoid destroy/create churn.'
        ],
        requiresApproval: false,
        mutationAllowed: false
      })
    ])
  }));

  assert.equal(commands.length, 6);
  assert.equal(commands[0], planCommand);
  assert.ok(commands.includes('custom validation 1'));
  assert.ok(commands.includes('custom validation 5'));
  assert.equal(commands.includes('custom validation 6'), false);
});

test('Terraform invalid configuration diagnostic prioritizes validate before plan', () => {
  const planCommand = `terraform -chdir=${TERRAFORM_ROOT} plan`;
  const validateCommand = `terraform -chdir=${TERRAFORM_ROOT} validate`;
  const commands = selectValidationCommands(terraformRuntime({
    commands: [
      planCommand,
      validateCommand
    ],
    knowledgeFacts: terraformKnowledgePack([
      baseTerraformUnit({
        unitType: 'diagnostic',
        engine: 'terraform',
        signature: 'invalid configuration: required argument missing',
        likelyCause: 'Provider schema requires an argument that is absent from configuration.',
        recommendedReview: [
          'Run terraform validate after adding the required argument.'
        ]
      })
    ])
  }));

  assert.deepEqual(commands, [
    validateCommand,
    planCommand
  ]);
});

test('Terraform command selection keeps original order and cap without related RAG units', () => {
  const commands = selectValidationCommands(terraformRuntime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      `terraform -chdir=${TERRAFORM_ROOT} plan`,
      `terraform -chdir=${TERRAFORM_ROOT} validate`
    ],
    knowledgeFacts: terraformKnowledgePack([
      baseTerraformUnit({
        unitType: 'guidance',
        topic: 'terraform-tagging',
        summary: 'Keep common provider tags consistent across resources.',
        appliesWhen: ['editing shared tags'],
        risk: 'Inconsistent tags make ownership unclear.'
      })
    ])
  }));

  assert.deepEqual(commands, [
    'custom validation 1',
    'custom validation 2',
    'custom validation 3',
    'custom validation 4',
    'custom validation 5',
    'custom validation 6'
  ]);
});

test('validation command selection keeps original order and cap without related RAG units', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ]
  }));

  assert.deepEqual(commands, [
    'custom validation 1',
    'custom validation 2',
    'custom validation 3',
    'custom validation 4',
    'custom validation 5',
    'custom validation 6'
  ]);
});
