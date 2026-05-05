export type LLMProvider = 'openai-compatible';
export type LLMProviderCatalogStatus = 'supported';
export type LLMProviderTransport = 'chat-completions';
export type LLMProviderResponseFormat = 'json-object';

export const DEFAULT_LLM_MODEL = 'gpt-5-mini';
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';

export interface LLMProviderCapabilities {
  provider: LLMProvider;
  transport: LLMProviderTransport;
  endpointPath: '/chat/completions';
  responseFormat: LLMProviderResponseFormat;
  supportsJsonObject: boolean;
  supportsStreaming: boolean;
}

export interface LLMProviderCatalogEntry {
  id: LLMProvider;
  displayName: string;
  status: LLMProviderCatalogStatus;
  capabilities: LLMProviderCapabilities;
  defaults: {
    model: string;
    baseUrl: string;
  };
}

export const OPENAI_COMPATIBLE_PROVIDER_CAPABILITIES: LLMProviderCapabilities = {
  provider: 'openai-compatible',
  transport: 'chat-completions',
  endpointPath: '/chat/completions',
  responseFormat: 'json-object',
  supportsJsonObject: true,
  supportsStreaming: false
};

const OPENAI_COMPATIBLE_PROVIDER_CATALOG_ENTRY: LLMProviderCatalogEntry = {
  id: 'openai-compatible',
  displayName: 'OpenAI-compatible chat completions',
  status: 'supported',
  capabilities: OPENAI_COMPATIBLE_PROVIDER_CAPABILITIES,
  defaults: {
    model: DEFAULT_LLM_MODEL,
    baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL
  }
};

function cloneProviderCapabilities(capabilities: LLMProviderCapabilities): LLMProviderCapabilities {
  return {
    provider: capabilities.provider,
    transport: capabilities.transport,
    endpointPath: capabilities.endpointPath,
    responseFormat: capabilities.responseFormat,
    supportsJsonObject: capabilities.supportsJsonObject,
    supportsStreaming: capabilities.supportsStreaming
  };
}

function cloneProviderCatalogEntry(entry: LLMProviderCatalogEntry): LLMProviderCatalogEntry {
  return {
    id: entry.id,
    displayName: entry.displayName,
    status: entry.status,
    capabilities: cloneProviderCapabilities(entry.capabilities),
    defaults: {
      model: entry.defaults.model,
      baseUrl: entry.defaults.baseUrl
    }
  };
}

export function resolveLLMProviderCapabilities(provider: LLMProvider): LLMProviderCapabilities {
  switch (provider) {
    case 'openai-compatible':
      return cloneProviderCapabilities(OPENAI_COMPATIBLE_PROVIDER_CAPABILITIES);
  }
}

export function listLLMProviderCatalog(): LLMProviderCatalogEntry[] {
  return [
    cloneProviderCatalogEntry(OPENAI_COMPATIBLE_PROVIDER_CATALOG_ENTRY)
  ];
}
