---
title: Next.js
description: A runnable Next.js 16 App Router app with the Templatical editor, backed by API routes for templates, saved blocks, HTML export and test emails.
---

# Next.js

[`examples/nextjs`](https://github.com/templatical/sdk/tree/main/examples/nextjs) is a Next.js 16 App Router app that embeds the editor and backs it with its own API routes. It stores templates and saved blocks as JSON files under `./data`, renders HTML export and test emails on the server with `@templatical/renderer` and `mjml`, and writes each test email to `./data/outbox` instead of sending it. CI builds the app and runs it in a browser against every change to the SDK.

## Running the example

Copy it into a new directory:

```bash
npx degit templatical/sdk/examples/nextjs my-app
cd my-app
npm install
npm run dev
```

## The editor component

A client component mounts the editor. It imports `init()` inside the effect, so the editor never runs on the server, and its cleanup unmounts the editor, including one that finishes loading after React StrictMode has cleaned the effect up. Without `?id=` in the URL, it creates a template and writes the new id into the URL. If opening the template fails, the toolbar shows the server's message, such as "Template not found.", with a link that starts a new template. The toolbar also shows errors the editor reports through `onError`, such as a saved-block library that fails to load, and a failed export; the next export clears them.

`app/email-editor.tsx`

<<< @/../../examples/nextjs/app/email-editor.tsx

## The providers {#providers}

The editor reaches the backend only through these objects. Each method is one `fetch` to a route below. The file is the same in the Next.js, Nuxt, SvelteKit and React Router examples.

`lib/templatical/providers.ts`

<<< @/../../examples/nextjs/lib/templatical/providers.ts

## The server routes

Each route validates its input, calls the store or the renderer, and answers with JSON or an empty 204. A rejected request gets a 4xx status and `{ message }`, which the editor reports.

`app/api/templates/route.ts`

<<< @/../../examples/nextjs/app/api/templates/route.ts

`app/api/templates/[id]/route.ts`

<<< @/../../examples/nextjs/app/api/templates/[id]/route.ts

`app/api/saved-blocks/route.ts`

<<< @/../../examples/nextjs/app/api/saved-blocks/route.ts

`app/api/saved-blocks/[id]/route.ts`

<<< @/../../examples/nextjs/app/api/saved-blocks/[id]/route.ts

`app/api/render/route.ts`

<<< @/../../examples/nextjs/app/api/render/route.ts

`app/api/test-email/route.ts`

<<< @/../../examples/nextjs/app/api/test-email/route.ts

The render and test-email routes compile the template with `renderTemplate()` from `lib/templatical/server/render.ts`:

<<< @/../../examples/nextjs/lib/templatical/server/render.ts

## Moving to production

- Replace the function bodies in [`lib/templatical/server/store.ts`](https://github.com/templatical/sdk/blob/main/examples/nextjs/lib/templatical/server/store.ts) with calls to your database. Every route that loads or saves templates or saved blocks goes through them.
- Replace `deliver()` in [`lib/templatical/server/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/nextjs/lib/templatical/server/outbox.ts) with your email provider. It receives the recipient, the subject and the finished HTML.
- Add authentication to the API routes. They are open in this example.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.ts`: the editor keeps author HTML as written.
- Before you add cookie-based authentication, reject writes that don't send `content-type: application/json`, or add CSRF tokens: a cross-site page can send a `text/plain` body without a preflight, and these routes read any body as JSON.

[Connect your backend](/backend/) covers the providers this example leaves out: version history, comments and media.
