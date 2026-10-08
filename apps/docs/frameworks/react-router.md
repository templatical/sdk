---
title: React Router
description: A runnable React Router 8 framework-mode app with the Templatical editor, backed by resource routes for templates, saved blocks, HTML export and test emails.
---

# React Router

[`examples/react-router`](https://github.com/templatical/sdk/tree/main/examples/react-router) is a React Router 8 app in framework mode, the successor to Remix and the base of Shopify's app template. It embeds the editor and backs it with resource routes: route modules with a `loader` or an `action` and no component. It stores templates and saved blocks as JSON files under `./data`, renders HTML export and test emails on the server with `@templatical/renderer` and `mjml`, and writes each test email to `./data/outbox` instead of sending it. CI builds the app and runs it in a browser against every change to the SDK.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-router), or copy it into a new directory:

```bash
npx degit templatical/sdk/examples/react-router my-app
cd my-app
npm install
npm run dev
```

## The editor component

The component mounts the editor in an effect. It imports `init()` inside the effect, so the editor never runs on the server, and its cleanup unmounts the editor, including one that finishes loading after React StrictMode has cleaned the effect up. Without `?id=` in the URL, it creates a template and writes the new id into the URL with `navigate` from `useNavigate`. If opening the template fails, the toolbar shows the server's message, such as "Template not found.", with a link that starts a new template.

`app/components/email-editor.tsx`

<<< @/../../examples/react-router/app/components/email-editor.tsx

## The providers {#providers}

The editor reaches the backend only through these objects. Each method is one `fetch` to a route below. The file is the same in the Next.js, Nuxt, SvelteKit and React Router examples.

`app/lib/templatical/providers.ts`

<<< @/../../examples/react-router/app/lib/templatical/providers.ts

## The server routes

`app/routes.ts` registers each resource route. Server-only modules end in `.server.ts`, which keeps them out of the client bundle. Each route validates its input, calls the store or the renderer, and answers with JSON or an empty 204. A rejected request gets a 4xx status and `{ message }`, which the editor reports.

`app/routes.ts`

<<< @/../../examples/react-router/app/routes.ts

`app/routes/api.templates.ts`

<<< @/../../examples/react-router/app/routes/api.templates.ts

`app/routes/api.templates.$id.ts`

<<< @/../../examples/react-router/app/routes/api.templates.$id.ts

`app/routes/api.saved-blocks.ts`

<<< @/../../examples/react-router/app/routes/api.saved-blocks.ts

`app/routes/api.saved-blocks.$id.ts`

<<< @/../../examples/react-router/app/routes/api.saved-blocks.$id.ts

`app/routes/api.render.ts`

<<< @/../../examples/react-router/app/routes/api.render.ts

`app/routes/api.test-email.ts`

<<< @/../../examples/react-router/app/routes/api.test-email.ts

The render and test-email routes compile the template with `renderTemplate()` from `app/lib/templatical/render.server.ts`:

<<< @/../../examples/react-router/app/lib/templatical/render.server.ts

## Moving to production

- Replace the function bodies in [`app/lib/templatical/store.server.ts`](https://github.com/templatical/sdk/blob/main/examples/react-router/app/lib/templatical/store.server.ts) with calls to your database. Every route that loads or saves templates or saved blocks goes through them.
- Replace `deliver()` in [`app/lib/templatical/outbox.server.ts`](https://github.com/templatical/sdk/blob/main/examples/react-router/app/lib/templatical/outbox.server.ts) with your email provider. It receives the recipient, the subject and the finished HTML.
- Add authentication to the resource routes. They are open in this example.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.server.ts`: the editor keeps author HTML as written.
- Before you add cookie-based authentication, reject writes that don't send `content-type: application/json`, or add CSRF tokens: a cross-site page can send a `text/plain` body without a preflight, and these routes read any body as JSON.

[Connect your backend](/backend/) covers the providers this example leaves out: version history, comments and media.
