import type { AgentDecision, AgentRuntimeState } from '../types/agent.ts';
import type { ModelClient } from './ModelClient.ts';
import type { LLMClientConfig } from './config.ts';
import { parsePlannerDecision } from './decision-parser.ts';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from './prompt.ts';

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

type FetchTransport = typeof fetch;

export class LLMModelClient implements ModelClient {
  readonly name: string;
  private readonly config: LLMClientConfig;
  private readonly fetchTransport: FetchTransport;

  constructor(config: LLMClientConfig, fetchTransport: FetchTransport = fetch) {
    this.config = config;
    this.fetchTransport = fetchTransport;
    this.name = `llm-model-client:${config.model}`;
  }

  async decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision> {
    const requestBody = {
      model: this.config.model,
      response_format: this.config.providerCapabilities.responseFormat === 'json-object'
        ? {
            type: 'json_object'
          }
        : undefined,
      stream: this.config.providerCapabilities.supportsStreaming,
      messages: [
        {
          role: 'system',
          content: buildPlannerSystemPrompt()
        },
        {
          role: 'user',
          content: buildPlannerUserPrompt(runtime)
        }
      ]
    };
    const response = await this.fetchTransport(`${this.config.baseUrl}${this.config.providerCapabilities.endpointPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM planner request failed with status ${response.status}: ${text}`);
    }

    const body = await response.json() as ChatCompletionsResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM planner response did not include message content.');
    }

    return parsePlannerDecision(content, runtime);
  }
}
