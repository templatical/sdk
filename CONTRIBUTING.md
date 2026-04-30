# Contributing to Templatical

Thanks for your interest in contributing! Templatical is built and maintained by a solo developer, and outside contributions are genuinely appreciated — bug fixes, docs improvements, new locales, custom blocks, and feature ideas all welcome.

## Where to start

Not sure what to pick up?

- 🟢 **Issues labeled [`good first issue`](https://github.com/templatical/sdk/labels/good%20first%20issue)** — small, well-scoped, no deep architecture knowledge required.
- 📝 **Improve docs** — fix typos, clarify confusing sections, add missing examples. Docs live in `apps/docs/`. See the [bilingual docs](#bilingual-docs) section before submitting.
- 🌍 **Add a locale** — copy `packages/editor/src/i18n/en.ts` to `packages/editor/src/i18n/<locale>.ts` and translate every key. Same for `packages/media-library/src/i18n/`. Tests verify key parity, so missing keys will fail CI.
- 🧩 **Build a custom block example** — see the [custom blocks guide](https://docs.templatical.com/guide/custom-blocks).
- 💡 **Propose a feature** — open a [Discussion](https://github.com/templatical/sdk/discussions) first if it's substantial. We can talk through design before you write code.

## Architecture overview

Before writing non-trivial code, read **[`CLAUDE.md`](./CLAUDE.md)** at the repo root. It documents:

- The 6-package monorepo layout and dependency graph
- Build order (matters: media-library before types)
- The `useEditorCore` composable that both `Editor.vue` and `CloudEditor.vue` share
- TypeScript path mappings between packages (so you don't need to build before typecheck)
- The `tpl:` Tailwind prefix and CSS isolation strategy
- Cloud subpath (`@templatical/core/cloud`) vs OSS core
- Test conventions and assertion rules

For block-level concerns, the docs are usually the right reference: [block reference](https://docs.templatical.com/guide/blocks), [theming](https://docs.templatical.com/guide/theming), [renderer API](https://docs.templatical.com/api/renderer-typescript).

## Getting set up

### Prerequisites

- Node.js >= 22 (the engine requirement)
- [pnpm](https://pnpm.io/) >= 9 (run `corepack enable` once and the repo's pinned version is used automatically)
- A modern browser for the playground / E2E tests

### One-time setup

```bash
git clone https://github.com/templatical/sdk.git
cd sdk
pnpm install
pnpm run build      # required once, so subsequent commands have dist/
pnpm run test       # verify everything passes locally
```

### Development loop

```bash
pnpm install          # install / update deps
pnpm run build        # build all packages (tsup + vite)
pnpm run test         # vitest across all packages
pnpm run test:e2e     # Playwright E2E (against the playground)
pnpm run lint         # ESLint
pnpm run format       # Prettier auto-fix
pnpm run format:check # Prettier check (CI uses this)
pnpm run typecheck    # tsc / vue-tsc per package, no build needed
pnpm run ci           # all of the above sequentially (matches CI)
```

Run the playground while iterating on editor code:

```bash
cd apps/playground && pnpm run dev
```

Run the docs site while iterating on docs:

```bash
cd apps/docs && pnpm run dev
```

## Tests

**Every code change must include tests.** Bug fixes need a regression test that fails before your fix and passes after. Features need both happy-path and unhappy-path coverage.

Test conventions are documented in detail in [`CLAUDE.md`](./CLAUDE.md#tests). The short version:

- **Location:** `tests/**/*.test.ts` per package (except `import-beefree`, which uses `src/__tests__/`).
- **Framework:** Vitest 3 for unit tests, Playwright for E2E.
- **Regression sensitivity:** every test must assert on **concrete values or state**. Never use `.toBeDefined()`, `.toBeTruthy()`, or `.not.toThrow()` as the only assertion — pair with a value check or a state check.
- **Coverage:** test happy path, unhappy path (error branches), and edge cases. Test every `if/else` branch, every `try/catch`, every early `return`.
- **Mocking:** see `CLAUDE.md` for established patterns (API clients, AuthManager, WebSocket, SSE streaming, inject-dependent composables, fake timers).

## Bilingual docs

Templatical's docs are published in **English and German**. When you change docs:

- Edit `apps/docs/<page>.md` for English.
- Edit `apps/docs/de/<page>.md` for German (same path under `de/`).
- If you don't speak German, English-only PRs are fine — flag the missing translation in the PR description and someone will follow up.

The same rule applies to i18n keys in `packages/editor/src/i18n/` and `packages/media-library/src/i18n/`. Tests fail if `en.ts` and `de.ts` keys diverge.

## Changesets

Templatical uses [`@changesets/cli`](https://github.com/changesets/changesets) for versioning. **Every PR that changes code in a published package must include a changeset.**

```bash
pnpm exec changeset
```

This walks you through:
1. Selecting which packages your change affects
2. Picking a bump type (`patch` / `minor` / `major`)
3. Writing a summary line that becomes the changelog entry

Commit the generated `.changeset/*.md` file alongside your code changes.

PRs that touch only docs, tests, or internal tooling don't need a changeset.

## Pull request checklist

Before opening a PR:

- [ ] Tests added or updated (and they fail without your change)
- [ ] `pnpm run ci` passes locally (lint + typecheck + build + test)
- [ ] E2E still passes (`pnpm run test:e2e`) — if your change touches the editor UI
- [ ] Docs updated (en + de if user-facing)
- [ ] Changeset added (`pnpm exec changeset`)
- [ ] PR description explains the *why*, not just the *what*

Keep PRs small and focused. One concern per PR — reviewers move faster, and you avoid having an unrelated test failure block your fix.

## Code style

- TypeScript strict mode — no `any` for public APIs (it's allowed in tests and internal helpers, see ESLint config).
- ESLint + Prettier handle most formatting decisions. Run `pnpm run format` before pushing.
- Use named exports unless there's a strong reason for a default export.
- For Vue components, use `<script setup lang="ts">`. The repo conventions in [`CLAUDE.md`](./CLAUDE.md#conventions) cover specifics (i18n via `useI18n()`, `tpl:` Tailwind prefix, lazy-loading heavy deps, `_destroyed` guards on async work).

## Where to ask questions

- 💬 **[GitHub Discussions](https://github.com/templatical/sdk/discussions)** — design questions, "how do I…?", showcase what you've built.
- 🐛 **[Issues](https://github.com/templatical/sdk/issues)** — concrete bug reports and feature requests.
- 🔐 **[Security advisories](https://github.com/templatical/sdk/security)** — private disclosure for vulnerabilities (see [`SECURITY.md`](./SECURITY.md) when present).

Avoid discussing design decisions in inline PR comments before opening the PR — Discussions are easier to find later.

## License

By contributing, you agree that your contributions will be licensed under the same license as the package you're contributing to:

- **MIT** for `@templatical/types`, `@templatical/renderer`, `@templatical/import-beefree`
- **FSL-1.1-MIT** (auto-converts to MIT after 2 years) for `@templatical/editor`, `@templatical/core`, `@templatical/media-library`

See [`LICENSE`](./LICENSE) and [`LICENSE-MIT`](./LICENSE-MIT) for full terms, and [the license FAQ](https://docs.templatical.com/license-faq) for plain-English answers.
