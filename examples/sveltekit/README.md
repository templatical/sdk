# Templatical + SvelteKit

A SvelteKit 3 (Svelte 5, adapter-node) app that embeds the Templatical email editor and backs it with its own `+server.ts` routes. Templates load and save through `/api/templates`, and saved blocks through `/api/saved-blocks`. HTML export and test emails render on the server with `@templatical/renderer` and `mjml`. Everything is stored as JSON files under `./data`.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/sveltekit), or copy it and run it locally:

```bash
npx degit templatical/sdk/examples/sveltekit my-app
cd my-app
npm install
npm run dev
```

## Files

| File | Role |
|---|---|
| `src/lib/EmailEditor.svelte` | mounts the editor in `onMount` |
| `src/lib/templatical/providers.ts` | the editor's providers, one `fetch` per method |
| `src/routes/api/**/+server.ts` | the routes those providers call |
| `src/lib/server/templatical/store.ts` | JSON-file storage, the file to swap for your database |
| `src/lib/server/templatical/render.ts` | template → MJML → HTML |
| `src/lib/server/templatical/outbox.ts` | `deliver()`, the function to swap for Resend, SES or SMTP |

`store.ts`, `render.ts`, `outbox.ts` and `providers.ts` have the same contents in the Next.js, Nuxt and React Router examples.

## Moving to production

- Replace the bodies in `store.ts` with your database.
- Replace `deliver()` with your email provider.
- Add authentication to the `+server.ts` routes, which are open in this example.
- Keep the `content-type: application/json` header that `providers.ts` sends on every write. SvelteKit rejects a write with no content type as a cross-site form post when the browser's origin differs from the one adapter-node assumes, which is `https://` unless `PROTOCOL_HEADER` is set.
- Sanitize HTML blocks on the server before you store or send them, or pass `allowHtmlBlocks: false` to `renderToMjml` in `render.ts`: the editor keeps author HTML as written.
- adapter-node rejects request bodies over 512 KB by default. Set `BODY_SIZE_LIMIT` (for example `BODY_SIZE_LIMIT=10M`) if your templates are larger.

This example leaves out:
- a page listing templates
- template ids scoped to a user or a tenant
- the version-history, comments and media providers. [Connect your backend](https://docs.templatical.com/backend/) covers them.

Docs: [docs.templatical.com/frameworks/sveltekit](https://docs.templatical.com/frameworks/sveltekit)
