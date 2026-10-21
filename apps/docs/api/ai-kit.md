---
title: "@templatical/ai-kit"
description: The AI wire, an HTTP provider, a server kit with prompts and tools, and a conformance suite. MIT.
---

# @templatical/ai-kit

::: code-group

```bash [npm]
npm install @templatical/ai-kit
```

```bash [pnpm]
pnpm add @templatical/ai-kit
```

```bash [yarn]
yarn add @templatical/ai-kit
```

```bash [bun]
bun add @templatical/ai-kit
```

:::

MIT, with no LLM SDK and no Node-only API: Web Streams and `fetch`, so the same code runs in Node, Deno, Bun, Cloudflare Workers and browsers.

## Client

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  credentials: 'include',
  features: { design: false, conversation: false },
});
```

| Option | |
| --- | --- |
| `baseUrl` | Where the wire's routes live |
| `headers` | Your auth headers, or a function (async for a token refresh) called per request |
| `credentials` | `fetch`'s `credentials`, for cookie auth |
| `features` | `false` turns a member off, `conversation` included |

It parses the event stream, rejects with `SdkError`s (`ThrottledError` for a 429, `CollaborationConflict` for an operation refusal), and, because a stream is one-way, ends a turn whose operations the editor refused by aborting the request: the turn rejects with that operation's code and "The template changed while the AI was working."

## Server

```ts
import {
  aiErrorResponse,
  aiEventStream,
  applyOperationsTool,
  buildChatRequest,
  checkRewrite,
  createEditingSession,
  editingInstructions,
  normalizeScoringResult,
  parseSuggestions,
  readAiRequest,
  runEditingTurn,
} from '@templatical/ai-kit/server';
```

| Export | |
| --- | --- |
| `editingInstructions` | The editing system prompt: the rules, the [operations](/api/operations) and the template schema |
| `rewriteInstructions`, `scoreInstructions`, `suggestionsInstructions`, `designInstructions` | The other prompts |
| `buildEditingPrompt`, `buildChatRequest`, `buildFixRequest`, `buildDesignRequest`, `buildRewritePrompt`, `buildScorePrompt`, `buildSuggestionsPrompt` | Per-request prompts |
| `applyOperationsTool` | The one tool: `apply_operations`, its `ops` a JSON string |
| `createEditingSession` | A turn's working copy: checks each call (shape, the 100-operation cap, no custom, slot or wrapper blocks, declared merge tags, the engine, a size cap) and answers a sentence the model can act on |
| `runEditingTurn` | The reference loop over an `AiModelAdapter`, at most three model calls |
| `aiEventStream` | The event-stream `Response` for any Fetch-API server |
| `aiErrorResponse`, `aiJsonResponse` | Errors before the stream, and JSON answers, with the wire's header |
| `readAiRequest` | A wire request, parsed and checked |
| `checkRewrite`, `buildRewriteRepairPrompt`, `normalizeScoringResult`, `parseSuggestions` | Output checks |
| `scoringResultSchema`, `suggestionsSchema` | JSON schemas for structured output |

There is no HTML sanitizer in the kit. The editor sanitizes the rewrite preview and the HTML applied by Replace. HTML blocks the AI writes keep their markup unchanged; follow the [server-side sanitizing advice before saving or sending](/guide/blocks#html).

### Model adapters

`runEditingTurn` calls your model through one method:

```ts
interface AiModelAdapter {
  stream(input: {
    system: string;
    messages: AiModelMessage[];
    tools: AiToolDefinition[];
    signal?: AbortSignal;
  }): AsyncIterable<
    | { type: 'text'; text: string }
    | { type: 'tool-call'; id: string; name: string; input: string | Record<string, unknown> }
    | { type: 'usage'; inputTokens: number; outputTokens: number }
  >;
}
```

[Bring your own AI backend](/guide/bring-your-own-ai#model-adapters) has adapters for the Vercel AI SDK, OpenAI and Anthropic. The Vercel AI SDK and OpenAI examples are text-only; their client configuration turns off design and stored conversation history. The Anthropic example also maps image and PDF attachments.

## Testing

```ts
import {
  createMockAiProvider,
  runAiEvalSet,
  runAiProviderConformance,
  runAiWireConformance,
} from '@templatical/ai-kit/testing';

const report = await runAiWireConformance({ baseUrl: 'http://localhost:8787/ai' });
for (const check of report.checks) console.log(check.ok ? 'ok ' : 'FAIL', check.name, check.detail);
```

- `runAiProviderConformance(provider)` drives a provider as the editor would and checks the contract; `runAiWireConformance({ baseUrl, headers, features })` does the same over the wire, plus the wire's own rules, for a backend in any language.
- `createMockAiProvider(script)` plays recorded streams, for your UI tests; `AI_RECORDINGS` is the playground's.
- `runAiEvalSet({ runTurn, model })` runs the 32-case test set and reports a pass rate; `evalTurnWith(adapter)` builds `runTurn` from the kit's own loop.

## Files

`@templatical/ai-kit/prompts/*.md`, `@templatical/ai-kit/schema/*.json` and `@templatical/ai-kit/eval/*.json` (with `MANIFEST.sha256`) are the prompts, schemas and test set as files, for a backend in another language. The editing system prompt is `editing.md`, then `"\n\n# Operations\n\n"` and `operations.md`, then `"\n\n# Template content schema\n\n"` and `template-content.schema.json`.

## The wire

Every request and response carries `Templatical-AI-Wire: 1`; turns, Undo, Redo and replay settlement carry `X-Templatical-Session`. A cross-origin backend allows `Templatical-AI-Wire`, `X-Templatical-Session` and its auth header in `Access-Control-Allow-Headers` for preflight, and exposes `Templatical-AI-Wire` in `Access-Control-Expose-Headers`. Routes are relative to your base URL; `{t}` is the template id.

| Route | Request | Response |
| --- | --- | --- |
| `POST /templates/{t}/ai/generate` | JSON `{ message, selectedBlockId, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/fix-finding` | JSON `{ finding, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/generate-from-design` | multipart: `prompt?`, `image_upload` or `pdf_upload`, `mergeTags` and `content` as JSON strings, `revision` | SSE |
| `POST /templates/{t}/ai/rewrite-text` | JSON `{ html, preset, language, instruction, mergeTags }` | SSE: `text`*, `done { html }` |
| `POST /templates/{t}/ai/score` | JSON `{ lintFindings, content }` | SSE: `done { result }` |
| `POST /templates/{t}/ai/suggestions` | JSON `{ mergeTags, content }` | SSE: `done { suggestions }` |
| `GET /templates/{t}/ai/conversation-messages` | — | JSON `{ data: AiChatMessage[] }` |
| `POST /templates/{t}/ai/messages/{m}/undo`, `…/redo` | — | JSON `{ data: { operations, replayId } }` or `{ data: { batchId, revision } }` |
| `POST /templates/{t}/ai/messages/{m}/replays/{replayId}` | JSON `{ direction, applied }`, `X-Templatical-Session` | 204 |
| `DELETE /templates/{t}/ai/conversation` | — | 204 |

**Events** are `data: {json}` lines, each with a `type`; `: ping` comments keep the connection alive. `text { text }`; `operations { ops }` (the editor applies them); `applied { batchId, revision, operationCount }`; `done { messageId }` (turns: a string, or `null` without history), `done { html }` (rewrite), `done { result }` (score) or `done { suggestions }` (suggestions); `error { code, message }`. `done` or `error` is the last event.

**Errors before the stream** are JSON `{ message, code, …details }` with the status of the code: `feature_unavailable` and `limit_reached` 403, `rate_limited` 429 with `Retry-After`, `ai_turn_running` 409, `content_too_large` 413, `ai_output_invalid` 422, `ai_provider_error` 502, `not_found` 404, an operation's code 409 (`invalid_operation` 422). A validation failure is a 422 `{ message }`.

A message's `batches` are `{ batchId, revision, operationCount }`; a batch the editor applied itself has no backend revision, so store `revision: null` for it.


`AI_LIMITS.contentMaxBytes` caps JSON-serialized template content at 200,000 UTF-8 bytes; `readAiRequest` refuses larger content with `content_too_large` (413). `selectedBlockId` and the session id are limited to 200 characters. Character limits count Unicode code points.
