import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyKnowledgeValidationReport,
  error,
  readStringArray,
  validateBlockerCodeSummary
} from '../../src/knowledge/validation-primitives.ts';

test('validation primitives accept matching blocker code summaries', () => {
  const issues = [];

  validateBlockerCodeSummary({
    blockerCodes: ['stale-source', 'workspace-private-source'],
    blockers: [
      { code: 'workspace-private-source' },
      { code: 'stale-source' },
      { code: 'stale-source' }
    ],
    path: '$.blockerCodes',
    issues
  });

  assert.deepEqual(issues, []);
});

test('validation primitives reject blocker code summary drift', () => {
  const issues = [];

  validateBlockerCodeSummary({
    blockerCodes: ['stale-source'],
    blockers: [
      { code: 'workspace-private-source' }
    ],
    path: '$.blockerCodes',
    issues,
    message: 'summary drift'
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, '$.blockerCodes');
  assert.equal(issues[0].message, 'summary drift');
});

test('validation primitives build zero-fact reports for compact handoff validators', () => {
  const report = createEmptyKnowledgeValidationReport({
    inputPath: 'inline',
    inputKind: 'infra-agent.example',
    issues: [error('$.kind', 'unsupported')],
    factCount: 3,
    staleSourceCount: 1
  });

  assert.equal(report.kind, 'infra-agent.knowledge-validation');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.valid, false);
  assert.equal(report.factSetCount, 0);
  assert.equal(report.factCount, 3);
  assert.equal(report.staleSourceCount, 1);
  assert.equal(report.freshness.staleSourceCount, 1);
  assert.deepEqual(report.freshness.staleSources, []);
  assert.equal(report.issueCount, 1);
});

test('validation primitives read string arrays with indexed issue paths', () => {
  const issues = [];
  const value = readStringArray(['ok', ''], '$.items', issues);

  assert.deepEqual(value, ['ok']);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, '$.items[1]');
});
