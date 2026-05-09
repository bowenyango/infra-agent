import test from 'node:test';
import { createMockKnowledgeTeamBackendAdapter } from '../../src/knowledge/team-backend-adapter-mock.ts';
import {
  assertTeamBackendAdapterMetadataIndexConformance,
  assertTeamBackendAdapterObjectStoreConformance
} from '../support/knowledge-team-backend-adapter-conformance.mjs';

test('mock team backend adapter satisfies object store conformance', async () => {
  await assertTeamBackendAdapterObjectStoreConformance(
    createMockKnowledgeTeamBackendAdapter
  );
});

test('mock team backend adapter satisfies metadata index conformance', async () => {
  await assertTeamBackendAdapterMetadataIndexConformance(
    createMockKnowledgeTeamBackendAdapter
  );
});
