# Install and mount

For template language versions, `localization`, disabled versions, locale locks or missing/stale translations, follow [localize.md](localize.md). It owns the compatibility rule (no template migration, one version for every `@templatical/*` package) and the `validate --locale` check.

For `translation`, Translate availability, provider errors or tag masking, follow [localize.md](localize.md) and fetch `backend/translation` through [docs.md](docs.md). Check `translation`, `localization` and an enabled non-default language view before changing the backend. Verify mask placeholders and run `runTranslationConformance` for backend conformance; then validate the saved language with `validate --locale de`.

For brand names changing during Translate, use `localization.doNotTranslate` from [providers.md](providers.md) and the [localize.md](localize.md) round trip; pass the same list to both strings helpers. Fetch `backend/translation` for matching and limits, then check that the provider sees a placeholder and the saved field keeps the term.

**Read first:** [failure-modes.md](failure-modes.md) — before editing any of
their files
**Then:** [scaffold.md](scaffold.md) for the procedure to follow when writing
into their repository
**Consult:** [providers.md](providers.md) for the storage contracts ·
[version-awareness.md](version-awareness.md)
**Related:** [diagnose.md](diagnose.md) when a mount already exists and
misbehaves · [docs.md](docs.md) for anything not covered here

`@templatical/editor` bundles its **required runtime**: Vue, TipTap and its
other required runtime dependencies. `@templatical/quality` is an optional
dependency installed separately by default. There is **no** framework component —
no `<TemplaticalEditor />`, no Vue SFC export, no `@templatical/react`. The
public API is `init()` / `initCloud()` / `unmount()` in every stack, including
React. The `useRef` + `useEffect` wrapper below is that API used
idiomatically, not a missing-component workaround.

```bash
npm install @templatical/editor
```

`@templatical/quality` is an optional dependency of the editor and installs by default. Leaving it out is supported: the editor works without it and hides the Issues tab. The default install is recommended for the Issues panel and lint badges. `@templatical/renderer` and `pusher-js` stay optional peers; install them only for the features used (see [failure-modes.md](failure-modes.md)).

## Host capability map

Every `init()` option, by the host need it answers. When integrating, decide
every row explicitly before writing the mount: **use**, **not needed** or
**later**. Report the decisions to the user: each **use** and **later** row
with a one-line reason, and the **not needed** options together on one line.
A row the request does not settle is a question for the user, never a silent
skip.

Before building anything next to the editor (a preview-as bar, a media
picker, a token inserter, a condition dialog), find its row. The editor
usually has the hook, and a host-built copy sits outside the editor's
preview, undo and export. Fetch the row's Docs page through
[docs.md](docs.md) for the contract before wiring it; the storage providers'
shared rules are in [providers.md](providers.md).

| Host need | Options | When | Docs |
| --- | --- | --- | --- |
| Save and open templates in the host's backend | `templates` | The editor adds the name field, Save and the unsaved-changes guard; autosave is `templates.autoSave: true` (off by default). The host still opens a template with `editor.load(id)` or `editor.create()`. | `backend/templates` |
| Keep the host's own persistence, or open existing JSON | `content`, `onChange` | `content` seeds the canvas (the editor edits a copy); `onChange` hands back the debounced content for the host to store. Use when the host owns saving and wants no editor Save button. | `backend/templates` |
| Warn before a client-side route change drops unsaved edits | `onDirtyChange` | `beforeunload` cannot see SPA navigation. Fires on every dirty flip, with or without `templates`. | `backend/templates` |
| Browse and restore past versions | `versionHistory` | Needs a loaded template. The editor never records a version itself: the host's `templates.save` decides when one is stored. | `backend/version-history` |
| Sendable HTML from `toHtml()` | `render` | The SDK bundles no MJML compiler, so `toHtml()` rejects without `render.compileMjml` or `render.toHtml`. A local `toMjml()` needs the optional `@templatical/renderer` peer. | `backend/render` |
| Self-hosted social icons in exported email | `socialIconsBaseUrl` | Local `toMjml()` / `toHtml()` path only. A `render.toMjml` provider passes the URL to its own `renderToMjml`. | `api/renderer-typescript` |
| Preview an email as a specific recipient, with real data and evaluated logic | `resolvePreview` | Called with `{ content, recipient? }` when a preview opens and when the test-email recipient changes; `recipient` is set only in the test-email dialog. Returns `TemplateContent` resolved by the host's backend; with `layout`, `content` is the composed document, so return that shape. Display-only: never in `getContent()`, a send or an export. Supersedes `MergeTag.sample`, the no-backend option for value tags. | `guide/preview-rendering` |
| Authors send themselves a test | `testEmail` | One `send({ recipient, content })`, plus `mjml` with `includeMjml`. `allowedRecipients` and `defaultRecipient` shape the dialog but are not a security boundary: validate the recipient on the server. | `backend/test-email` |
| Personalization placeholders (first name, unsubscribe link) | `mergeTags` | `syntax` picks the token format (`liquid`, `handlebars`, `mailchimp`, `ampscript` or a custom `SyntaxPreset` object); `tags` lists them with `label`, `value` and an optional `sample` for previews; `onRequest` opens the host's own picker. | `guide/merge-tags` |
| Conditionals and loops inside text | `logicTags` | Adds Insert logic with `tags` and open/close `pairs`, or the host's picker through `onRequest`. Typed or pasted logic is highlighted without it. | `guide/logic-tags` |
| Show or hide a block per audience or segment | `displayConditions` | Wraps a block in before/after strings that the sending platform evaluates. A preset list, raw boxes with `allowCustom`, or the host's own condition builder through `onRequest` (see Display conditions below). | `guide/display-conditions` |
| A media library over the host's storage | `media` | The editor's library modal over a `MediaProvider`; `createLocalStorageMediaProvider()` for demos. Without it (or `onRequestMedia`) image fields are URL-only. | `backend/media` |
| The host's own DAM or picker (Bynder, Cloudinary, a host modal) | `onRequestMedia` | The editor calls it instead of its library and fills the field from the returned `{ url, alt?, width?, height? }`; it wins over `media`. Dropped files arrive in `context.files`. | `guide/images` |
| Stored image srcs that are not directly displayable (file names, asset ids) | `resolveImageUrl` | Maps a stored src to a preview URL on the canvas, cached per src for the editor's lifetime, failures included. Content and export keep the stored value. | `guide/images` |
| The host's own block types (product card, testimonial, data from its API) | `customBlocks` | Fields plus a Liquid template, optionally filled from the host's API. Follow [custom-block.md](custom-block.md). | `guide/custom-blocks` |
| Reusable blocks or groups authors save and insert again | `savedBlocks` | The editor's save action and browser over the host's storage; `createLocalStorageSavedBlocksProvider()` for demos. Not `customBlocks`, which defines block types. | `backend/saved-blocks` |
| Limit or reorder the block palette | `paletteBlocks` | Allowlist and order; custom blocks as `custom:<type>`; omitted or `[]` shows the full palette. Hiding a type never changes how existing content renders. | `api/editor` |
| Platform chrome around every email (header, footer, imprint, background mat) | `layout`, `sectionWrapper` | A shell with one `slot`, composed at preview and export, never in `getContent()`. `sectionWrapper: false` hides Add wrapper; a card layout already disables it without the flag. | `guide/layout` |
| House style for new blocks and empty templates | `blockDefaults`, `templateDefaults` | `blockDefaults` applies to new built-in blocks (custom blocks keep their own field defaults) and wins over the localized default text; `templateDefaults` applies only when no content is supplied. Existing content keeps its values. | `guide/defaults` |
| Brand fonts | `fonts` | `customFonts` adds web fonts, `defaultFont` is the font new templates start on, `builtIns` narrows or removes the built-in list. | `guide/fonts` |
| Brand colours in every colour picker | `colors` | `presets` show as a grid; `allowCustom: false` together with `presets` locks authors to them. | `api/editor` |
| Hide template settings the host controls | `templateSettings` | `fields` is an allowlist, or `fields: false` for no Settings tab. Presentation only: set the hidden values in the content the host loads. | `api/editor` |
| Match the host's design system and dark mode | `theme`, `uiTheme` | Prefer `--tpl-user-*` CSS variables (see Theming below); `theme` is for runtime-computed values. Dark values apply when `uiTheme` is `"dark"`, or `"auto"` (the default) on a dark system. | `guide/theming` |
| White-label: no Templatical footer | `branding` | `false` hides "Powered by Templatical"; the licence does not require it. | `api/editor` |
| Editor interface language | `locale` | The chrome's language and the default text of new Title, Paragraph and Button blocks. It also seeds a blank template's `settings.locale` unless `templateDefaults.locale` is set; loaded content keeps its own. Language versions are `localization`. | `guide/i18n` |
| Review comments on a template | `comments`, `user` | `comments` needs `user` (`{ id, name }`) and a loaded template; an optional `subscribe` adds realtime. `user` also leaves this user's own sessions out of the collaborator bar. | `backend/comments` |
| Real-time co-editing over the host's backend | `collaboration`, `onRemoteChange` | Needs `templates`, whose `load` returns the `revision`; edits travel as operations through `submit`. `onRemoteChange` tells the host about another session's batches. | `backend/collaboration` |
| AI assistant, rewrite, alt text, Fix with AI | `ai` | Over the host's own model and backend; `createHttpAiProvider` from `@templatical/ai-kit/client` speaks the documented wire. Needs a loaded template; Fix with AI and Write alt text also need `lint` on. | `backend/ai` |
| Quality checks in the Issues panel | `lint` | Needs the optional `@templatical/quality`, installed by default. A category set to `false` is off; `disabled: true` removes the Issues tab and badges. | `quality/options` |
| Language versions of one template | `localization`, `onLocaleChange` | `localization.locales` enables the versions authors add in Languages; `onLocaleChange` reports the language on the canvas. Follow [localize.md](localize.md). | `guide/localized-templates` |
| Machine translation of language versions | `translation` | Translate shows in an enabled non-default language view, so it needs `localization`; independent of `ai`. Keep model and service keys on the backend. | `backend/translation` |
| Host code that reaches into the editor's DOM, or old browsers | `shadowDom` | Keep the default `true`. `false` only when host code needs `document.querySelector` on editor internals (`container.shadowRoot` usually works instead), or for browsers without `adoptedStyleSheets` (Firefox before 101, Safari before 16.4). Never for theming. | `guide/shadow-dom` |
| The host handles small viewports itself | `smallScreenNotice` | Below a ~768px viewport the editor shows a "use a larger screen" notice; `false` renders the editor anyway. The check reads the viewport, not the container. | `api/editor` |
| Live previews of HTML blocks on the canvas | `htmlBlockPreview` | Renders each HTML block in a sandboxed iframe with no scripts instead of a placeholder card. Off by default; export is unaffected. | `api/editor` |

Not in the map, because no feature hangs on them: `container` is the mount
target in every snippet, `onError` hands editor errors to the host's
logger, and `changeDebounce` tunes the timer behind `onChange` and, with
`templates.autoSave`, autosave (2000 ms by default).

## Vanilla

```html
<div id="editor" style="height: 100vh;"></div>

<script type="module">
  import { init } from "@templatical/editor";
  import "@templatical/editor/style.css";

  const editor = await init({ container: "#editor" });

  // Later, when removing the editor:
  editor.unmount();
</script>
```

No bundler: load the CDN build (`dist/cdn/editor.js` + `editor.css`) from a
`<script type="module">` and a `<link>`. Pin an exact version in that URL for
anything beyond a quick test — the unversioned latest is only for trying it.
The container must be able to host a shadow root (`div`, `section`, `article`;
never `table`, `button`, or `input`). See [docs.md](docs.md) →
`getting-started/installation` under CDN.

Platform chrome around every email — view-in-browser, Imprint, a grey mat, a
card — is `init({ layout })`, a JSON document with one `slot`. It is not
blocks in the template JSON and not a `render.toMjml` splice. Preview and
`toMjml()` / `toHtml()` compose the shell; `getContent()` does not.
`sectionWrapper: false` hides Add wrapper on author sections; a card layout
already disables it, so the flag only removes the control. See [docs.md](docs.md) → `guide/layout`.

## Framework

Same shape in any component-based framework: mount on the container ref,
unmount on cleanup. React shown; Vue (`onMounted` / `onUnmounted`), Svelte and
Angular equivalents are in [docs.md](docs.md) → `getting-started/installation`,
under "Framework integration". A host that is already Vue is **not** license
to add `@templatical/core` (or any other Vue-using `@templatical/*` package)
so the app "shares" Vue — the editor bundles and dedupes its own copy
regardless of the host framework.

Next.js App Router: the file that calls `useRef` / `useEffect` / `init()` is a
Client Component (`'use client'` at the top). `init()` is browser-only. There
is no Next-specific package and no SSR configuration step.

```tsx
import { useEffect, useRef } from "react";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let instance: TemplaticalEditor | null = null;
    (async () => {
      const ed = await init({ container });
      if (cancelled) {
        ed.unmount();
        return;
      }
      instance = ed;
      editorRef.current = ed;
    })();
    return () => {
      cancelled = true;
      instance?.unmount();
      editorRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
```

If the component unmounts while `init()` is pending (a route change, a
conditional render), that call still mounts an editor when it resolves:
`cancelled` unmounts that late editor, and `instance` is what the cleanup
unmounts once one has settled. Unmounting only the ref leaks an editor.

## Working examples

Complete apps, built and run in CI against every SDK change. To start a
project from one, copy it:
`npx degit templatical/sdk/examples/<name> my-app`. To read one, fetch its
docs page as raw markdown, which inlines every file the page shows.

| Example | Stack | Code | Docs page |
| --- | --- | --- | --- |
| `nextjs` | Next.js 16 App Router, API routes | https://github.com/templatical/sdk/tree/main/examples/nextjs | https://docs.templatical.com/frameworks/nextjs.md |
| `nuxt` | Nuxt 4, server routes | https://github.com/templatical/sdk/tree/main/examples/nuxt | https://docs.templatical.com/frameworks/nuxt.md |
| `sveltekit` | SvelteKit 3, `+server.ts` routes | https://github.com/templatical/sdk/tree/main/examples/sveltekit | https://docs.templatical.com/frameworks/sveltekit.md |
| `react-router` | React Router 8 framework mode, resource routes | https://github.com/templatical/sdk/tree/main/examples/react-router | https://docs.templatical.com/frameworks/react-router.md |
| `react-vite` | Vite + React, no backend (`localStorage`) | https://github.com/templatical/sdk/tree/main/examples/react-vite | https://docs.templatical.com/frameworks/react.md |

The full-stack examples share these files byte for byte (React Router names the server-side ones `*.server.ts`):
- `store.ts`, the storage to replace
- `render.ts`, which turns a template into MJML and HTML
- `outbox.ts`, holding `deliver()`, the email sender to replace
- `providers.ts`, the editor's `fetch`-based providers

Only the framework glue differs. When a consumer's repository uses one of these frameworks, follow that example's file layout. The provider contracts are in [providers.md](providers.md).

## Cloud

`initCloud()` is the same mount with Cloud's storage, comments, saved blocks,
test email and rendering wired in behind an auth endpoint the consumer
hosts — swap the import, add `auth`, nothing else about the mount changes:

```ts
import { initCloud } from "@templatical/editor";

const editor = await initCloud({
  container: "#editor",
  auth: { url: "/api/templatical/token" },
});
```

Cloud AI is not available. For the AI assistant, Rewrite, Fix with AI and Write alt text today, bring your own AI provider through `init({ ai })`: [providers.md](providers.md) and [docs.md](docs.md) → `/backend/ai` and `/guide/bring-your-own-ai`.

Issuing keys, plan entitlements and the Cloud account itself are Cloud's own
dashboard — this skill documents `initCloud()`'s shape and the provider
contracts it fills in, not signup. The auth endpoint the consumer's server
needs to implement is in [docs.md](docs.md) → `cloud/getting-started`.

Countdown is Cloud-only. `paletteBlocks` (or any other `init()` key) cannot
turn it on under a plain `init()` — see [failure-modes.md](failure-modes.md).

## Display conditions

`init({ displayConditions })` offers a preset list and, with `allowCustom`, raw before/after boxes. `displayConditions.onRequest` replaces that UI: the block settings show Add condition, and Edit when one is set. The callback receives `{ block }` or `{ current, block }` (copies) and returns a `DisplayCondition` or `null` to cancel. `current.data` is opaque host state, returned so a builder can reopen filled in; it must survive `JSON.stringify`. With `onRequest` set, `conditions` and `allowCustom` are ignored. A resolved value needs string `label`, `before` and `after`. The Remove condition button clears the condition. See [docs.md](docs.md) → `guide/display-conditions`.

## Theming

Set `--tpl-user-*` on the container or any ancestor — inheritance crosses the
shadow boundary, so this works in both DOM modes with no JS.
`--tpl-user-primary` / `-primary-hover` / `-primary-light` for brand colour,
`--tpl-user-radius` (plus `-sm` / `-lg`) for radius. Dark values are
`--tpl-user-dark-*` **and** `uiTheme: "dark"` or `"auto"`: tokens alone do
not switch the chrome. The `theme` object on `init()` is the alternative for
runtime-computed values and wins because it is inline style. Do not turn
shadow DOM off to make theming work.

For AI assistant file attachments or screenshot/PDF import, consult [providers.md](providers.md) and fetch `backend/ai`, `api/ai-kit` and `guide/bring-your-own-ai` through [docs.md](docs.md). Check `chat` is a function, `chatAttachments` is true and a template is loaded. Text-only backends set `features: { chatAttachments: false }`; use `runAiWireConformance` to check multipart generate and upload limits. The author sends after the import picker; no automatic turn starts.
