# Providers

**Consulted by:** [integrate.md](integrate.md)
**Detail:** [docs.md](docs.md) starts with the reference page matching the provider, then follows its required setup and contract links

Optional config keys, each a plain object of methods: `templates`,
`versionHistory`, `comments`, `savedBlocks`, `media`, `testEmail`, `render`,
`collaboration`, `ai`. Most keys stand alone; `collaboration` requires `templates`. A feature is absent until its key
is passed, not merely disabled: no half-rendered panel, no dead button.

**On the storage providers (`templates`, `versionHistory`, `comments`,
`savedBlocks`, `media`) every mutation is `false | fn`, and it's required,
never optional.** Passing `false` is a typed statement that the action is
unavailable — calling it rejects, and the editor hides the control for it
rather than rendering one that does nothing. Leaving a mutation off the
object is not the same decision as writing `false`, and a provider has to
make the choice explicit. `list` / `load` have no `false` option — without
them there is nothing to open. `render` and `testEmail` are shaped
differently: every `render` method (`toMjml`, `toHtml`, `compileMjml`) is
independently optional, and `testEmail` is a single `send`.

`collaboration` is a session, not storage: `join`, `submit` and
`operationsAfter`, plus `acquireLock` / `renewLock` / `releaseLock`, which are
optional together (no lock methods, no locks). It needs `templates`, whose
`load` must return the template's `revision`; with it every edit reaches the
backend as an operation through `submit`, so `templates.save` receives only
renames, and undo sends inverse operations the backend may refuse. The
backend applies operations with `applyOperations` from `@templatical/types`
and owns a lock by session id and user identity together. `onRemoteChange`
reports another session's edits.

`ai` brings your own AI backend: one `false | fn` member per feature
(`chat`, `fixFinding`, `rewrite`, `altText`), plus
`chatAttachments: false | true` (true means chat accepts image/PDF files; no effect with chat false), and an optional `conversation` (`list`, `clear`, `undo`, `redo`,
`settleReplay`) for stored history, whose Undo and Redo are settled in two
phases. `createHttpAiProvider({ baseUrl })` from `@templatical/ai-kit/client`
speaks the documented wire, and `@templatical/ai-kit/server` builds that
backend on any Fetch-API runtime with your model and keys. AI needs a
loaded template (`templates` or `collaboration`); with `collaboration`, its
edits travel as the user's batches marked `origin: 'ai'`. The contract and
`@templatical/ai-kit` are MIT.

The editor has no template browser of its own. After wiring `templates`, the
host still calls `editor.load(id)` or `editor.create(...)` — a missing Save
button is the absent key, not a bug. `useSavedBlocks` / `useVersionHistory` /
`useComments` from `@templatical/core` drive a **custom UI with no editor
mounted**. They are not how you attach a provider to an editor that is
already up.

Full contracts and Cloud as one implementation of each: [docs.md](docs.md) →
the `backend/` pages.

Chat attachments accept PNG, JPEG, WebP, GIF and PDF: at most 4 files, each at most 5 MB, at most 10 MB together. Import from screenshot or PDF opens chat after the file pick and waits for the author to send. History retains only `{ name, kind }`. Text-only adapters set `features: { chatAttachments: false }`. Fetch `backend/ai` and `api/ai-kit` through [docs.md](docs.md), then check with `runAiWireConformance`.

Fix with AI and Write alt text require `@templatical/quality` installed and lint on. With quality missing or lint off (`lint.disabled: true`), neither action appears. They also need a loaded template, their callable provider member and a matching finding. The AI assistant itself needs `chat` and a loaded template, independent of quality.
