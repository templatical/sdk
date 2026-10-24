# Scaffolding a new integration

**Read first:** [failure-modes.md](failure-modes.md)
**Follows:** [integrate.md](integrate.md), which decides what the mount should
look like
**Related:** [diagnose.md](diagnose.md) if the result misbehaves

Propose before writing. A scaffold that edits an unfamiliar repository
unannounced is the failure this procedure exists to avoid.

1. **Detect.** Package manager from the lockfile (`pnpm-lock.yaml` /
   `package-lock.json` / `yarn.lock` / `bun.lockb` / `bun.lock`). Framework
   and bundler from `package.json` and its config files. TypeScript from
   `tsconfig.json`. Whether `@templatical/editor` is already installed, and
   at what version. Install `@templatical/editor` and `@templatical/quality`
   as direct dependencies of the app.
   Install other optional peers only when their feature was asked for. Also allow the packages an explicitly requested provider integration needs: the HTTP AI path needs `@templatical/ai-kit` for its client and server imports. Never add `vue`, `tailwindcss`, or `@templatical/core` to mount the editor.
2. **Propose, then wait.** Name the packages to add, the files to create or
   edit, and the mount point. Propose quality for the Issues panel and lint badges
   and let the user decline it — then wait for a go-ahead. Don't edit an
   unfamiliar codebase unannounced.
3. **Write.** Install with the consumer's own package manager. Create the
   container with a definite height, the mount call, and the `style.css`
   import. Add provider or theming config only where it was actually asked for.
4. **Verify by running the consumer's dev server** and reading its console
   and network for errors — never by asking the user to check themselves. A
   blank editor with a 404 on `style.css` looks identical to a working one
   until something actually looks.
5. **Report** what changed, what was left alone, and what's still needed — a
   provider, an optional peer, a Cloud auth endpoint.

For AI assistant file attachments or screenshot/PDF import, consult [providers.md](providers.md) and fetch `backend/ai`, `api/ai-kit` and `guide/bring-your-own-ai` through [docs.md](docs.md). Check `chat` is a function, `chatAttachments` is true and a template is loaded. Text-only backends set `features: { chatAttachments: false }`; use `runAiWireConformance` to check multipart generate and upload limits. The author sends after the import picker; no automatic turn starts.
