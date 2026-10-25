import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { AzureOpenAI } from "openai";
import type { LanguageModel } from "ai";
import { createAnthropicAdapter } from "../src/adapters/anthropic";
import { createOpenAiAdapter } from "../src/adapters/openai";
import { createVercelAdapter } from "../src/adapters/vercel";
import type { AiModelAdapter } from "../src/server";

declare const languageModel: LanguageModel;

export const adapters: AiModelAdapter[] = [
  createAnthropicAdapter({
    client: new Anthropic({ apiKey: "k" }),
    model: "m",
  }),
  createOpenAiAdapter({ client: new OpenAI({ apiKey: "k" }), model: "m" }),
  createOpenAiAdapter({
    client: new OpenAI({ apiKey: "k", baseURL: "https://llm.example.com/v1" }),
    model: "m",
  }),
  createOpenAiAdapter({
    client: new AzureOpenAI({
      apiKey: "k",
      endpoint: "https://x.openai.azure.com",
      apiVersion: "2024-10-21",
    }),
    model: "m",
  }),
  createVercelAdapter({
    model: languageModel,
    params: { temperature: 0.5, maxRetries: 0 },
  }),
  createVercelAdapter({ model: "anthropic/claude-opus-5-5" }),
  createAnthropicAdapter({
    client: new Anthropic({ apiKey: "k" }),
    model: "m",
    params: { metadata: { user_id: "u" } },
  }),
  createOpenAiAdapter({
    client: new OpenAI({ apiKey: "k" }),
    model: "m",
    params: { reasoning_effort: "low" },
  }),
];

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `model`.
  params: { model: "x" },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `system`.
  params: { system: "x" },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `messages`.
  params: { messages: [] },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `tools`.
  params: { tools: [] },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `max_tokens`.
  params: { max_tokens: 1 },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `stream`.
  params: { stream: true },
});

createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `cache_control`.
  params: { cache_control: { type: "ephemeral" } },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `model`.
  params: { model: "x" },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `messages`.
  params: { messages: [] },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `tools`.
  params: { tools: [] },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `stream`.
  params: { stream: true },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `stream_options`.
  params: { stream_options: { include_usage: true } },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `max_completion_tokens`.
  params: { max_completion_tokens: 1 },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `max_tokens`.
  params: { max_tokens: 1 },
});

createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `n`.
  params: { n: 2 },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `model`.
  params: { model: languageModel },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `system`.
  params: { system: "x" },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `instructions`.
  params: { instructions: "x" },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `messages`.
  params: { messages: [] },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `prompt`.
  params: { prompt: "x" },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `tools`.
  params: { tools: {} },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `abortSignal`.
  params: { abortSignal: new AbortController().signal },
});

createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `maxOutputTokens`.
  params: { maxOutputTokens: 1 },
});
