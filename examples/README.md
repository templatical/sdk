# Examples

Working integrations of the Templatical editor, each checked in CI against every change to the SDK. Each one is a standalone app: open it on StackBlitz, or copy it with `npx degit templatical/sdk/examples/<name> my-app`.

| Example | Stack | Backend | Try it | Docs |
|---|---|---|---|---|
| [`nextjs`](./nextjs) | Next.js 16, App Router | API routes + JSON files | [StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nextjs) | [Next.js](https://docs.templatical.com/frameworks/nextjs) |
| [`nuxt`](./nuxt) | Nuxt 4 | server routes + JSON files | [StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nuxt) | [Nuxt](https://docs.templatical.com/frameworks/nuxt) |
| [`sveltekit`](./sveltekit) | SvelteKit 3, Svelte 5 | `+server.ts` routes + JSON files | [StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/sveltekit) | [SvelteKit](https://docs.templatical.com/frameworks/sveltekit) |
| [`react-router`](./react-router) | React Router 8, framework mode | resource routes + JSON files | [StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-router) | [React Router](https://docs.templatical.com/frameworks/react-router) |
| [`react-vite`](./react-vite) | Vite + React 19 | none: localStorage | [StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-vite) | [React](https://docs.templatical.com/frameworks/react) |

The full-stack examples share `store.ts`, `render.ts`, `outbox.ts` and `providers.ts` byte for byte and differ only in their framework glue. A test in the SDK repo checks that the copies match.

## Versions

Each example depends on `@templatical/*` at the current release, and every release updates these ranges. Between a release being merged and its publish to npm finishing, which takes minutes, a fresh install fails with `ETARGET`. Retry once the publish is done.
