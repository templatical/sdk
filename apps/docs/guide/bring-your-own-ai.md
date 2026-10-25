---
title: Bring your own AI backend
description: Serve the editor's AI from your own backend and model with @templatical/ai-kit — a Fetch-API server, first-party model adapters for Anthropic, OpenAI and the Vercel AI SDK, and how to check it works.
---

# Bring your own AI backend

The editor's [AI](/backend/ai) talks to your backend through `createHttpAiProvider`. This page builds that backend with `@templatical/ai-kit/server` on any Fetch-API runtime (Next.js route handlers, Hono, Cloudflare Workers, Deno, Bun; Express through an adapter) and one model adapter.

## The server

```ts
import { AI_ERROR_MESSAGES } from '@templatical/ai-kit';
import {
  aiErrorResponse,
  aiEventStream,
  aiJsonResponse,
  buildAltTextRequest,
  buildAltTextRepairRequest,
  checkAltText,
  checkAltTextAnswer,
  buildChatRequest,
  buildFixRequest,
  buildRewritePrompt,
  buildRewriteRepairPrompt,
  checkRewrite,
  readAiRequest,
  rewriteInstructions,
  runEditingTurn,
  SdkError,
  type AiModelAdapter,
} from '@templatical/ai-kit/server';
import { model } from './model'; // one of the model adapters below

async function complete(system: string, prompt: string, signal: AbortSignal, onText?: (t: string) => void) {
  let text = '';
  for await (const part of model.stream({ system, messages: [{ role: 'user', content: prompt }], tools: [], signal })) {
    if (part.type === 'text') {
      text += part.text;
      onText?.(part.text);
    }
  }
  return text;
}

export async function handle(request: Request): Promise<Response> {
  // Authenticate the signed-in user before reading the request.
  let read;
  try {
    read = await readAiRequest(request);
  } catch (error) {
    return aiErrorResponse(error);
  }
  if (!read) return aiJsonResponse({ message: 'Not found.', code: 'not_found' }, 404);
  // Authorize read.template and any message id for this user on every AI route.

  switch (read.route) {
    case 'generate':
    case 'fixFinding': {
      const turn = read;
      return aiEventStream(async (stream) => {
        await runEditingTurn({
          request: {
            content: turn.body.content,
            revision: turn.body.revision,
            mergeTags: turn.body.mergeTags,
            sessionId: turn.sessionId,
            selectedBlockId: turn.route === 'generate' ? turn.body.selectedBlockId : null,
            request:
              turn.route === 'generate'
                ? buildChatRequest(turn.body.message, { hasAttachments: turn.body.attachments.length > 0 })
                : buildFixRequest(turn.body.finding),
            attachments: turn.route === 'generate'
              ? turn.body.attachments.map(({ kind, file }) => ({ kind, mediaType: file.type, data: file }))
              : [],
          },
          model,
          write: stream.send,
          signal: stream.signal,
        });
        stream.send({ type: 'done', messageId: null });
      });
    }
    case 'altText': {
      const body = read.body;
      // Authorize the template and block as on every route. The model provider
      // fetches the image URL; resolve private or signed media in your backend.
      const built = buildAltTextRequest({ ...body, templateId: read.template, sessionId: read.sessionId ?? '' });
      return aiEventStream(async (stream) => {
        let answer = '';
        for await (const part of model.stream({ ...built, tools: [], signal: stream.signal })) {
          if (part.type === 'text') answer += part.text;
        }
        const check = checkAltTextAnswer(answer, { maxLength: body.maxLength });
        if (!check.ok) {
          const repair = buildAltTextRepairRequest(built, answer, check.reason, body.maxLength);
          answer = '';
          for await (const part of model.stream({ ...repair, tools: [], signal: stream.signal })) {
            if (part.type === 'text') answer += part.text;
          }
        }
        stream.send({ type: 'done', alt: checkAltText(answer, { maxLength: body.maxLength }) });
      });
    }
    case 'rewriteText': {
      const body = read.body;
      const prompt = buildRewritePrompt(body);
      return aiEventStream(async (stream) => {
        let check = checkRewrite(await complete(rewriteInstructions, prompt, stream.signal, (text) => stream.send({ type: 'text', text })), body.html, body.mergeTags);
        if (!check.ok) {
          check = checkRewrite(await complete(rewriteInstructions, buildRewriteRepairPrompt(prompt, check.reason), stream.signal), body.html, body.mergeTags);
        }
        if (!check.ok) throw new SdkError(AI_ERROR_MESSAGES.ai_output_invalid, 422, 'ai_output_invalid');
        stream.send({ type: 'done', html: check.html });
      });
    }
    default:
      // No stored history here: the editor keeps the chat in memory.
      return aiJsonResponse({ message: 'Not found.', code: 'not_found' }, 404);
  }
}
```

In the editor, turn history off to match: `createHttpAiProvider({ baseUrl: '/api/ai', features: { conversation: false } })`. To store history, keep each turn's messages and `result.batches[].inverse` (last batch first) and implement the conversation routes including `settleReplay`, as described under [History](/backend/ai#history). Authorize the template id and message ids against the signed-in user before answering every AI route, conversation routes included.

The generate route accepts JSON without attachments and multipart with attachments. Set your framework's whole-body request limit above 10 MB plus the 200,000-byte template content and multipart overhead, or about 300 kB when chat attachments are disabled. The kit checks content and file sizes after reading them; the framework limit bounds buffering.

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { conversation: false },
});
```

The import shortcut uses this same chat route; the author sends the prefilled request after choosing the files.

## Model adapters

`@templatical/ai-kit` ships one adapter per SDK. Each maps the kit's messages, tools and files to its SDK and back. Install the kit plus the SDK of the adapter you import. The SDKs are optional peers, so nothing else installs. Save one of these as `model.ts`:

### Anthropic

<<< @/snippets/model-anthropic.ts

### OpenAI

<<< @/snippets/model-openai.ts

### Vercel AI SDK

<<< @/snippets/model-vercel.ts

| Adapter | Import | Install | Pass |
| --- | --- | --- | --- |
| Anthropic | `createAnthropicAdapter` from `@templatical/ai-kit/adapters/anthropic` | `@anthropic-ai/sdk` | `new Anthropic()` |
| OpenAI | `createOpenAiAdapter` from `@templatical/ai-kit/adapters/openai` | `openai` | `client`: `new OpenAI()`, `new AzureOpenAI()`, or `new OpenAI({ baseURL })` for a server that implements Chat Completions |
| Vercel AI SDK | `createVercelAdapter` from `@templatical/ai-kit/adapters/vercel` | `ai`, plus your provider package | `model`: an AI SDK model or a gateway model id |

### Adapter options

| Option | Type | Default | Adapters |
| --- | --- | --- | --- |
| `client` | Your SDK client | Required | Anthropic, OpenAI |
| `model` | `string` (Anthropic, OpenAI) or an AI SDK `LanguageModel` (Vercel) | Required; no default model | All |
| `maxTokens` | `number` | 16,000 for Anthropic; the API's own for OpenAI and Vercel | All |
| `cache` | `boolean` | `true` | Anthropic |
| `params` | The SDK's other request fields, excluding the adapter-owned fields in [the options types](/api/ai-kit#model-adapters) | None | All |

All three adapters take chat, fix, rewrite and alt text. They accept image Blobs, PDF Blobs and image URLs, so `chatAttachments: true` works with each of them.

### What the adapters handle

- **Thinking across steps.** The Anthropic and Vercel adapters return the model's thinking as `state`. `runEditingTurn` puts it on the step's assistant message, and the adapter sends it back unchanged on the next step. A loop of your own should keep `state` on its assistant messages too. Without it the turn still works, but the model works out its reasoning again.
- **Prompt caching.** With `cache` on, the Anthropic adapter asks the API to cache the end of the system prompt and the conversation so far. Cache reads happen when a later request repeats the cached prefix within the cache's lifetime. `cacheReadInputTokens` and `cacheWriteInputTokens` in `usage` show what was read and written; `inputTokens` counts the uncached input only. OpenAI caches on its side, and the OpenAI adapter reports those reads.
- **Errors:**
  - A provider's 429 rejects with `ThrottledError`, whose `retryAfterMs` comes from `retry-after`.
  - A refusal or content filter rejects with `ai_provider_error`.
  - Output cut off at the token limit while a tool call was being written rejects with `ai_output_invalid`.
  - Any other provider error passes through unchanged, so your logs keep it. The wire reports it as `ai_provider_error`.

### Limits of the adapters

- A request too long for the model's context window reports `ai_provider_error`, not `content_too_large`.
- The OpenAI adapter uses Chat Completions, so it carries no reasoning between steps.
- Vertex AI and Claude on AWS clients aren't covered by the type tests, so they aren't listed here.
- Through the Vercel adapter, PDF support depends on your AI SDK provider package.

### Your own adapter

Any other model plugs in by implementing `AiModelAdapter`, the [model contract](/api/ai-kit#model-adapters): one `stream()` that yields text, tool calls, optional state and usage, and honours `signal`.

## Backend conformance and model evaluation

The [testing reference](/api/ai-kit#testing) documents both conformance signatures and every option (`templateId`, `headers`, `timeoutMs`, `callTimeoutMs`, `features`). With an authenticated `POST /api/templates` that accepts `{ name, content }` and returns `{ id }`, this Node.js 24 example checks a new disposable template. Save it as `check-ai-backend.ts`, set `AI_TEST_TOKEN`, and run `node check-ai-backend.ts`. `AI_BASE_URL` and `AI_TEMPLATES_URL` override the URLs. Its flags match the stateless server above, with chat attachments on.

The backend must answer multipart chat with a PNG attachment with non-empty text and reject five attachments with a JSON 422 response containing `message`.

<<< @/snippets/check-ai-backend.ts

The alt-text probe uses `blockId: "conformance-image"` and defaults to `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL`, a text-free image ([default and override](/api/ai-kit#testing)). The example adds that image to the disposable template so your backend can check block membership. Keep it available during the suite; do not apply this test setup to production templates.

Both conformance suites can spend tokens and persist batches. With conversation enabled they change replay state and clear history through `clear` when available. Remove the test template through your store afterwards. Failures print per check and produce a non-zero exit.

For a Node.js 24 run, save this as `evaluate.ts` next to your `model.ts`. Install `@templatical/ai-kit`, `@templatical/types`, `@templatical/quality` and your SDK. Start your backend, then run `node evaluate.ts`. The adapter must accept image URLs and PNG and PDF attachments; all three first-party adapters do.

<<< @/snippets/evaluate-model.ts

The wire suite checks your routes as the editor uses them. The eval set checks editing, chat attachments, alt text and lint fixes against your model. `lintCheck` returns the `ruleId` values from `lintTemplate(content)`; the kit has no dependency on `@templatical/quality`. `loadFile` reads attachments from the installed package. Without `loadFile`, the runner fetches them from the public release URL.

Without `runAltText`, alt-text cases are skipped. Without `lintCheck`, cases with a `lintGone` check are skipped. `skipped` counts these cases; `total` and `rate` count only cases that ran. The default `minPassRate` is 90; `rate` is a whole percent rounded down.

Default image URLs use `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}`, with `@templatical/ai-kit`'s own version. For an unreleased build, pass `evalAltTextWith(model, { imageUrl: (file) => new URL(file, 'https://preview.example.com/eval/').href })` with your public fixture URL. Every eval case that runs calls your model and costs tokens.

## Subject lines

The SDK has no subject field and no subject member on the AI provider. The host owns the subject. Call `editor.getContent()` and post it to your own backend, which asks your model for subject lines. This browser code needs a `<div id="editor" style="height: 100vh"></div>` container and your templates API:

<<< @/snippets/subject-lines-client.ts

Route `POST /api/subject-lines` to this Fetch-API handler and save one of the adapters above beside it as `model.ts`. The response belongs to the host, outside template JSON and AI history:

<<< @/snippets/subject-lines-server.ts

Check that the response contains `subjectLines` and `editor.getContent()` stays unchanged. The host displays the suggestions in its own subject field; each call spends model tokens.

## Data and responsibility

The AI runs on your provider, under your terms with it. Templatical sends nothing anywhere: the editor talks to your backend only, and your backend decides what reaches which model. The template content, the merge-tag list and the user's prompts go to the model you call; tell your users so in your privacy notice, and pick a provider and region your data-processing agreements cover.

## Other languages

A backend in PHP, Python, Go or Ruby follows [the wire](/api/ai-kit#the-wire) and reads prompts and schemas from the package's files (`prompts/*.md`, `schema/*.json`). Copy the entire `eval/` folder recursively, preserving relative paths and `MANIFEST.sha256`, to include the cases, templates, images, designs and HTML sources. Run `runAiWireConformance` from Node to check your backend's routes.
