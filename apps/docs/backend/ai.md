---
title: AI
description: Chat that edits the template, rewrite, scoring with fixes and design to template, over your own AI backend.
---

# AI

Give the editor an AI provider and your users get an assistant that edits the template they're working on: a chat with Undo, **Rewrite with AI** in the paragraph toolbar, a template score with one-click fixes, starter suggestions, and a template built from a screenshot or a PDF. Your backend talks to the model, with your keys, your data-processing terms and your guardrails.

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
  score: false | ((request, signal: AbortSignal) => Promise<ScoringResult>);
  suggestions: false | ((request, signal: AbortSignal) => Promise<string[]>);
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

Every request carries `templateId`, `content` (the template as the editor has it, after it sent its pending edits), `revision` (the collaboration revision, or `null`), `sessionId` and `mergeTags` (`{ syntax, tags }`, or `null` when none are declared). Every call gets an `AbortSignal`: the user's Stop aborts it.

### Turns: chat, fix and design

A turn streams its reply through `on.onText` and hands its edits over in one of two ways:

- **`on.onOperations(ops)`**: [operations](/api/operations) for the editor to apply. It applies them at once and answers `{ applied: true, inverse }`, or `{ applied: false, code, opIndex, message }` when they no longer fit the template (someone changed a block, another person holds it). A turn's batches are one undo step.
- **`on.onApplied({ batchId, revision, operationCount })`**: your backend already applied the batch to its copy. With a [collaboration provider](/backend/collaboration) the editor follows the revision; with only a templates provider it reloads the template when the turn ends. With neither, it refuses the batch.

`chat` sends `message` and `selectedBlockId` (only a block your backend has), `fixFinding` a scoring `finding`, `design` an image or a PDF (`file`, `fileKind`) and an optional `prompt`.

### Rewrite, scoring and suggestions

`rewrite` gets a paragraph's `html` and a `preset` (`shorten`, `expand`, `friendlier`, `formal`, `fixGrammar`, `translate` with a `language`), an `instruction`, or both; it streams the text for a live preview and answers the final HTML. `score` gets the linter's findings (`lintFindings`) so it doesn't repeat them, and answers three categories (`spam`, `readability`, `bestPractices`) of integer scores 0–100 with findings. `suggestions` answers up to four short requests for the chat's empty state.

### History

`conversation` is optional. With it, the chat loads the stored messages when it opens, and each message's Undo and Redo call your backend, which answers the operations to apply (`{ operations, replayId }`) or a batch it applied (`{ applied: { batchId, revision } }`). Without it, the chat lives in memory for the session, and a message's Undo applies the turn's own inverse, refused when someone changed those blocks since.

After applying or refusing operations, the editor calls `settleReplay(templateId, messageId, { replayId, direction, applied, sessionId })`. Change `undone` only on `applied: true`; with `applied: false`, or no settlement, keep the message's state. Settle each `replayId` once; later settlements are no-ops. A server-applied `{ applied }` answer is never settled. A settlement failure reaches `onError`, and the local row keeps the direction actually applied to the template.

## Controlling features

Set a member to `false` and its entry point goes: `chat: false` hides the assistant, `rewrite: false` the toolbar button, `fixFinding: false` the Fix buttons on findings, `score: false` the template score, `design: false` design to template, `suggestions: false` the starters. With `createHttpAiProvider`, pass `features: { rewrite: false, conversation: false }`.

## Errors

Reject with an `SdkError` whose `code` the editor knows, and whose message the user can read:

| `code` | When |
| --- | --- |
| `feature_unavailable` | The feature is off for this user |
| `limit_reached` | An allowance is used up; `details: { limit, resetsAt }` |
| `rate_limited` | Too many requests; a `ThrottledError` with `retryAfterMs` |
| `ai_turn_running` | A turn is already running on this template |
| `content_too_large` | The template is too large for the model |
| `ai_output_invalid` | The model's rewrite broke the rules after a repair |
| `ai_provider_error` | The model provider failed |

Undo and Redo may reject with an operation's code (`precondition_failed`, …) as a `CollaborationConflict`. An `AbortError` means the user stopped the call and is never shown. The editor says each failure in words and passes it to `init({ onError })` too.

## In the editor

- **Header:** an **AI** menu with the assistant, design to template and the template score.
- **Chat:** labelled as an AI assistant ("Replies and changes come from AI."), each turn's "Applied N changes" with Undo and Redo, Stop while a turn runs, New chat, starter suggestions. Cmd/Ctrl+Z undoes a whole turn.
- **Paragraph toolbar:** **AI**, with the presets, 16 languages to translate into and a free instruction. The result shows as an **AI suggestion**, merge tags as tags and the markup sanitized; Replace makes it the user's own edit.
- **Template score:** three categories, a link to the Issues panel (accessibility is the linter's), and **Fix with AI** on every finding, with Undo.
- **Design to template:** PNG, JPEG, WebP, GIF or PDF up to 5 MB; the build is one undoable turn.
- **The empty canvas:** shortcuts to the assistant and to design to template.

AI content is always marked as AI, as the EU AI Act's Article 50 asks of systems that interact with people.

## With collaboration

With a [collaboration provider](/backend/collaboration), the AI's operations travel as the user's own batches with `origin: 'ai'`. A backend that honours it broadcasts the batch with an `ai` actor, and other editors show "AI (for Ada) changed 3 blocks" with an outline on those blocks; the editor that asked shows the outline only.

## Events

Failures reach `init({ onError })`. Batches from another session, an AI's included, reach `init({ onRemoteChange })` as for any collaboration batch.

## Headless use

The provider is a plain object: call `chat`, `score` or `rewrite` from your own code with the same requests, and apply the operations with `applyOperations` from `@templatical/types`. `@templatical/ai-kit/testing` has `createMockAiProvider` for UI tests and `runAiProviderConformance` to check a provider you wrote.

## In the playground

The **AI** setup plays recorded turns through `createMockAiProvider`: no model and no keys. Ask to change the title, double-click a paragraph and rewrite it, or score the template and fix a finding. `?history=1` keeps a conversation; `?collaboration=1&user=Ada` in two tabs shows the AI's edits arriving elsewhere.

[Open in playground](https://play.templatical.com/scenes/ai)
