// A minimal client for OpenAI-compatible chat completion endpoints with tool calling.
// Point it at a self-hosted open model (vLLM, Ollama, LocalAI...) or any provider you are allowed to use.
import type { Config } from '../../config.js';

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmToolCall { id: string; name: string; arguments: string }

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface LlmReply { content: string | null; toolCalls: LlmToolCall[] }

export interface LlmClient {
  chat(messages: LlmMessage[], tools: LlmToolDef[]): Promise<LlmReply>;
}

export class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    private timeoutMs: number,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async chat(messages: LlmMessage[], tools: LlmToolDef[]): Promise<LlmReply> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: tools.map((t) => ({ type: 'function', function: t })),
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`llm responded ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const msg = json.choices?.[0]?.message;
    if (!msg) throw new Error('llm returned no message');
    return {
      content: msg.content ?? null,
      toolCalls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
    };
  }
}

export function createLlm(cfg: Config): LlmClient | null {
  if (!cfg.llmEnabled) return null;
  return new OpenAiCompatibleClient(cfg.LLM_BASE_URL, cfg.LLM_API_KEY, cfg.LLM_MODEL, cfg.LLM_TIMEOUT_MS);
}
