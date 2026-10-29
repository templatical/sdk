# Version awareness

**Consulted by:** [integrate.md](integrate.md) · [diagnose.md](diagnose.md) · [localize.md](localize.md)

Resolve the consumer's installed `@templatical/editor` version — from their
lockfile or `package.json` — before answering anything version-sensitive.

- **Pin source reads to that version's tag:**
  `https://raw.githubusercontent.com/templatical/sdk/v<version>/<path>`. No
  auth needed on the public repo. That's the aggregated `v<version>` tag —
  per-package tags (like `@templatical/editor@<version>`) exist for old
  releases but are no longer created; don't construct one. Reading `main`
  quotes unreleased source.
- **The docs site is latest-only.** It describes the release named in
  `https://docs.templatical.com/llms-meta.json`'s `sdkVersion` field — not
  necessarily the consumer's installed version. When the consumer is behind,
  say so, and offer to diff via `docs.templatical.com/changelog.json` rather
  than silently answering from a newer release.
- **The CLI pin can be older than the install.** [cli.md](cli.md) pins the
  CLI this copy of the skill shipped with. When the installed `@templatical/*`
  version is newer, pin that installed version for the session: keep the
  `npx -y` prefix and write `@templatical/template-tools@<installed>`. Say once
  that the skill is older than the SDK, and offer the update from
  [talking.md](talking.md). Never substitute `@latest`.
