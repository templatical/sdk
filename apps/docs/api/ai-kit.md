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

## Request, result and history fields

The complete provider declarations from `@templatical/types` cover requests, results, handlers and history, including `AiChatAttachment` and `AiAltTextRequest`. `conversation.list` returns messages oldest first; `createdAt` is ISO 8601. User messages have empty `batches`; an editor-applied batch has `revision: null`, a server-applied batch a numeric revision. Only user messages carry optional attachment metadata, never files.

<<< @/snippets/ai-contract.ts

### Request limits

| Field | Limit and representation |
| --- | --- |
| `content` | At most 200,000 UTF-8 bytes of serialized JSON; not proof of schema validity |
| `revision` | Non-negative integer, or `null` without collaboration |
| `message` | 1–4,000 code points, not whitespace-only |
| `selectedBlockId`, `sessionId` | At most 200 code points; selection may be `null` |
| `mergeTags` | Required `{ syntax, tags }`; `tags: []` when none are declared; at most 500 tags; syntax `liquid`, `handlebars`, `mailchimp`, `ampscript` or `custom` |
| Merge-tag fields | `value` ≤ 200, `label` ≤ 100, optional `group` ≤ 100 and `description` ≤ 200 code points; no samples or callbacks |
| Rewrite | `html` 1–20,000 code points; `instruction` ≤ 500; at least `preset` or `instruction`; `language` required for `translate` matching `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/` |
| Fix finding | [Lint fixes](#lint-fixes) gives every field limit and excluded field |
| Alt text | [Alt text](#alt-text) gives URL, context, locale and output limits |
| Attachments | [Chat attachments](#chat-attachments) gives MIME types, file-name and byte limits |
| Operation batch | 1–100 operations in order; a turn's batches form one undo step |

`mergeTags` always carries the editor's syntax (`liquid` by default), including an empty tag list. `readAiRequest` refuses missing or `null` context with status 422 and message `mergeTags must be { syntax, tags } with at most 500 tags.` The editing session and `checkRewrite` reject invented tags even when the declared list is empty; tags already in the input remain allowed. `custom` syntax is unchecked because its patterns are not sent to the backend.

## Client

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  credentials: 'include',
  features: { chatAttachments: false, conversation: false },
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
  readAiRequest,
  runEditingTurn,
} from '@templatical/ai-kit/server';
```

| Export | |
| --- | --- |
| `editingInstructions` | The editing system prompt: the rules, the [operations](/api/operations) and the template schema |
| `rewriteInstructions` | The other prompts |
| `buildEditingPrompt`, `buildChatRequest`, `buildFixRequest`, `buildRewritePrompt`, `buildAltTextRequest` | Per-request prompts |
| `applyOperationsTool` | The one tool: `apply_operations`, its `ops` a JSON string |
| `createEditingSession` | A turn's working copy: checks each call (shape, the 100-operation cap, no custom, slot or wrapper blocks, declared merge tags, the engine, a size cap) and answers a sentence the model can act on |
| `runEditingTurn` | The reference loop over an `AiModelAdapter`, at most three model calls |
| `aiEventStream` | The event-stream `Response` for any Fetch-API server |
| `aiErrorResponse`, `aiJsonResponse` | Errors before the stream, and JSON answers, with the wire's header |
| `readAiRequest` | A wire request, parsed and checked |
| `checkRewrite`, `buildRewriteRepairPrompt` | Output checks |
| `checkAltTextAnswer`, `buildAltTextRepairRequest`, `checkAltText` | Alt-text checks and one repair request |

There is no HTML sanitizer in the kit. The editor sanitizes the rewrite preview and the HTML applied by Replace. HTML blocks the AI writes keep their markup unchanged; follow the [server-side sanitizing advice before saving or sending](/guide/blocks#html).

### Lint fixes

`AI_FIXABLE_RULES`, exported from `@templatical/editor`, contains exactly the rules listed below. `AI_ALT_TEXT_RULES` contains exactly `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` and `a11y.img-linked-no-context`. Both actions require `@templatical/quality`, lint on and a loaded template. The canonical categories, catalogs and options are [Accessibility](/quality/accessibility/), the [accessibility rule catalog](/quality/accessibility/rule-catalog), [Deliverability](/quality/deliverability/), the [deliverability rule catalog](/quality/deliverability/rule-catalog) and [Options](/quality/options).

`fixFinding` receives the JSON-serializable lint projection `finding: { ruleId, message, suggestion, reference, blockId, excerpt? }`; `severity`, `clients` and the local `fix` function are excluded. [Quality](/quality/) documents the rules and findings. The editor offers fixes for these rule ids:

- `a11y.link-vague-text`
- `a11y.button-vague-label`
- `a11y.link-empty`
- `a11y.text-all-caps`
- `a11y.missing-preheader`
- `deliverability.link-text-domain-mismatch`
- `deliverability.low-text`

`buildFixRequest(finding)` fills `prompts/fix.md` with diagnostic data and guidance from `prompts/fix-rules.json`, exported as `FIX_RULE_GUIDANCE` from `@templatical/ai-kit/server`. Unlisted rules get `Change only what the finding names.`. Every finding field is data, never instructions; the model must not fetch `reference`. Domain-mismatch fixes keep the `href`, and low-text fixes add body copy using only existing facts.

`readAiRequest` rejects invalid fields with `SdkError` (status 422, no `code`) and never truncates: `ruleId` is non-empty and at most 200 characters; `message`, `suggestion` and optional `excerpt` are at most 1,000 Unicode code points; `reference` is an `http:` or `https:` URL of at most 2,048 characters; `blockId` is `null` or a string of at most 200 characters. ID and URL limits count UTF-16 units (`string.length`).

Check your fix endpoint with `runAiWireConformance({ baseUrl })` in the example below; `runAiProviderConformance(provider)` also sends a lint-shaped finding to `fixFinding`.

### Alt text

`buildAltTextRequest(request: AiAltTextRequest)` returns `{ system: string; messages: AiModelMessage[] }` with the image as an `image-url` attachment on the user message. `prompts/alt-text.md` requests the image's purpose in this email, destination or action for linked images, visible image text, the template's locale, plain text and the request's `maxLength`. Nearby text and current alt are data, never instructions.

`checkAltTextAnswer` checks an answer without throwing and returns `{ ok: true, alt }` or `{ ok: false, reason }`. `checkAltText` is the final check and throws `SdkError(AI_ERROR_MESSAGES.ai_output_invalid, 502, "ai_output_invalid")` for an invalid answer.

```ts
import type { AiModelMessage } from "@templatical/ai-kit/server";

export declare function checkAltTextAnswer(
  answer: string,
  { maxLength }: { maxLength: number },
): { ok: true; alt: string } | { ok: false; reason: string };

export declare function buildAltTextRepairRequest(
  built: { system: string; messages: AiModelMessage[] },
  answer: string,
  reason: string,
  maxLength: number,
): { system: string; messages: AiModelMessage[] };

export declare function checkAltText(
  answer: string,
  { maxLength }: { maxLength: number },
): string;
```

Normalization trims outer whitespace, strips one surrounding single or double quote pair, removes one leading “Image of” or “Picture of” case-insensitively, then trims again. Line breaks after trimming outer whitespace are refused even when the text is short or prefix normalization would consume the break. The normalized string's length counts UTF-16 units (`alt.length`). The check returns the first matching reason in this order:

| Condition | Exact `reason` |
| --- | --- |
| Empty after normalization | `Your answer was empty.` |
| Contains a line break (CR, LF, U+2028 or U+2029) | `Your answer had several lines.` |
| Contains HTML (`/<[a-z]/i`) | `Your answer contained HTML.` |
| Longer than `maxLength` | `` `Your answer was ${alt.length} characters; the limit is ${maxLength}.` `` |

`buildAltTextRepairRequest(built, answer, reason, maxLength)` keeps the same system prompt and original messages, including the image attachment. It appends `{ role: "assistant", content: answer }` and a user message whose content is `` `${reason} Reply again with only the alt text: one line of plain text, at most ${maxLength} characters.` ``. Pass `maxLength` from the original request as the fourth parameter. The function does not mutate `built` or call the model.

The guide's server and `evalAltTextWith` check the first answer with `checkAltTextAnswer`. On refusal they send exactly one repair request with `buildAltTextRepairRequest`, then run `checkAltText`. A second invalid answer raises `ai_output_invalid`; there is no third model call. Check your endpoint with `runAiWireConformance({ baseUrl })` in the example below.

`readAiRequest` validates the `altText` route without truncation: `blockId` is non-empty, at most 200 characters; `image.url` is an `http:` or `https:` URL parsed by `new URL()`, at most 2,048 characters; `currentAlt` and `linkHref` are strings of at most 2,048 characters or `null`; `nearbyText` is at most 2,000 code points; `locale` is at most 35 characters and matches `/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/`; `maxLength` is an integer from 1 to 1,000. Invalid fields throw `SdkError(message, 422)` with no code. Character limits other than `nearbyText` count UTF-16 units.

The editor supplies its effective lint `altMaxLength`, default 125. Always check the answer with the request's value. The model provider fetches `image.url`; your backend authorizes the template and block and resolves private or signed media. [Alt text in the editor](/backend/ai#alt-text) documents review and the `decorative` flag.

The model attachment union is:

```ts
export type AiModelAttachment =
  | { kind: "image" | "pdf"; mediaType: string; data: Blob }
  | { kind: "image-url"; url: string };
```

### Model adapters

`runEditingTurn` calls your model through one method:

<<< @/snippets/model-contract.ts

[Bring your own AI backend](/guide/bring-your-own-ai#model-adapters) has adapters for the Vercel AI SDK, OpenAI and Anthropic. All examples take chat, fix, rewrite and alt text and accept image URLs for alt text. Only the Anthropic example accepts image and PDF Blobs in chat. The OpenAI and Vercel client configurations set `chatAttachments: false` and turn off stored conversation history.

### Chat attachments

`AiChatRequest.attachments` is always present: `[]` without files, otherwise `{ file: Blob, kind: "image" | "pdf", name: string }[]`. `AiProvider.chatAttachments: false | true` is a flag: `true` means the `chat` function accepts attachments; it has no effect when `chat` is `false`. The HTTP provider enables it by default when chat is on; `features: { chatAttachments: false }` disables it.

Without attachments the HTTP client keeps the JSON body unchanged. With attachments, `AI_GENERATE_FIELDS` names `message`, `selectedBlockId`, `mergeTags`, `content`, `revision`, and repeated `attachment` file parts. `message` and `selectedBlockId` are text; `mergeTags` and `content` are JSON strings; `revision` is a number as text. Absent `selectedBlockId` and `revision` become `null`. Multipart with no file parts is valid. JSON bodies always parse to `attachments: []`.

`readAiRequest` accepts MIME types `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`. It refuses, never truncates, with status 422 and no code, in this order:

| Condition | Message |
| --- | --- |
| Form cannot be parsed | Send the message as multipart form data. |
| More than 4 files | Attach at most 4 files. |
| Non-file part or unsupported MIME type | Attach PNG, JPEG, WebP or GIF images, or PDFs. |
| Any file over `5 * 1024 * 1024` bytes | Each attachment must be 5 MB or smaller. |
| Total over `10 * 1024 * 1024` bytes | Attachments must be 10 MB or smaller together. |
| File name over 255 UTF-16 units | An attachment's file name must be at most 255 characters. |

`buildChatRequest(message: string, options?: { hasAttachments?: boolean })` returns the text-only request unchanged by default; with `hasAttachments: true` it appends a blank line and `prompts/chat-attachments.md`. Map the parsed files to model attachments with `{ kind, mediaType: file.type, data: file }`, as the guide does. The prompt uses references for the requested change and replaces the whole template only when empty or explicitly requested; pictures become placeholders.

The conformance suites send one 1×1 PNG when chat attachments are on; wire conformance also requires a 422 for five attachments. History stores only `{ name, kind }` in optional user-message `attachments`; retaining the files is the backend's choice.

## Testing

Both signatures, every option and the shared result:

<<< @/snippets/conformance-contract.ts

Provider conformance uses the provider's enabled members. Wire conformance owns `headers` and `features`; omitted flags enable all features. Defaults: `templateId: "conformance"`, `content: AI_EVAL_TEMPLATES.welcome`, `mergeTags: AI_EVAL_MERGE_TAGS`, `timeoutMs: 5000` ms. `callTimeoutMs` cannot exceed `timeoutMs`.

`altTextImageUrl` defaults to `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL` from `@templatical/ai-kit/testing`: `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/images/probe.png` (`version` is the installed kit version). It shows a teal mug without text. Unreleased builds pass `altTextImageUrl` for a public image the model provider can fetch.

For Node.js 24, save the following as `check-ai-backend.ts`. Your authenticated `POST /api/templates` accepts `{ name, content }` and returns `{ id }`. Set `AI_TEST_TOKEN`; `AI_BASE_URL` and `AI_TEMPLATES_URL` override the local URLs. Run `node check-ai-backend.ts`. It creates a disposable template and turns off history and chat attachments to match the stateless server in the [backend guide](/guide/bring-your-own-ai#the-server).

<<< @/snippets/check-ai-backend.ts

The example adds the default probe image as `blockId: "conformance-image"` so the backend can authorize it. Keep this disposable template available during both suites.

Both suites call enabled model features and spend tokens. Turn and fix checks can persist applied batches. With conversation enabled they check `list`, Undo/Redo and `settleReplay`, and clear history through `clear` when available. Wire conformance also sends invalid requests, including more than four attachments when chat attachments are enabled. Do not use a production template. Remove the test template through your store afterwards. Every failed check prints its name and detail; failure sets exit code 1.

- `createMockAiProvider(script)` plays recorded streams, for your UI tests; `AI_RECORDINGS` is the playground's.
- `runAiEvalSet({ runTurn, runAltText?, lintCheck?, loadFile?, model, cases?, minPassRate? })` runs `AI_EVAL_CASES`. `cases` replaces the set; `minPassRate` defaults to 90.
- `evalTurnWith(model, options?: { maxSteps?: number })` builds `runTurn`. A set `finding` uses `buildFixRequest(finding)`; otherwise it uses `buildChatRequest(message, { hasAttachments })` and the Blob attachments.
- `evalAltTextWith(model, options?: { imageUrl?: (file: string) => string })` builds `runAltText: (input: AiEvalAltTextInput) => Promise<string>`. It uses `buildAltTextRequest`, `locale: "en"` and `checkAltText(text, { maxLength })`. An invalid first answer gets exactly one repair retry before the final `checkAltText`.

An omitted `kind` means `edit`. File paths are relative to `eval/`. The exported types and their supporting types are:

```ts
import type { AiChatAttachment, AiFixFinding, AiMergeTags, TemplateContent } from "@templatical/types";

export type AiEvalCheck =
  | { type: "applied" | "notApplied" }
  | { type: "present" | "missing"; block: string }
  | { type: "contains" | "notContains"; block?: string; text: string }
  | { type: "lintGone"; ruleId: string }
  | { type: "field" | "fieldNot"; block: string; path: string; matches: string }
  | { type: "setting"; path: string; matches: string }
  | { type: "greater"; block: string; path: string; than: number }
  | { type: "maxText"; block: string; chars: number }
  | { type: "countType"; blockType: string; min: number }
  | { type: "order"; first: string; then: string }
  | { type: "firstContains"; text: string }
  | { type: "reply"; matches: string };

export type AiEvalAltCheck =
  | { type: "nonEmpty" | "withinLimit" }
  | { type: "containsAll" | "containsAny"; texts: string[] }
  | { type: "notMatches"; matches: string }
  | { type: "shortOrMatches"; chars: number; matches: string };

type EvalTemplate =
  "welcome" | "promo" | "injection" | "empty" | "domain-mismatch" | "low-text";

interface EvalTurnCase {
  name: string;
  template: EvalTemplate;
  /** Block ids the case may delete; every other original id must survive. */
  removed?: string[];
  checks: AiEvalCheck[];
}

export interface AiEvalAltTextInput {
  /** Path relative to the package's eval/ folder. */
  image: string;
  linkHref: string | null;
  nearbyText: string;
  maxLength: number;
}

export type AiEvalCase =
  | (EvalTurnCase & {
      kind?: "edit";
      message: string;
      selectedBlockId?: string;
      attachments?: { file: string; kind: "image" | "pdf" }[];
    })
  | (EvalTurnCase & { kind: "fix"; finding: AiFixFinding })
  | (AiEvalAltTextInput & {
      kind: "altText";
      name: string;
      checks: AiEvalAltCheck[];
    });

export interface AiEvalTurnInput {
  content: TemplateContent;
  mergeTags: AiMergeTags;
  message: string;
  selectedBlockId: string | null;
  finding: AiFixFinding | null;
  attachments: AiChatAttachment[];
}

export interface AiEvalTurnOutput {
  /** The template after the turn. */
  content: TemplateContent;
  reply: string;
  /** Whether the turn changed the template. */
  applied: boolean;
}

export interface AiEvalReport {
  model: string;
  passed: number;
  /** Cases that ran; skipped cases are excluded. */
  total: number;
  skipped: number;
  /** Whole percent, rounded down. */
  rate: number;
  ok: boolean;
  results: {
    name: string;
    ok: boolean;
    reason: string | null;
    skipped?: true;
  }[];
}
```

`lintCheck?: (content: TemplateContent) => string[]` returns rule IDs after the turn. The check `{ type: "lintGone"; ruleId: string }` requires the ID to be absent. `{ type: "fieldNot"; block: string; path: string; matches: string }` negates `field`; the block must exist. The domain case checks that the `href` stays unchanged and visible text contains no `www.` or `://`.

Text comparisons in `AiEvalAltCheck` are case-insensitive. Lengths use `string.length`; `withinLimit` checks the case's `maxLength`.

Without `runAltText`, alt-text cases are skipped; without `lintCheck`, cases with `lintGone` are skipped. `AiEvalReport.skipped` counts them, and their result has `skipped?: true`. `passed`, `total` and `rate` exclude them. `rate` is rounded down and is 0 when no case ran. A thrown error fails a case that ran.

`loadFile?: (file: string) => Promise<Blob>` loads attachments. Its default fetches `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}`. `evalAltTextWith` uses the same URL for images, reading `version` from the package at build time. For unreleased builds, set `imageUrl`; for local Node runs, `loadFile` reads the installed `eval/` folder. The [complete Node example](/guide/bring-your-own-ai#backend-conformance-and-model-evaluation) connects both runners to `@templatical/quality` and file loading.

The [conformance suites](#testing) check non-empty alt text within `maxLength`, abort handling and `altText: false`.

## Files

`@templatical/ai-kit/prompts/*.md`, `@templatical/ai-kit/prompts/*.json`, `@templatical/ai-kit/schema/*.json` and `@templatical/ai-kit/eval/*` (with `MANIFEST.sha256`) are the prompts, schemas and test set as files, for a backend in another language. The editing system prompt is `editing.md`, then `"\n\n# Operations\n\n"` and `operations.md`, then `"\n\n# Template content schema\n\n"` and `template-content.schema.json`.

## The wire

Every request and response carries `Templatical-AI-Wire: 1`; turns, alt text, Undo, Redo and replay settlement carry `X-Templatical-Session`. A cross-origin backend allows `Templatical-AI-Wire`, `X-Templatical-Session` and its auth header in `Access-Control-Allow-Headers` for preflight, and exposes `Templatical-AI-Wire` in `Access-Control-Expose-Headers`. Routes are relative to your base URL; `{t}` is the template id.

| Route | Request | Response |
| --- | --- | --- |
| `POST /templates/{t}/ai/generate` | JSON `{ message, selectedBlockId, mergeTags, content, revision }`, or multipart with repeated `attachment` parts | SSE |
| `POST /templates/{t}/ai/fix-finding` | JSON `{ finding, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/rewrite-text` | JSON `{ html, preset, language, instruction, mergeTags }` | SSE: `text`*, `done { html }` |
| `POST /templates/{t}/ai/alt-text` | JSON `{ blockId, image: { url }, currentAlt, linkHref, nearbyText, locale, maxLength }` | SSE: `done { alt }` |
| `GET /templates/{t}/ai/conversation-messages` | — | JSON `{ data: AiChatMessage[] }` |
| `POST /templates/{t}/ai/messages/{m}/undo`, `…/redo` | — | JSON `{ data: { operations, replayId } }` or `{ data: { batchId, revision } }` |
| `POST /templates/{t}/ai/messages/{m}/replays/{replayId}` | JSON `{ direction, applied }`, `X-Templatical-Session` | 204 |
| `DELETE /templates/{t}/ai/conversation` | — | 204 |

**Events** are `data: {json}` lines, each with a `type`; `: ping` comments keep the connection alive. `text { text }`; `operations { ops }` (the editor applies them); `applied { batchId, revision, operationCount }`; `done { messageId }` (turns: a string, or `null` without history), `done { html }` (rewrite), `done { alt }` (alt text); `error { code, message }`. `done` or `error` is the last event.

**Errors before the stream** are JSON `{ message, code, …details }` with the status of the code: `feature_unavailable` and `limit_reached` 403, `rate_limited` 429 with `Retry-After`, `ai_turn_running` 409, `content_too_large` 413, `ai_output_invalid` 422, `ai_provider_error` 502, `not_found` 404, an operation's code 409 (`invalid_operation` 422). A validation failure is a 422 `{ message }`.

A message's `batches` are `{ batchId, revision, operationCount }`; a batch the editor applied itself has no backend revision, so store `revision: null` for it.


`AI_LIMITS.contentMaxBytes` caps JSON-serialized template content at 200,000 UTF-8 bytes; `readAiRequest` refuses larger content with `content_too_large` (413). `selectedBlockId` and the session id are limited to 200 characters. These character limits count Unicode code points; lint-finding field limits are described under [Lint fixes](#lint-fixes).
