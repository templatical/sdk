import type { AiToolDefinition } from "./tool";

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
  | { role: "assistant"; content: string; toolCalls?: AiModelToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type AiModelPart =
  | { type: "text"; text: string }
  | ({ type: "tool-call" } & AiModelToolCall)
  | { type: "usage"; inputTokens: number; outputTokens: number };

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Your model, behind one method: stream a reply to `messages` with `system` as
 * the system prompt and `tools` offered. About twenty lines for the Vercel AI
 * SDK, OpenAI or Anthropic (see the guide). Honour `signal`.
 */
export interface AiModelAdapter {
  stream(input: {
    system: string;
    messages: AiModelMessage[];
    tools: AiToolDefinition[];
    signal?: AbortSignal;
  }): AsyncIterable<AiModelPart>;
}
