# cloud.templatical.com

Placeholder marketing site for Templatical Cloud. Vite + Vue 3 SSG, deployed to Cloudflare Pages.

## Local development

```bash
# from repo root
bun install

# dev server
bun run --filter '@templatical/cloud-site' dev
```

## Build

```bash
bun run --filter '@templatical/cloud-site' build
```

Output: `apps/cloud-site/dist/`. Every route is prerendered to static HTML.

## Cloudflare Pages setup

- Project: `templatical-cloud-site` (new Pages project)
- Production branch: `main`
- Build command: `bun install && bun run --filter '@templatical/cloud-site' build`
- Build output: `apps/cloud-site/dist`
- Root directory: _leave empty (monorepo root)_
- Environment variable: `NODE_VERSION=20`
- Custom domain: `cloud.templatical.com`
- Enable **Cloudflare Web Analytics** on the Pages project.

## Content

All marketing copy lives in `src/content/`:

- `features/*.md` — one per feature (11 files)
- `faq.md` — frequently asked questions

Feature metadata (slug, title, icon, tagline) is in `src/features.ts`.
