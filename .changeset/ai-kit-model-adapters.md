---
"@templatical/ai-kit": minor
---

First-party model adapters

- `@templatical/ai-kit/adapters/anthropic`, `/adapters/openai` and `/adapters/vercel` export `createAnthropicAdapter`, `createOpenAiAdapter` (Chat Completions) and `createVercelAdapter`, each an `AiModelAdapter`. You pass the client (`new Anthropic()`, `new OpenAI()`, `new AzureOpenAI()`) or the AI SDK model. `@anthropic-ai/sdk`, `openai` and `ai` are optional peers.
- All three take image Blobs, PDF Blobs and image URLs. A 429 rejects with `ThrottledError`, a refusal with `ai_provider_error`, and a tool call cut off at the token limit with `ai_output_invalid`. The Anthropic adapter caches the system prompt by default (`cache: false` turns it off).
- `AiModelPart` gains `{ type: "state", state }`, and the assistant `AiModelMessage` gains `state`: an adapter's own record of a step, such as the model's thinking, which `runEditingTurn` hands back on the next step.
- `AiUsage` gains `cacheReadInputTokens` and `cacheWriteInputTokens`. `inputTokens` counts only the uncached input.
