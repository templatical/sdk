---
title: Nuxt
description: A runnable Nuxt 4 app with the Templatical editor, backed by server routes for templates, saved blocks, HTML export and test emails.
---

# Nuxt

[`examples/nuxt`](https://github.com/templatical/sdk/tree/main/examples/nuxt) is a Nuxt 4 app that embeds the editor and backs it with its own server routes. It stores templates and saved blocks as JSON files under `./data`, renders HTML export and test emails on the server with `@templatical/renderer` and `mjml`, and writes each test email to `./data/outbox` instead of sending it. CI builds the app and runs it in a browser against every change to the SDK.

## Running the example

[Open in StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nuxt)

Or copy it into a new directory:

```bash
npx degit templatical/sdk/examples/nuxt my-app
cd my-app
npm install
npm run dev
```

## The editor component

A client-only component (`.client.vue`) mounts the editor in `onMounted` and unmounts it in `onBeforeUnmount`, including an editor that finishes loading after the component has gone. It waits one tick first, because Nuxt renders a client-only component's template after the component mounts. It imports `init()` inside `onMounted`, so the editor never runs on the server. Without `?id=` in the URL, it creates a template and writes the new id into the URL. If opening the template fails, the toolbar shows the server's message, such as "Template not found.", with a link that starts a new template. The toolbar also shows errors the editor reports through `onError`, such as a saved-block library that fails to load, and a failed export; the next export clears them.

`app/components/EmailEditor.client.vue`

<<< @/../../examples/nuxt/app/components/EmailEditor.client.vue

## The providers {#providers}

The editor reaches the backend only through these objects. Each method is one `fetch` to a route below. The file is the same in the Next.js, Nuxt, SvelteKit and React Router examples.

`app/utils/templatical/providers.ts`

<<< @/../../examples/nuxt/app/utils/templatical/providers.ts

## The server routes

Nuxt maps each file under `server/api/` to a route, and the method in its name (`.get`, `.post`, …) to the HTTP method. Each route validates its input, calls the store or the renderer, and answers with JSON or an empty 204. A rejected request gets a 4xx status and `{ message }`, which the editor reports.

`server/api/templates/index.post.ts`

<<< @/../../examples/nuxt/server/api/templates/index.post.ts

`server/api/templates/[id].get.ts`

<<< @/../../examples/nuxt/server/api/templates/[id].get.ts

`server/api/templates/[id].patch.ts`

<<< @/../../examples/nuxt/server/api/templates/[id].patch.ts

`server/api/saved-blocks/index.get.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/index.get.ts

`server/api/saved-blocks/index.post.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/index.post.ts

`server/api/saved-blocks/[id].patch.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/[id].patch.ts

`server/api/saved-blocks/[id].delete.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/[id].delete.ts

`server/api/render.post.ts`

<<< @/../../examples/nuxt/server/api/render.post.ts

`server/api/test-email.post.ts`

<<< @/../../examples/nuxt/server/api/test-email.post.ts

The render and test-email routes compile the template with `renderTemplate()` from `server/utils/templatical/render.ts`:

<<< @/../../examples/nuxt/server/utils/templatical/render.ts

## Moving to production

- Replace the function bodies in [`server/utils/templatical/store.ts`](https://github.com/templatical/sdk/blob/main/examples/nuxt/server/utils/templatical/store.ts) with calls to your database. Every route that loads or saves templates or saved blocks goes through them.
- Replace `deliver()` in [`server/utils/templatical/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/nuxt/server/utils/templatical/outbox.ts) with your email provider. It receives the recipient, the subject and the finished HTML.
- Add authentication to the server routes. They are open in this example.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.ts`: the editor keeps author HTML as written.
- Before you add cookie-based authentication, reject writes that don't send `content-type: application/json`, or add CSRF tokens: a cross-site page can send a body with no `content-type`, or with `multipart/form-data`, without a preflight, and these routes parse either as JSON.

[Connect your backend](/backend/) covers the providers this example leaves out: version history, comments and media.
