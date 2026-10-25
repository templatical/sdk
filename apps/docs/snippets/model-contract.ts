import type { AiToolDefinition } from "@templatical/ai-kit/server";

/** A design file or an image URL attached to a user message. */
export type AiModelAttachment =
  | { kind: "image" | "pdf"; mediaType: string; data: Blob }
  | { kind: "image-url"; url: string };

export interface AiModelToolCall {
  id: string;
  name: string;
  /** The tool's arguments: a JSON string of the arguments object, or the object. */
  input: string | Record<string, unknown>;
}

export type AiModelMessage =
  | { role: "user"; content: string; attachments?: AiModelAttachment[] }
  | {
      role: "assistant";
      content: string;
      toolCalls?: AiModelToolCall[];
      /** What the adapter yielded as `state` for this step; it replays its own. */
      state?: unknown;
    }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export interface AiUsage {
  /** Input tokens billed at the full rate: not read from or written to a cache. */
  inputTokens: number;
  outputTokens: number;
  /** Input tokens read from the provider's prompt cache, when it reports them. */
  cacheReadInputTokens?: number;
  /** Input tokens written to the provider's prompt cache, when it reports them. */
  cacheWriteInputTokens?: number;
}

export type AiModelPart =
  | { type: "text"; text: string }
  | ({ type: "tool-call" } & AiModelToolCall)
  /** Opaque to the kit: the adapter's own record of the step (e.g. thinking), JSON-safe. */
  | { type: "state"; state: unknown }
  | ({ type: "usage" } & AiUsage);

/**
 * Your model, behind one method: stream a reply to `messages` with `system` as
 * the system prompt and `tools` offered. `@templatical/ai-kit/adapters/*`
 * implements it for Anthropic, OpenAI and the Vercel AI SDK. Honour `signal`.
 */
export interface AiModelAdapter {
  stream(input: {
    system: string;
    messages: AiModelMessage[];
    tools: AiToolDefinition[];
    signal?: AbortSignal;
  }): AsyncIterable<AiModelPart>;
}
