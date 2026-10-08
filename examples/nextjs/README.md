# Templatical + Next.js

A Next.js 16 (App Router) app that embeds the Templatical email editor and backs it with its own API routes. Templates load and save through `/api/templates`, and saved blocks through `/api/saved-blocks`. HTML export and test emails render on the server with `@templatical/renderer` and `mjml`. Everything is stored as JSON files under `./data`.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nextjs), or copy it and run it locally:

```bash
npx degit templatical/sdk/examples/nextjs my-app
cd my-app
npm install
npm run dev
```

## Files

| File | Role |
|---|---|
| `app/email-editor.tsx` | mounts the editor in a client component |
| `lib/templatical/providers.ts` | the editor's providers, one `fetch` per method |
| `app/api/**/route.ts` | the routes those providers call |
| `lib/templatical/server/store.ts` | JSON-file storage, the file to swap for your database |
| `lib/templatical/server/render.ts` | template → MJML → HTML |
| `lib/templatical/server/outbox.ts` | `deliver()`, the function to swap for Resend, SES or SMTP |

`store.ts`, `render.ts`, `outbox.ts` and `providers.ts` have the same contents in the Nuxt, SvelteKit and React Router examples.

## Moving to production

- Replace the bodies in `store.ts` with your database.
- Replace `deliver()` with your email provider.
- Add authentication to the API routes, which are open in this example.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.ts`: the editor keeps author HTML as written.
- Before you add cookie-based authentication, reject writes that don't send `content-type: application/json`, or add CSRF tokens: a cross-site page can send a `text/plain` body without a preflight, and these routes read any body as JSON.

This example leaves out:
- a page listing templates
- template ids scoped to a user or a tenant
- the version-history, comments and media providers. [Connect your backend](https://docs.templatical.com/backend/) covers them.

Docs: [docs.templatical.com/frameworks/nextjs](https://docs.templatical.com/frameworks/nextjs)
