import {
  buildKnowledgeTeamBackendAdapterDescriptor,
  type KnowledgeTeamBackendAdapter
} from './team-backend-adapter.ts';
import {
  createMockS3CompatibleKnowledgeArtifactMetadataIndex,
  createMockS3CompatibleKnowledgeArtifactStore,
  type KnowledgeTeamArtifactMetadataIndex,
  type KnowledgeTeamArtifactStore
} from './team-artifact-store.ts';

export function createMockKnowledgeTeamBackendAdapter(input: {
  name?: string;
  artifactStore?: KnowledgeTeamArtifactStore;
  metadataIndex?: KnowledgeTeamArtifactMetadataIndex;
} = {}): KnowledgeTeamBackendAdapter {
  const artifactStore = input.artifactStore ?? createMockS3CompatibleKnowledgeArtifactStore();
  const metadataIndex = input.metadataIndex ?? createMockS3CompatibleKnowledgeArtifactMetadataIndex();
  const descriptor = buildKnowledgeTeamBackendAdapterDescriptor({
    name: input.name ?? 'mock-team-cache',
    backendKind: 'mock-s3-compatible'
  });

  if (artifactStore.backendKind !== descriptor.backendKind || metadataIndex.backendKind !== descriptor.backendKind) {
    throw new Error('Mock knowledge team backend adapter components must use mock-s3-compatible backend kind.');
  }

  return {
    descriptor,
    artifactStore,
    metadataIndex
  };
}
