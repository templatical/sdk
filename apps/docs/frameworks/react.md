---
title: React (Vite)
description: A runnable Vite and React 19 single-page app with the Templatical editor and no backend, the starting point for a React front end on any server.
---

# React (Vite)

[`examples/react-vite`](https://github.com/templatical/sdk/tree/main/examples/react-vite) is a Vite and React 19 single-page app with the editor and no backend. It keeps the template in `localStorage`, stores saved blocks with the editor's `createLocalStorageSavedBlocksProvider()`, and renders MJML in the browser with `@templatical/renderer`. Use it as the starting point for a React front end whose backend is not JavaScript. CI builds the app and runs it in a browser against every change to the SDK.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-vite), or copy it into a new directory:

```bash
npx degit templatical/sdk/examples/react-vite my-app
cd my-app
npm install
npm run dev
```

## The editor component

The component mounts the editor in an effect, and its cleanup unmounts it, including an editor that finishes loading after React StrictMode has cleaned the effect up. `onChange` writes every change to `localStorage`, and the next mount passes it back as `content`. If the editor fails to start or an export fails, the toolbar shows the error message.

`src/email-editor.tsx`

<<< @/../../examples/react-vite/src/email-editor.tsx

## The providers {#providers}

This example passes `savedBlocks`, from `createLocalStorageSavedBlocksProvider()`. To keep templates and saved blocks on a server, pass the `fetch`-based providers from the [Next.js example](/frameworks/nextjs#providers) and implement the routes they call, in any language.

## Moving to production

- Pass a `templates` provider so templates live on your server instead of in one browser's `localStorage`.
- Replace `createLocalStorageSavedBlocksProvider()` with a provider backed by your server, so saved blocks follow the user across browsers.
- Compile `editor.toMjml()`'s output to HTML on your server with the `mjml` package, or pass a `render` provider so `editor.toHtml()` calls your server. [Rendering & Export](/backend/render) covers both.
