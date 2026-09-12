# Scaffolding a new integration

**Read first:** [failure-modes.md](failure-modes.md)
**Follows:** [integrate.md](integrate.md), which decides what the mount should
look like
**Related:** [diagnose.md](diagnose.md) if the result misbehaves

Propose before writing. A scaffold that edits an unfamiliar repository
unannounced is the failure this procedure exists to avoid.

1. **Detect.** Package manager from the lockfile (`pnpm-lock.yaml` /
   `package-lock.json` / `yarn.lock` / `bun.lockb`). Framework and bundler
   from `package.json` and its config files. TypeScript from `tsconfig.json`.
   Whether `@templatical/editor` is already installed, and at what version.
2. **Propose, then wait.** Name the packages to add, the files to create or
   edit, and the mount point — then wait for a go-ahead. Don't edit an
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
