import test from 'node:test';
import assert from 'node:assert/strict';
import {
  knowledgeUnitIncludesText,
  knowledgeUnitSearchText
} from '../../src/agent/knowledge-unit-text.ts';

function baseUnit(overrides = {}) {
  return {
    path: 'unit.path',
    summary: 'Compact unit summary',
    confidence: 'high',
    extractionMethod: 'repo-local-guidance',
    sourceId: 'source-id',
    sourceLocator: 'knowledge/units.json',
    privacyScope: 'workspace-private',
    relatedPaths: ['terraform/app/main.tf'],
    ...overrides
  };
}

test('knowledgeUnitIncludesText matches fact values and type metadata', () => {
  const unit = baseUnit({
    unitType: 'fact',
    factKind: 'input',
    values: ['payments-api', 'desired_capacity'],
    type: 'number',
    defaultValue: '3'
  });

  assert.equal(knowledgeUnitIncludesText(unit, /\bdesired_capacity\b/), true);
  assert.equal(knowledgeUnitIncludesText(unit, /\bnumber\b/), true);
  assert.equal(knowledgeUnitIncludesText(unit, /\bunrelated\b/), false);
});

test('knowledgeUnitIncludesText matches guidance appliesWhen and risk', () => {
  const unit = baseUnit({
    unitType: 'guidance',
    topic: 'terraform-logical-rename',
    appliesWhen: ['Terraform resource address rename'],
    avoidWhen: ['new physical object is intended'],
    risk: 'Without a moved block, Terraform can plan destroy and create.'
  });

  assert.equal(knowledgeUnitIncludesText(unit, /resource address rename/i), true);
  assert.equal(knowledgeUnitIncludesText(unit, /destroy and create/i), true);
});

test('knowledgeUnitIncludesText matches example snippets and language', () => {
  const unit = baseUnit({
    unitType: 'example',
    exampleType: 'terraform-moved-block',
    language: 'hcl',
    snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
  });

  assert.equal(knowledgeUnitIncludesText(unit, /\bhcl\b/i), true);
  assert.equal(knowledgeUnitIncludesText(unit, /aws_s3_bucket\.old/), true);
});

test('knowledgeUnitIncludesText matches diagnostic signature and recommendedReview', () => {
  const unit = baseUnit({
    unitType: 'diagnostic',
    engine: 'pulumi',
    signature: 'CNAMEAlreadyExists',
    likelyCause: 'CloudFront alias ownership conflict.',
    recommendedReview: [
      'Review DNS ownership before retrying.',
      'Check aliases and import/state repair.'
    ]
  });

  assert.equal(knowledgeUnitIncludesText(unit, /CNAMEAlreadyExists/), true);
  assert.equal(knowledgeUnitIncludesText(unit, /import\/state repair/), true);
});

test('knowledgeUnitIncludesText matches recipe name and steps', () => {
  const unit = baseUnit({
    unitType: 'recipe',
    name: 'Pulumi alias and stack config review',
    steps: [
      'Collect old and new logical names.',
      'Review aliases before editing resources.'
    ],
    requiresApproval: true,
    mutationAllowed: false
  });

  assert.equal(knowledgeUnitIncludesText(unit, /stack config review/i), true);
  assert.equal(knowledgeUnitIncludesText(unit, /logical names/i), true);
});

test('knowledgeUnitSearchText uses compact metadata and omits raw source content', () => {
  const unit = baseUnit({
    unitType: 'guidance',
    topic: 'provider-schema',
    appliesWhen: ['module input update'],
    risk: 'Keep edits bounded.'
  });
  const text = knowledgeUnitSearchText(unit);

  assert.match(text, /repo-local-guidance/);
  assert.match(text, /knowledge\/units\.json/);
  assert.doesNotMatch(text, /rawContent/);
});
