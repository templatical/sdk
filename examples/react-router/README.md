# Templatical + React Router

A React Router 8 (framework mode) app that embeds the Templatical email editor and backs it with its own resource routes. Templates load and save through `/api/templates`, and saved blocks through `/api/saved-blocks`. HTML export and test emails render on the server with `@templatical/renderer` and `mjml`. Everything is stored as JSON files under `./data`. React Router's framework mode is what Shopify's app template is built on.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-router), or copy it and run it locally:

```bash
npx degit templatical/sdk/examples/react-router my-app
cd my-app
npm install
npm run dev
```

## Files

| File | Role |
|---|---|
| `app/components/email-editor.tsx` | mounts the editor |
| `app/lib/templatical/providers.ts` | the editor's providers, one `fetch` per method |
| `app/routes/api.*.ts` | the resource routes those providers call |
| `app/lib/templatical/store.server.ts` | JSON-file storage, the file to swap for your database |
| `app/lib/templatical/render.server.ts` | template → MJML → HTML |
| `app/lib/templatical/outbox.server.ts` | `deliver()`, the function to swap for Resend, SES or SMTP |

`store.server.ts`, `render.server.ts`, `outbox.server.ts` and `providers.ts` have the same contents as `store.ts`, `render.ts`, `outbox.ts` and `providers.ts` in the Next.js, Nuxt and SvelteKit examples. React Router keeps a `.server.ts` module out of the browser bundle, which is why the suffix is there.

## Moving to production

- Replace the bodies in `store.server.ts` with your database.
- Replace `deliver()` with your email provider.
- Add authentication to the resource routes, which are open in this example.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.server.ts`: the editor keeps author HTML as written.
- Before you add cookie-based authentication, reject writes that don't send `content-type: application/json`, or add CSRF tokens: a cross-site page can send a `text/plain` body without a preflight, and these routes read any body as JSON.

This example leaves out:
- a page listing templates
- template ids scoped to a user or a tenant
- the version-history, comments and media providers. [Connect your backend](https://docs.templatical.com/backend/) covers them.

Docs: [docs.templatical.com/frameworks/react-router](https://docs.templatical.com/frameworks/react-router)
