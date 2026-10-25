import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
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
  createAnthropicAdapter({
    client: new AnthropicBedrock({ awsRegion: "eu-central-1" }),
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
  createVercelAdapter({ model: languageModel }),
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
  // @ts-expect-error The adapter owns `messages`.
  params: { messages: [] },
});
createAnthropicAdapter({
  client: new Anthropic({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `max_tokens` (use maxTokens).
  params: { max_tokens: 1 },
});
createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `stream`.
  params: { stream: false },
});
createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter owns `tools`.
  params: { tools: [] },
});
createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `instructions`.
  params: { instructions: "x" },
});
createVercelAdapter({
  model: languageModel,
  // @ts-expect-error The adapter owns `abortSignal`.
  params: { abortSignal: new AbortController().signal },
});
createOpenAiAdapter({
  client: new OpenAI({ apiKey: "k" }),
  model: "m",
  // @ts-expect-error The adapter handles one completion.
  params: { n: 2 },
});
