import type { LLMClientConfig } from './config.ts';
import {
  resolveLLMProviderCapabilities,
  type LLMProvider,
  type LLMProviderCapabilities
} from './providers.ts';

export interface LLMProviderMessage {
  role: 'system' | 'user';
  content: string;
}

export interface LLMProviderRequest {
  url: string;
  init: RequestInit;
}

export interface LLMProviderAdapter {
  provider: LLMProvider;
  capabilities: LLMProviderCapabilities;
  buildRequest(config: LLMClientConfig, messages: LLMProviderMessage[]): LLMProviderRequest;
  extractMessageContent(body: unknown): string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class OpenAICompatibleProviderAdapter implements LLMProviderAdapter {
  readonly provider = 'openai-compatible';
  readonly capabilities = resolveLLMProviderCapabilities(this.provider);

  buildRequest(config: LLMClientConfig, messages: LLMProviderMessage[]): LLMProviderRequest {
    return {
      url: `${config.baseUrl}${this.capabilities.endpointPath}`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          response_format: this.capabilities.supportsJsonObject
            ? {
                type: 'json_object'
              }
            : undefined,
          stream: this.capabilities.supportsStreaming,
          messages
        })
      }
    };
  }

  extractMessageContent(body: unknown): string | null {
    if (!isRecord(body) || !Array.isArray(body.choices)) {
      return null;
    }

    const firstChoice = body.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
      return null;
    }

    const content = firstChoice.message.content;
    return typeof content === 'string' && content.length > 0 ? content : null;
  }
}

export function createLLMProviderAdapter(provider: LLMProvider): LLMProviderAdapter {
  switch (provider) {
    case 'openai-compatible':
      return new OpenAICompatibleProviderAdapter();
    default:
      throw new Error(`Unsupported LLM provider adapter "${String(provider)}".`);
  }
}
