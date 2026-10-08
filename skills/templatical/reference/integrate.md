# Install and mount

**Read first:** [failure-modes.md](failure-modes.md) — before editing any of
their files
**Then:** [scaffold.md](scaffold.md) for the procedure to follow when writing
into their repository
**Consult:** [providers.md](providers.md) for the storage contracts ·
[version-awareness.md](version-awareness.md)
**Related:** [diagnose.md](diagnose.md) when a mount already exists and
misbehaves · [docs.md](docs.md) for anything not covered here

`@templatical/editor` is self-contained: Vue, TipTap and its other runtime
dependencies are all bundled inside it. There is **no** framework component —
no `<TemplaticalEditor />`, no Vue SFC export, no `@templatical/react`. The
public API is `init()` / `initCloud()` / `unmount()` in every stack, including
React. The `useRef` + `useEffect` wrapper below is that API used
idiomatically, not a missing-component workaround.

```bash
npm install @templatical/editor
```

`@templatical/renderer`, `@templatical/quality` and `pusher-js` are optional
peers, each gated by a specific feature — install only the ones actually used
(see [failure-modes.md](failure-modes.md)).

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
`sectionWrapper: false` hides Add wrapper on author sections (needed when the
slot sits in a layout card). See [docs.md](docs.md) → `guide/layout`.

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

If the effect re-runs before `init()` resolves (React StrictMode does this in
development), `cancelled` unmounts the editor that arrives late and `instance`
is what the cleanup unmounts once one has settled; unmounting only the ref
leaks an editor.

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
test email, rendering and AI wired in behind an auth endpoint the consumer
hosts — swap the import, add `auth`, nothing else about the mount changes:

```ts
import { initCloud } from "@templatical/editor";

const editor = await initCloud({
  container: "#editor",
  auth: { url: "/api/templatical/token" },
});
```

Issuing keys, plan entitlements and the Cloud account itself are Cloud's own
dashboard — this skill documents `initCloud()`'s shape and the provider
contracts it fills in, not signup. The auth endpoint the consumer's server
needs to implement is in [docs.md](docs.md) → `cloud/getting-started`.

Countdown is Cloud-only. `paletteBlocks` (or any other `init()` key) cannot
turn it on under a plain `init()` — see [failure-modes.md](failure-modes.md).

## Theming

Set `--tpl-user-*` on the container or any ancestor — inheritance crosses the
shadow boundary, so this works in both DOM modes with no JS.
`--tpl-user-primary` / `-primary-hover` / `-primary-light` for brand colour,
`--tpl-user-radius` (plus `-sm` / `-lg`) for radius. Dark values are
`--tpl-user-dark-*` **and** `uiTheme: "dark"` or `"auto"`: tokens alone do
not switch the chrome. The `theme` object on `init()` is the alternative for
runtime-computed values and wins because it is inline style. Do not turn
shadow DOM off to make theming work.
