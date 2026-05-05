export type LLMProvider = 'openai-compatible';
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

export const OPENAI_COMPATIBLE_PROVIDER_CAPABILITIES: LLMProviderCapabilities = {
  provider: 'openai-compatible',
  transport: 'chat-completions',
  endpointPath: '/chat/completions',
  responseFormat: 'json-object',
  supportsJsonObject: true,
  supportsStreaming: false
};

export function resolveLLMProviderCapabilities(provider: LLMProvider): LLMProviderCapabilities {
  switch (provider) {
    case 'openai-compatible':
      return OPENAI_COMPATIBLE_PROVIDER_CAPABILITIES;
  }
}
