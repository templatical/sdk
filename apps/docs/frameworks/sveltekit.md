---
title: SvelteKit
description: A runnable SvelteKit 3 app with the Templatical editor, backed by +server.ts routes for templates, saved blocks, HTML export and test emails.
---

# SvelteKit

[`examples/sveltekit`](https://github.com/templatical/sdk/tree/main/examples/sveltekit) is a SvelteKit 3 app (Svelte 5, adapter-node) that embeds the editor and backs it with its own `+server.ts` routes. SvelteKit 3 reads its configuration from `vite.config.ts`, and the example imports from `src/lib` through the `#lib/*` subpath import that `package.json` declares. It stores templates and saved blocks as JSON files under `./data`, renders HTML export and test emails on the server with `@templatical/renderer` and `mjml`, and writes each test email to `./data/outbox` instead of sending it. CI builds the app and runs it in a browser against every change to the SDK.

## Running the example

[Open in StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/sveltekit)

Or copy it into a new directory:

```bash
npx degit templatical/sdk/examples/sveltekit my-app
cd my-app
npm install
npm run dev
```

## The editor component

The component mounts the editor in `onMount` and returns the cleanup that unmounts it, including an editor that finishes loading after the component has gone. It imports `init()` inside `onMount`, so the editor never runs on the server. Without `?id=` in the URL, it creates a template and writes the new id into the URL with SvelteKit's `goto`. If opening the template fails, the toolbar shows the server's message, such as "Template not found.", with a link that starts a new template. The restart link carries `data-sveltekit-reload`, which makes it a full page load, so the component mounts again and creates a template. The toolbar also shows errors the editor reports through `onError`, such as a saved-block library that fails to load, and a failed export; the next export clears them.

`src/lib/EmailEditor.svelte`

<<< @/../../examples/sveltekit/src/lib/EmailEditor.svelte

## The providers {#providers}

The editor reaches the backend only through these objects. Each method is one `fetch` to a route below. The file is the same in the Next.js, Nuxt, SvelteKit and React Router examples.

`src/lib/templatical/providers.ts`

<<< @/../../examples/sveltekit/src/lib/templatical/providers.ts

## The server routes

Each `+server.ts` file exports one handler per HTTP method. Each handler validates its input, calls the store or the renderer, and answers with JSON or an empty 204. A rejected request gets a 4xx status and `{ message }`, which the editor reports. The handlers read request bodies with `readJson`, which answers a body over adapter-node's `BODY_SIZE_LIMIT` with a 413 that names the setting.

`src/lib/server/read-json.ts`

<<< @/../../examples/sveltekit/src/lib/server/read-json.ts

`src/routes/api/templates/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/templates/+server.ts

`src/routes/api/templates/[id]/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/templates/[id]/+server.ts

`src/routes/api/saved-blocks/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/saved-blocks/+server.ts

`src/routes/api/saved-blocks/[id]/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/saved-blocks/[id]/+server.ts

`src/routes/api/render/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/render/+server.ts

`src/routes/api/test-email/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/test-email/+server.ts

The render and test-email routes compile the template with `renderTemplate()` from `src/lib/server/templatical/render.ts`:

<<< @/../../examples/sveltekit/src/lib/server/templatical/render.ts

## Moving to production

- Replace the function bodies in [`src/lib/server/templatical/store.ts`](https://github.com/templatical/sdk/blob/main/examples/sveltekit/src/lib/server/templatical/store.ts) with calls to your database. Every route that loads or saves templates or saved blocks goes through them.
- Replace `deliver()` in [`src/lib/server/templatical/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/sveltekit/src/lib/server/templatical/outbox.ts) with your email provider. It receives the recipient, the subject and the finished HTML.
- Add authentication to the `+server.ts` routes. They are open in this example.
- Keep the `content-type: application/json` header that `providers.ts` sends on every write. SvelteKit rejects a write with no content type as a cross-site form post when the browser's origin differs from the one adapter-node assumes, which is `https://` unless `PROTOCOL_HEADER` is set.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.ts`: the editor keeps author HTML as written.
- adapter-node rejects request bodies over 512 KB by default. Set `BODY_SIZE_LIMIT` (for example `BODY_SIZE_LIMIT=10M`) if your templates are larger.

[Connect your backend](/backend/) covers the providers this example leaves out: version history, comments and media.
