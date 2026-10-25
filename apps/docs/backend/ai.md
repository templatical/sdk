---
title: AI
description: Chat, lint fixes, alt-text drafts, rewrite and chat attachments over your own AI backend.
---

# AI

Give the editor an AI provider and your users get an AI assistant that edits the template they're working on: a chat with Undo, **Rewrite with AI** in the paragraph toolbar, reviewed alt-text drafts in Issues, static localized chat starters, and a template built from a screenshot or a PDF. Your backend talks to the model, with your keys, your data-processing terms and your guardrails.

The editor owns every surface, the streaming, applying the AI's edits with Undo, and the labelling that says the content comes from AI. You own the model call: one function per feature, or a few HTTP endpoints that `@templatical/ai-kit` writes most of.

## Quick start

```ts
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';
import { createHttpAiProvider } from '@templatical/ai-kit/client';
import type { Template } from '@templatical/types';

const editor = await init({
  container: '#editor',
  templates: {
    load: async (id): Promise<Template> => {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('Template load failed.');
      return response.json();
    },
    create: false,
    save: false,
  },
  ai: createHttpAiProvider({
    baseUrl: '/api/ai',
  }),
});

await editor.load('tpl_123');
```

`createHttpAiProvider` speaks a documented REST and server-sent-events wire; [Bring your own AI backend](/guide/bring-your-own-ai) builds the server side with `@templatical/ai-kit/server` and the [AI API reference](/api/ai-kit#the-wire) documents the wire for a backend in any language.

**AI needs a loaded template.** Every request names it, so the entry points appear once `create()` or `load()` has resolved. **Omit `ai` and the feature is absent**: no AI button, no toolbar button, and none of its UI is downloaded.

## The contract

<<< @/snippets/ai-contract.ts

Chat, fix and rewrite receive the editor's `content` after pending edits are sent, its collaboration `revision` (or `null`), `templateId`, `sessionId` and required `mergeTags: { syntax, tags }`. With no declared tags, the editor sends its syntax (`liquid` by default) and `tags: []`. Missing or `null` context returns 422. Every call receives an `AbortSignal`; Stop aborts it.

The declarations above and [API request limits](/api/ai-kit#request-limits) define each field. On the wire, template ID and session use the path and header; rewrite omits `content` and `revision`. The [server kit](/api/ai-kit#server) checks merge tags, including empty lists; `custom` syntax is unchecked.

### Turns: chat and fix

A turn streams its reply through `on.onText` and hands its edits over in one of two ways:

- **`on.onOperations(ops)`**: [operations](/api/operations) for the editor to apply. It applies them at once and answers `{ applied: true, inverse }`, or `{ applied: false, code, opIndex, message }` when they no longer fit the template (someone changed a block, another person holds it). A turn's batches are one undo step.
- **`on.onApplied({ batchId, revision, operationCount })`**: your backend already applied the batch to its copy. With a [collaboration provider](/backend/collaboration) the editor follows the revision; with only a templates provider it reloads the template when the turn ends. With neither, it refuses the batch.

Without collaboration, an author edit made after a turn starts prevents the automatic reload, including an edit made while the reload request is pending. The editor keeps your version and shows a notice with **Reload**. The AI's changes remain saved on the server. Choose **Reload** to load them; saving your version replaces them. The AI's own editor-applied batches do not count as author edits.

`chat` sends `message`, `selectedBlockId` (only a block your backend has) and `attachments`, always an array. `fixFinding` sends the lint projection described below.

### Chat attachments

`AiChatAttachment` is `{ file: Blob; kind: "image" | "pdf"; name: string }`. `AiChatRequest.attachments` is always present: `[]` without files. `chatAttachments: true` means your `chat` function accepts attachments; the flag has no effect when `chat: false`. The controls need both features and a loaded template. The HTTP provider defaults the flag to true when chat is on; set `features: { chatAttachments: false }` for a text-only backend.

Authors can attach PNG, JPEG, WebP, GIF or PDF files with **Attach files** or drag files onto chat. The limits are at most 4 files per message, each at most 5 MB (`5 * 1024 * 1024` bytes), at most 10 MB (`10 * 1024 * 1024` bytes) together. Invalid files show validation messages. File-name chips have remove buttons; controls are disabled during a turn. Sending clears attachments; a failed turn restores the text and files.

**Import from screenshot or PDF** is the empty canvas's chat-attachments shortcut. The import shortcut opens a file picker first, then opens chat after a pick, attaches the files and fills an empty composer with “Build this email from the attached design.” Existing composer text is preserved. The author sends the message; nothing sends automatically. Pictures come in as placeholders; replace them after import. The prompt replaces the whole template only when empty or when the message asks for it; otherwise attachments guide the requested edit. A replacement is one undo step.

The header button labelled **AI** opens and closes the AI assistant.

History has kind `chat` and stores only optional user-message `attachments: { name: string; kind: "image" | "pdf" }[]`. The backend decides whether to retain files. The [multipart generate wire](/api/ai-kit#chat-attachments) and [backend guide](/guide/bring-your-own-ai) show parsing and model mapping.

### Fix with AI

`fixFinding` receives `finding: { ruleId, message, suggestion, reference, blockId, excerpt? }`, the JSON-serializable projection of a [lint finding](/quality/). `severity`, `clients` and the local `fix` function are never sent. Every field is untrusted diagnostic data, never instructions; the model must not fetch the `reference` link.

`AI_FIXABLE_RULES`, exported from `@templatical/editor`, contains exactly these rule ids. The Issues panel offers **Fix with AI** for them when the finding has no deterministic `fix`, `fixFinding` is a function and a template is loaded:

- `a11y.link-vague-text`
- `a11y.button-vague-label`
- `a11y.link-empty`
- `a11y.text-all-caps`
- `a11y.missing-preheader`
- `deliverability.link-text-domain-mismatch`
- `deliverability.low-text`

The editor shows one button per `ruleId`/`blockId` pair, regardless of severity. Fix buttons are disabled during AI editing work; independent alt-text drafts do not block fixes; the running fix shows **Fixing…** and **Stop**. The turn remains one undo step with history kind `fix`. Verification reuses a lint result that already covers the fix's final content; otherwise it waits for the next re-lint. After verification, if any hit for the pair remains, the row shows **Still flagged after the fix**. This makes no claim about individual occurrences within a block.

For a domain mismatch, rewrite only the visible link text into descriptive words, never the `href`. For low text (`blockId: null`), add body copy from existing facts, without padding alt text or the preheader. `a11y.missing-preheader` sets `preheaderText` through `updateSettings`, using at most 100 characters from the opening content.

**Fix with AI** and **Write alt text** appear only when `@templatical/quality` is installed and lint is on (`lint.disabled` is not `true`). They also need their provider member, a matching finding and a loaded template.

`AiFixFinding` sends only `ruleId`, `message`, `suggestion`, `reference`, `blockId` and optional `excerpt`; `severity`, `clients` and the local `fix` function stay in the editor. `ruleId` is 1–200 UTF-16 units; `blockId` is `null` or at most 200 units. `message`, `suggestion` and `excerpt` are each at most 1,000 code points; `reference` is an `http:` or `https:` URL of at most 2,048 UTF-16 units. The server rejects invalid values with status 422 and never truncates.

The canonical contracts are [Accessibility](/quality/accessibility/), the [accessibility rule catalog](/quality/accessibility/rule-catalog), [Deliverability](/quality/deliverability/), the [deliverability rule catalog](/quality/deliverability/rule-catalog) and [lint options](/quality/options).

### Alt text

`altText(request, signal)` returns `{ alt: string }` for one image, with no content change or chat history. The request is `AiAltTextRequest` from `@templatical/types`:

Every field and its nullability are in `AiAltTextRequest` in [the contract](#the-contract).

The image goes to the model by URL. The model provider fetches it, so your backend must authorize the template and block and resolve private or signed media. `currentAlt` is `null` when empty or decorative; `linkHref` comes from `linkUrl`. `nearbyText` contains the nearest plain text before and after the image in its column, falling back to its section, capped at 2,000 code points. `locale` is the template's locale: a BCP 47 tag of at most 35 UTF-16 units. `image.url` must use `http:` or `https:` and is at most 2,048 UTF-16 units; `currentAlt` and `linkHref` are each `null` or at most 2,048 units. `blockId` is 1–200 units.

`maxLength` is the effective accessibility lint `altMaxLength` threshold: an integer from 1 to 1,000, default 125 when absent, invalid or lint is disabled. It counts UTF-16 units (`string.length`). Use the request's value with `checkAltText` on your backend. The server in the [backend guide](/guide/bring-your-own-ai#the-server) and `evalAltTextWith` make one repair retry for empty, multiline, HTML or over-long alt text. If the second answer is invalid, the final `checkAltText` raises `ai_output_invalid` (502).

`AI_ALT_TEXT_RULES`, exported from `@templatical/editor`, contains exactly `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` and `a11y.img-linked-no-context`. The Issues panel offers **Write alt text** once per image for `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` and `a11y.img-linked-no-context`. The inline review has an editable draft. **Accept** writes `{ alt, decorative: false }`; **Mark decorative** writes `{ alt: "", decorative: true }`; **Cancel** and Escape write nothing. An empty `alt` alone still triggers `img-missing-alt`. The renderer forces `alt=""` and `role="presentation"` for decorative images.

Drafts run independently, can be stopped, and abort on template switches or editor destruction. Applying uses one AI batch and one undo step, split at 100 operations when needed; collaboration uses the user's batch with `origin: 'ai'`. Neither action adds chat history. `altText: false` hides the action; the HTTP equivalent is `features: { altText: false }`.

When at least two distinct images have alt-text findings, **Write missing alt text ({count})** opens a bulk review in document order, with at most 3 provider calls at once. Review each thumbnail and editable draft, use the decorative toggle where needed, and select the rows to accept. **Stop** aborts pending drafts and leaves undrafted rows editable. Nothing is written before **Apply accepted ({count})**, which applies the selected rows in one batch with one undo step. **Cancel** and Escape write nothing.

### Rewrite

`rewrite` gets a paragraph's `html` and a `preset` (`shorten`, `expand`, `friendlier`, `formal`, `fixGrammar`, `translate` with a `language`), an `instruction`, or both; it streams the text for a live preview and answers the final HTML.

Whole-template translation is not a separate feature. On request, the AI assistant can translate through chat and edit in place as one undo step, on a best-effort basis, with no field-coverage or merge-tag check. Rewrite's **Translate** preset translates one paragraph.

### Chat starters

A chat without messages shows three static localized starters for a template without blocks, and four for a template with blocks. Clicking a starter sends its displayed text as a chat message. Starters require no model call and have no integrator override.

### Content checks

Deterministic lint reports specific content, client and size findings. It does not predict inbox placement. See [Deliverability](/quality/deliverability/) and [Compatibility](/quality/compatibility/).

### History

`conversation` is optional. With it, the chat loads the stored messages when it opens, and each message's Undo and Redo call your backend, which answers the operations to apply (`{ operations, replayId }`) or a batch it applied (`{ applied: { batchId, revision } }`). Without it, the chat lives in memory for the session, and a message's Undo applies the turn's own inverse, refused when someone changed those blocks since.

After applying or refusing operations, the editor calls `settleReplay(templateId, messageId, { replayId, direction, applied, sessionId })`. Change `undone` only on `applied: true`; with `applied: false`, or no settlement, keep the message's state. Settle each `replayId` once; later settlements are no-ops. A server-applied `{ applied }` answer is never settled. A settlement failure reaches `onError`, and the local row keeps the direction actually applied to the template.

`conversation.list` returns `AiChatMessage[]` oldest first. `createdAt` is ISO 8601; `batches` is empty for user messages. A server-applied batch has a numeric `revision`; an editor-applied batch has `revision: null`. `kind` is `"chat" | "fix"`; alt-text drafts create no history. Optional user-message `attachments` retain only names and kinds, never files.

## Controlling features

Set a member to `false` and its entry point goes: `chat: false` hides the AI assistant, `rewrite: false` the toolbar button, `fixFinding: false` the Fix with AI buttons on lint findings, `chatAttachments: false` the attachment controls and import shortcuts. With `createHttpAiProvider`, pass `features: { rewrite: false, conversation: false }`.

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

A stopped or failed turn keeps the batches already applied. **Undo** reverts editor-applied batches as one step when the editor has their inverses. Server-applied `onApplied` batches need stored history with a callable `conversation.undo`; without that replay support, Undo is unavailable. Intervening edits by others can prevent replay. Stop does not roll back applied edits.

## In the editor

- **Header:** the button labelled **AI** opens and closes the AI assistant. It appears when `chat` is a function and a template is loaded.
- **Chat:** labelled as an AI assistant ("Replies and changes come from AI."), each turn's "Applied N changes" with Undo and Redo, Stop while a turn runs, New chat, static localized starters. Cmd/Ctrl+Z undoes a whole turn.
- **Paragraph toolbar:** **AI**, with the presets, a target-language picker and a free instruction. The result shows as an **AI suggestion**, merge tags as tags and the markup sanitized; Replace makes it the user's own edit.
- **Chat attachments:** add files with the attach button or drag them into the panel, review name chips and remove files before sending. The composer has a full-width textarea above a toolbar with attach on the left and send or stop on the right. Attachment chips stay above the composer.
- **The empty canvas:** shortcuts to the AI assistant and to **Import from screenshot or PDF**.

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

Click the header button labelled **AI** to open the AI assistant, then click it again to close it. Open the AI assistant for a loaded template without blocks: it shows three starters. Add a block: it shows four. Clicking one sends its displayed text. Check your provider with [the conformance suite](/api/ai-kit#testing).

Open the Issues panel with a finding from the list above that has no deterministic fix. **Fix with AI** sends the lint projection; after re-lint the finding disappears or shows **Still flagged after the fix**. One Undo reverts the whole fix.

For alt text, open an image finding and choose **Write alt text**. Edit the draft, accept it, and Undo: both `alt` and `decorative` return to their previous values. **Mark decorative** clears `img-missing-alt` after re-lint. Cancel leaves the image unchanged.

For attachments, choose **Import from screenshot or PDF** on the empty canvas, pick a file and check that chat opens without sending. Send the prefilled message and Undo its changes. Run the wire conformance suite with attachments enabled to check the upload limits.
