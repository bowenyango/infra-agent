import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildTargetCandidates } from '../../src/domain/task-targeting.ts';

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
