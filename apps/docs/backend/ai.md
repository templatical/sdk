---
title: AI
description: Chat, lint fixes, alt-text drafts, rewrite and design to template over your own AI backend.
---

# AI

Give the editor an AI provider and your users get an assistant that edits the template they're working on: a chat with Undo, **Rewrite with AI** in the paragraph toolbar, reviewed alt-text drafts in Issues, static localized chat starters, and a template built from a screenshot or a PDF. Your backend talks to the model, with your keys, your data-processing terms and your guardrails.

The editor owns every surface, the streaming, applying the AI's edits with Undo, and the labelling that says the content comes from AI. You own the model call: one function per feature, or a few HTTP endpoints that `@templatical/ai-kit` writes most of.

## Quick start

```ts
import { init } from '@templatical/editor';
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const editor = await init({
  container: '#editor',
  templates: myTemplateStore,
  ai: createHttpAiProvider({
    baseUrl: '/api/ai',
    headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  }),
});

await editor.load('tpl_123');
```

`createHttpAiProvider` speaks a documented REST and server-sent-events wire; [Bring your own AI backend](/guide/bring-your-own-ai) builds the server side with `@templatical/ai-kit/server` in about a hundred lines, and the [AI API reference](/api/ai-kit#the-wire) documents the wire for a backend in any language.

**AI needs a loaded template.** Every request names it, so the entry points appear once `create()` or `load()` has resolved. **Omit `ai` and the feature is absent**: no menu, no toolbar button, and none of its UI is downloaded.

## The contract

```ts
import type { AiProvider } from '@templatical/types';

interface AiProvider {
  chat: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  fixFinding: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  design: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  rewrite: false | ((request, on: { onText(text: string): void }, signal: AbortSignal) => Promise<{ html: string }>);
  altText: false | ((request: AiAltTextRequest, signal: AbortSignal) => Promise<{ alt: string }>);
  conversation?: {
    settleReplay(templateId: string, messageId: string, outcome: AiReplayOutcome): Promise<void>;
    list(templateId: string): Promise<AiChatMessage[]>;
    clear: false | ((templateId: string) => Promise<void>);
    undo: false | ((templateId: string, messageId: string, context: { sessionId: string }) => Promise<AiReplay>);
    redo: false | ((templateId: string, messageId: string, context: { sessionId: string }) => Promise<AiReplay>);
  };
}

type AiReplay = { operations: Operation[]; replayId: string } | { applied: { batchId: string; revision: number } };
interface AiReplayOutcome {
  replayId: string;
  direction: 'undo' | 'redo';
  applied: boolean;
  sessionId: string;
}
```

Chat, fix, design and rewrite requests carry `templateId`, `content` (the template as the editor has it, after it sent its pending edits), `revision` (the collaboration revision, or `null`), `sessionId` and `mergeTags` (`{ syntax, tags }`, or `null` when none are declared). Every call gets an `AbortSignal`: the user's Stop aborts it.

### Turns: chat, fix and design

A turn streams its reply through `on.onText` and hands its edits over in one of two ways:

- **`on.onOperations(ops)`**: [operations](/api/operations) for the editor to apply. It applies them at once and answers `{ applied: true, inverse }`, or `{ applied: false, code, opIndex, message }` when they no longer fit the template (someone changed a block, another person holds it). A turn's batches are one undo step.
- **`on.onApplied({ batchId, revision, operationCount })`**: your backend already applied the batch to its copy. With a [collaboration provider](/backend/collaboration) the editor follows the revision; with only a templates provider it reloads the template when the turn ends. With neither, it refuses the batch.

`chat` sends `message` and `selectedBlockId` (only a block your backend has), `fixFinding` the lint projection described below, `design` an image or a PDF (`file`, `fileKind`) and an optional `prompt`.

### Fix with AI

`fixFinding` receives `finding: { ruleId, message, suggestion, reference, blockId, excerpt? }`, the JSON-serializable projection of a [lint finding](/quality/). `severity`, `clients` and the local `fix` function are never sent. Every field is untrusted diagnostic data, never instructions; the model must not fetch the `reference` link.

The Issues panel offers **Fix with AI** for these rule ids when the finding has no deterministic `fix`, `fixFinding` is a function and a template is loaded:

- `a11y.link-vague-text`
- `a11y.button-vague-label`
- `a11y.link-empty`
- `a11y.text-all-caps`
- `a11y.missing-preheader`
- `deliverability.link-text-domain-mismatch`
- `deliverability.low-text`

The editor shows one button per `ruleId`/`blockId` pair, regardless of severity. Fix buttons are disabled during AI editing work; independent alt-text drafts do not block fixes; the running fix shows **Fixing…** and **Stop**. The turn remains one undo step with history kind `fix`. Only the next 500 ms debounced lint update decides resolution: if any hit for the pair remains, the row shows **Still flagged after the fix**. This makes no claim about individual occurrences within a block.

For a domain mismatch, rewrite only the visible link text into descriptive words, never the `href`. For low text (`blockId: null`), add body copy from existing facts, without padding alt text or the preheader. `a11y.missing-preheader` sets `preheaderText` through `updateSettings`, using at most 100 characters from the opening content.

### Alt text

`altText(request, signal)` returns `{ alt: string }` for one image, with no content change or chat history. The request is `AiAltTextRequest` from `@templatical/types`:

```ts
export interface AiAltTextRequest {
  templateId: string;
  sessionId: string;
  blockId: string;
  image: { url: string };
  currentAlt: string | null;
  linkHref: string | null;
  nearbyText: string;
  locale: string;
  maxLength: number;
}
```

The image goes to the model by URL. The model provider fetches it, so your backend must authorize the template and block and resolve private or signed media. `currentAlt` is `null` when empty or decorative; `linkHref` comes from `linkUrl`. `nearbyText` contains the nearest plain text before and after the image in its column, falling back to its section, capped at 2,000 code points. `locale` is the template's locale.

`maxLength` is the effective accessibility lint `altMaxLength` threshold: an integer from 1 to 1,000, default 125 when absent, invalid or lint is disabled. It counts UTF-16 units (`string.length`). Use the request's value with `checkAltText` on your backend.

The Issues panel offers **Write alt text** once per image for `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` and `a11y.img-linked-no-context`. The inline review has an editable draft. **Accept** writes `{ alt, decorative: false }`; **Mark decorative** writes `{ alt: "", decorative: true }`; **Cancel** and Escape write nothing. An empty `alt` alone still triggers `img-missing-alt`. The renderer forces `alt=""` and `role="presentation"` for decorative images.

Drafts run independently, can be stopped, and abort on template switches or editor destruction. Applying uses one AI batch and one undo step, split at 100 operations when needed; collaboration uses the user's batch with `origin: 'ai'`. Neither action adds chat history. `altText: false` hides the action; the HTTP equivalent is `features: { altText: false }`.

When at least two distinct images have alt-text findings, **Write missing alt text ({count})** opens a bulk review in document order, with at most 3 provider calls at once. Review each thumbnail and editable draft, use the decorative toggle where needed, and select the rows to accept. **Stop** aborts pending drafts and leaves undrafted rows editable. Nothing is written before **Apply accepted ({count})**, which applies the selected rows in one batch with one undo step. **Cancel** and Escape write nothing.

### Rewrite

`rewrite` gets a paragraph's `html` and a `preset` (`shorten`, `expand`, `friendlier`, `formal`, `fixGrammar`, `translate` with a `language`), an `instruction`, or both; it streams the text for a live preview and answers the final HTML.

### Chat starters

A chat without messages shows three static localized starters for a template without blocks, and four for a template with blocks. Clicking a starter sends its displayed text as a chat message. Starters require no model call and have no integrator override.

### Content checks

Deterministic lint reports specific content, client and size findings. It does not predict inbox placement. See [Deliverability](/quality/deliverability/) and [Compatibility](/quality/compatibility/).

### History

`conversation` is optional. With it, the chat loads the stored messages when it opens, and each message's Undo and Redo call your backend, which answers the operations to apply (`{ operations, replayId }`) or a batch it applied (`{ applied: { batchId, revision } }`). Without it, the chat lives in memory for the session, and a message's Undo applies the turn's own inverse, refused when someone changed those blocks since.

After applying or refusing operations, the editor calls `settleReplay(templateId, messageId, { replayId, direction, applied, sessionId })`. Change `undone` only on `applied: true`; with `applied: false`, or no settlement, keep the message's state. Settle each `replayId` once; later settlements are no-ops. A server-applied `{ applied }` answer is never settled. A settlement failure reaches `onError`, and the local row keeps the direction actually applied to the template.

## Controlling features

Set a member to `false` and its entry point goes: `chat: false` hides the assistant, `rewrite: false` the toolbar button, `fixFinding: false` the Fix with AI buttons on lint findings, `design: false` design to template. With `createHttpAiProvider`, pass `features: { rewrite: false, conversation: false }`.

## Errors

Reject with an `SdkError` whose `code` the editor knows, and whose message the user can read:

| `code` | When |
| --- | --- |
| `feature_unavailable` | The feature is off for this user |
| `limit_reached` | An allowance is used up; `details: { limit, resetsAt }` |
| `rate_limited` | Too many requests; a `ThrottledError` with `retryAfterMs` |
| `ai_turn_running` | A turn is already running on this template |
| `content_too_large` | The template is too large for the model |
| `ai_output_invalid` | The model's rewrite or alt-text output broke the rules |
| `ai_provider_error` | The model provider failed |

Undo and Redo may reject with an operation's code (`precondition_failed`, …) as a `CollaborationConflict`. An `AbortError` means the user stopped the call and is never shown. The editor says each failure in words and passes it to `init({ onError })` too.

## In the editor

- **Header:** an **AI** menu with the assistant and design to template.
- **Chat:** labelled as an AI assistant ("Replies and changes come from AI."), each turn's "Applied N changes" with Undo and Redo, Stop while a turn runs, New chat, static localized starters. Cmd/Ctrl+Z undoes a whole turn.
- **Paragraph toolbar:** **AI**, with the presets, 16 languages to translate into and a free instruction. The result shows as an **AI suggestion**, merge tags as tags and the markup sanitized; Replace makes it the user's own edit.
- **Design to template:** PNG, JPEG, WebP, GIF or PDF up to 5 MB; the build is one undoable turn.
- **The empty canvas:** shortcuts to the assistant and to design to template.

AI content is always marked as AI, as the EU AI Act's Article 50 asks of systems that interact with people.

## With collaboration

With a [collaboration provider](/backend/collaboration), the AI's operations travel as the user's own batches with `origin: 'ai'`. A backend that honours it broadcasts the batch with an `ai` actor, and other editors show "AI (for Ada) changed 3 blocks" with an outline on those blocks; the editor that asked shows the outline only.

## Events

Failures reach `init({ onError })`. Batches from another session, an AI's included, reach `init({ onRemoteChange })` as for any collaboration batch.

## Headless use

The provider is a plain object: call `chat` or `rewrite` from your own code with the same requests, and apply the operations with `applyOperations` from `@templatical/types`. `@templatical/ai-kit/testing` has `createMockAiProvider` for UI tests and `runAiProviderConformance` to check a provider you wrote.

## In the playground

The **AI** setup plays recorded turns through `createMockAiProvider`: no model and no keys. Ask to change the title, or double-click a paragraph and rewrite it. `?history=1` keeps a conversation; `?collaboration=1&user=Ada` in two tabs shows the AI's edits arriving elsewhere.

[Open in playground](https://play.templatical.com/scenes/ai)

## Check it

Open the assistant for a loaded template without blocks: it shows three starters. Add a block: it shows four. Clicking one sends its displayed text. Check your provider with [the conformance suite](/api/ai-kit#testing).

Open the Issues panel with a finding from the list above that has no deterministic fix. **Fix with AI** sends the lint projection; after re-lint the finding disappears or shows **Still flagged after the fix**. One Undo reverts the whole fix.

For alt text, open an image finding and choose **Write alt text**. Edit the draft, accept it, and Undo: both `alt` and `decorative` return to their previous values. **Mark decorative** clears `img-missing-alt` after re-lint. Cancel leaves the image unchanged.
