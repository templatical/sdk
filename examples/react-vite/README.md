# Templatical + React (Vite)

A Vite + React 19 single-page app with the Templatical email editor and no backend. The template is kept in `localStorage`, saved blocks use the editor's built-in `createLocalStorageSavedBlocksProvider()`, and **Export MJML** renders the template with `@templatical/renderer`. It's the starting point for apps whose backend isn't JavaScript: keep this component and point the editor's providers at your own API.

## Running the example

[Open it on StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-vite), or copy it and run it locally:

```bash
npx degit templatical/sdk/examples/react-vite my-app
cd my-app
npm install
npm run dev
```

## Files

| File | Role |
|---|---|
| `src/email-editor.tsx` | mounts the editor with React StrictMode-safe cleanup |
| `src/main.tsx` | renders it in `StrictMode` |

## Connecting a backend

The full-stack examples implement the editor's providers as one `fetch` per method: see [`examples/nextjs/lib/templatical/providers.ts`](../nextjs/lib/templatical/providers.ts). Implement the same routes in any language, then pass those providers to `init()`.

Docs: [docs.templatical.com/frameworks/react](https://docs.templatical.com/frameworks/react)
