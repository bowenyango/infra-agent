import { listLLMProviderCatalog, type LLMProvider } from '../model/providers.ts';
import type { InfraDomainId } from '../types/repository.ts';

export interface PlannerProviderCatalogReport {
  kind: 'infra-agent.planner-provider-catalog';
  schemaVersion: 1;
  mutationAllowed: false;
  liveProviderCheck: false;
  scope: {
    plannerOnly: true;
    domains: InfraDomainId[];
  };
  commands: Array<'agent' | 'doctor'>;
  summary: {
    providerCount: number;
    supportedProviderCount: number;
  };
  providers: Array<{
    id: LLMProvider;
    displayName: string;
    status: 'supported';
    capabilities: {
      transport: string;
      endpointPath: string;
      responseFormat: string;
      supportsJsonObject: boolean;
      supportsStreaming: boolean;
    };
    defaults: {
      model: string;
      baseUrl: string;
    };
    apiKeyEnv: string[];
    configEnv: {
      provider: string;
      model: string;
      baseUrl: string[];
    };
    cliFlags: {
      provider: string[];
      model: string[];
      baseUrl: string[];
    };
  }>;
}

export function buildPlannerProviderCatalogReport(): PlannerProviderCatalogReport {
  const providers = listLLMProviderCatalog().map(provider => ({
    id: provider.id,
    displayName: provider.displayName,
    status: provider.status,
    capabilities: {
      transport: provider.capabilities.transport,
      endpointPath: provider.capabilities.endpointPath,
      responseFormat: provider.capabilities.responseFormat,
      supportsJsonObject: provider.capabilities.supportsJsonObject,
      supportsStreaming: provider.capabilities.supportsStreaming
    },
    defaults: {
      model: provider.defaults.model,
      baseUrl: provider.defaults.baseUrl
    },
    apiKeyEnv: [
      'INFRA_AGENT_OPENAI_API_KEY',
      'OPENAI_API_KEY'
    ],
    configEnv: {
      provider: 'INFRA_AGENT_LLM_PROVIDER',
      model: 'INFRA_AGENT_MODEL',
      baseUrl: [
        'INFRA_AGENT_OPENAI_BASE_URL',
        'OPENAI_BASE_URL'
      ]
    },
    cliFlags: {
      provider: ['--llm-provider openai-compatible'],
      model: ['--model <name>', '--llm-model <name>'],
      baseUrl: ['--openai-base-url <url>', '--llm-base-url <url>']
    }
  }));

  return {
    kind: 'infra-agent.planner-provider-catalog',
    schemaVersion: 1,
    mutationAllowed: false,
    liveProviderCheck: false,
    scope: {
      plannerOnly: true,
      domains: ['helm', 'pulumi', 'terraform']
    },
    commands: ['agent', 'doctor'],
    summary: {
      providerCount: providers.length,
      supportedProviderCount: providers.filter(provider => provider.status === 'supported').length
    },
    providers
  };
}
