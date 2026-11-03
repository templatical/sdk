# @templatical/ai-kit

## 0.54.0

### Patch Changes

- @templatical/types@0.54.0

## 0.53.0

### Minor Changes

- cef9348: Translation over your own backend

  Breaking changes:

  - TypeScript producers must set the now required `AiRequestBase.locale` and `AiRewriteRequest.locale` to the active language, or `null` in the default view, and `CollaborationRemoteChange.locale` to the first locale operation's language in a batch, excluding `setDefaultLocale`, or `null` when there is none. Code that builds these objects must set them even without localization enabled.

  Otherwise existing templates need no migration. Keep every `@templatical/*` package on the same version.

  - `createHttpTranslationProvider` and the `translate` wire route (`POST /templates/{template}/translate`), with `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance`.
  - `translateFields` requires every requested field id once with its placeholders intact, makes one repair attempt for failed fields and returns the fields that pass.
  - AI requests and prompts carry the active language as `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

  See [Translation](https://docs.templatical.com/backend/translation).

### Patch Changes

- Updated dependencies [cef9348]
  - @templatical/types@0.53.0

## 0.52.1

### Patch Changes

- Updated dependencies [2da7d6a]
  - @templatical/types@0.52.1

## 0.52.0

### Patch Changes

- Updated dependencies [9881028]
- Updated dependencies [72d142d]
  - @templatical/types@0.52.0

## 0.51.1

### Patch Changes

- @templatical/types@0.51.1

## 0.51.0

### Minor Changes

- 2162c87: First-party model adapters

  - `@templatical/ai-kit/adapters/anthropic`, `/adapters/openai` and `/adapters/vercel` export `createAnthropicAdapter`, `createOpenAiAdapter` (Chat Completions) and `createVercelAdapter`, each an `AiModelAdapter`. You pass the client (`new Anthropic()`, `new OpenAI()`, `new AzureOpenAI()`) or the AI SDK model. `@anthropic-ai/sdk`, `openai` and `ai` are optional peers.
  - All three take image Blobs, PDF Blobs and image URLs. A 429 rejects with `ThrottledError`, a refusal with `ai_provider_error`, and a tool call cut off at the token limit with `ai_output_invalid`. The Anthropic adapter caches the system prompt by default (`cache: false` turns it off).
  - `AiModelPart` gains `{ type: "state", state }`, and the assistant `AiModelMessage` gains `state`: an adapter's own record of a step, such as the model's thinking, which `runEditingTurn` hands back on the next step.
  - `AiUsage` gains `cacheReadInputTokens` and `cacheWriteInputTokens`. `inputTokens` counts only the uncached input.

### Patch Changes

- @templatical/types@0.51.0

## 0.50.0

### Minor Changes

- 61518b7: New package `@templatical/ai-kit`, MIT and with no LLM SDK dependency: the editor's AI over your own backend.

  - **Client:** `createHttpAiProvider`, an `AiProvider` over a documented REST and SSE wire. A chat message with attachments goes as multipart, with one `attachment` part per file.
  - **Server kit:** `readAiRequest`, the prompts, the `apply_operations` tool (`applyOperationsTool`), `runEditingTurn`, `aiEventStream` for any Fetch API server, error responses, and the output checks `checkRewrite` and `checkAltText`.
  - **Test kit:** `runAiProviderConformance` and `runAiWireConformance`; `createMockAiProvider` with recorded streams (`AI_RECORDINGS`); and an eval set of edit, fix and alt-text cases, run with `runAiEvalSet`, `evalTurnWith` and `evalAltTextWith`. The eval fixtures ship in `eval/`.

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0
