import type {
  KnowledgeTeamArtifactBackendKind,
  KnowledgeTeamArtifactContentType
} from './team-artifact-keys.ts';
import type {
  KnowledgeTeamArtifactMetadataIndex,
  KnowledgeTeamArtifactStore
} from './team-artifact-store.ts';

export interface KnowledgeTeamBackendAdapterCapabilities {
  kind: 'infra-agent.knowledge-team-backend-adapter-capabilities';
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: KnowledgeTeamArtifactBackendKind;
  artifactObjectStore: boolean;
  metadataIndex: boolean;
  contentAddressedObjectKeys: true;
  contentAddressedIndexKeys: true;
  idempotentWritesRequired: true;
  explicitUploadApprovalRequired: true;
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  uploadCommand: null;
  supportedContentTypes: KnowledgeTeamArtifactContentType[];
}

export interface KnowledgeTeamBackendAdapterDescriptor {
  kind: 'infra-agent.knowledge-team-backend-adapter';
  schemaVersion: 1;
  mutationAllowed: false;
  name: string;
  backendKind: KnowledgeTeamArtifactBackendKind;
  capabilities: KnowledgeTeamBackendAdapterCapabilities;
}

export interface KnowledgeTeamBackendAdapter {
  readonly descriptor: KnowledgeTeamBackendAdapterDescriptor;
  readonly artifactStore: KnowledgeTeamArtifactStore;
  readonly metadataIndex: KnowledgeTeamArtifactMetadataIndex;
}

const SAFE_ADAPTER_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

export function isSafeKnowledgeTeamBackendAdapterName(name: string): boolean {
  return SAFE_ADAPTER_NAME_PATTERN.test(name);
}

export function buildKnowledgeTeamBackendAdapterCapabilities(
  backendKind: KnowledgeTeamArtifactBackendKind
): KnowledgeTeamBackendAdapterCapabilities {
  return {
    kind: 'infra-agent.knowledge-team-backend-adapter-capabilities',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind,
    artifactObjectStore: true,
    metadataIndex: true,
    contentAddressedObjectKeys: true,
    contentAddressedIndexKeys: true,
    idempotentWritesRequired: true,
    explicitUploadApprovalRequired: true,
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    uploadCommand: null,
    supportedContentTypes: ['application/json']
  };
}

export function buildKnowledgeTeamBackendAdapterDescriptor(input: {
  name: string;
  backendKind: KnowledgeTeamArtifactBackendKind;
}): KnowledgeTeamBackendAdapterDescriptor {
  if (!isSafeKnowledgeTeamBackendAdapterName(input.name)) {
    throw new Error('Knowledge team backend adapter name must be a safe lowercase identifier.');
  }

  return {
    kind: 'infra-agent.knowledge-team-backend-adapter',
    schemaVersion: 1,
    mutationAllowed: false,
    name: input.name,
    backendKind: input.backendKind,
    capabilities: buildKnowledgeTeamBackendAdapterCapabilities(input.backendKind)
  };
}
