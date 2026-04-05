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

export class LLMModelClient implements ModelClient {
  readonly name: string;

  constructor(private readonly config: LLMClientConfig) {
    this.name = `llm-model-client:${config.model}`;
  }

  async decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        response_format: {
          type: 'json_object'
        },
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
      })
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
