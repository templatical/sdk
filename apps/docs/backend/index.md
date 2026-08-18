---
title: Connect your backend
description: Saving, version history, comments, saved blocks, test emails and rendering are each one config key holding methods you implement — against your own stack, or Templatical Cloud's.
---

# Connect your backend

The editor edits a template. Where that template is stored, what its past looks like, who commented on it, where a test send goes, how it becomes sending-ready HTML — all of that lives in your stack, and the editor reaches it through a plain object you pass to `init()`.

That object is a **provider**. There are six, they are all optional, and they all work the same way.

## The providers

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',

  templates: myTemplateStore, // save and load
  versionHistory: myVersionStore, // past states — browse, preview, restore
  comments: myCommentStore, // threaded review, anchored per block
  savedBlocks: myBlockLibrary, // reusable groups of blocks
  testEmail: mySender, // mail this template to a person
  render: myRenderer, // MJML and HTML output
});
```

Each key stands alone, and a feature is **absent until you pass its key**: no `versionHistory`, no history control — not a disabled button, not an empty panel, and none of that UI is downloaded either.

`init({ container })` on its own is a working editor that persists nothing.

## What you implement

<!-- prettier-ignore -->
| Provider | The editor gives you | You implement |
| --- | --- | --- |
| [Saving & loading](/backend/templates) | inline name field, save button, save status, `Cmd`/`Ctrl`+`S`, autosave, unsaved-changes guard | `load` · `create` · `save` |
| [Version history](/backend/version-history) | header control, version list, preview on the canvas with its own banner, restore with confirmation | `list` · `get` · `create` · `restore` |
| [Comments](/backend/comments) | review panel, threads and replies, per-block count badges, resolve and reopen | `list` · `create` · `update` · `delete` · `setResolved` |
| [Saved blocks](/backend/saved-blocks) | pick session on the canvas, searchable browser with live preview, insert-at-position, rename, delete | `list` · `create` · `update` · `delete` |
| [Test emails](/backend/test-email) | header trigger, recipient control, shape validation, accurate preview, sending and error states | `send` |
| [Rendering & export](/backend/render) | `toMjml()` and `toHtml()`, custom blocks pre-resolved, fonts resolved | any of `toMjml` · `toHtml` · `compileMjml` |

The editor keeps what is fiddly and the same for everybody: dirty tracking, a debounced autosave that pauses during undo, a preview that honours display conditions, the confirmation before a restore discards unsaved work. You keep where the bytes go, who may read them, and what your API looks like.

On the four storage providers every mutation is `false | fn` and **required**, not optional: passing `false` states that the action is unavailable. Calling it rejects, and wherever the editor renders a control for it, that control is hidden rather than disabled. Each provider page covers its own — [saved blocks](/backend/saved-blocks#controlling-permissions) has the fullest treatment. `render` and `testEmail` are shaped differently: every `render` method is independently optional, and `testEmail` is a single `send`.

::: warning Not a security boundary
Providers run in the user's browser. These flags shape the UI; they do not protect your API. Who may open a template, who may delete a shared saved block, which address a test may reach — enforce all of it on your server as well.
:::

## IDs

Ids come back from your `create()`; the editor never invents one. A template id is whatever your storage already calls it — a database key, a slug, a document id.

That id is also the join key. Version history and comments are both scoped to a template, so their controls appear only once `create()` or `load()` has attached one.

## Errors

Every provider method may reject. The editor reports the error through `onError`, surfaces it where the user is looking — the save status, the dialog they are in — and **leaves its own state untouched**. Nothing is marked saved that wasn't, and a failed delete does not make an entry disappear from the list.

Several of those messages reach the UI verbatim, so write them for the person who will read them.

## Callbacks

Two more seams reach your backend, but as plain functions rather than provider objects — nothing to withhold, no ids, no `false`:

```ts
type OnRequestMedia = (context?: MediaRequestContext) => Promise<MediaResult | null>;
type ResolvePreview = (context: PreviewResolveContext) => Promise<TemplateContent>;
```

- **`onRequestMedia`** opens your own media picker and returns what the user chose. Documented with the rest of image handling in [Images](/guide/images).
- **`resolvePreview`** hands the template to your backend and renders what comes back, so a preview shows real recipient data instead of merge-tag labels. Display-only: the result reaches preview surfaces and is never saved, sent or exported. See [Preview rendering](/guide/preview-rendering).

## Headless use

`useSavedBlocks`, `useVersionHistory` and `useComments` are exported from `@templatical/core`, so a provider can drive your own interface with no editor mounted at all. Each page's *Headless use* section has the surface.

## Templatical Cloud

Don't want to build any of this? Templatical Cloud implements all of them. Point `initCloud()` at an auth endpoint and saving, version history, comments, saved blocks, test sending and rendering all work — no storage to run, no endpoints to write, no MJML compiler to host.

```ts
import { initCloud } from '@templatical/editor';

const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
});
```

It also adds what the open-source editor has no contract for at all:

- **AI** — generate content from a prompt, rewrite a selection, turn a design into a template
- **Real-time collaboration** — live cursors, presence and block locking over a managed WebSocket
- **Media library** — uploads, folders, search and cropping
- **Template scoring** — automated deliverability and accessibility checks

Same editor, same block model, same contracts: Cloud is a first-party implementation of the interfaces on this page, not a fork. You can still bring your own block library or your own sender and let Cloud handle the rest.

[Explore Templatical Cloud →](/cloud/)
