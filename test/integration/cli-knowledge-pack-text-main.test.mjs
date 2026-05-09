import test from 'node:test';
import assert from 'node:assert/strict';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';

test('knowledge pack text output reports source freshness posture', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--max-facts',
    '2'
  ]));

  assert.match(output, /Knowledge pack/);
  assert.match(output, /summary: .*staleSources=\d+, uncheckedSources=\d+/);
  assert.match(output, /pulumi-config-parameter config\.payments-api:imageTag/);
  assert.doesNotMatch(output, /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});
