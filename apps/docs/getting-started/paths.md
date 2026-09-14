---
title: Starting points
description: Which docs page to open first — embed the editor, connect your backend, generate a template from a prompt, or compile JSON to sendable HTML.
---

# Starting points

Commercial use is free. The [License FAQ](/license-faq) is the competing-product restriction in plain language.

## Embed the editor

Mount `@templatical/editor` in your product. Any framework, or none.

- [Quick Start](/getting-started/quick-start) — mount, save JSON, compile MJML to HTML
- [Installation](/getting-started/installation) — packages, CDN, React / Vue / Svelte / Angular
- [Embedding](/getting-started/embedding) — container height, stacking, `position: fixed`

## Connect storage and send

Saving, versions, comments, saved blocks, media, test email, and HTML export are keys you pass to `init()`. Omit a key and that UI is absent.

- [Connect your backend](/backend/) — the contracts
- [Author features](/getting-started/author-features) — what people in the editor actually see

## Generate a template from a prompt

Your coding agent writes and validates JSON. No Templatical account.

- [Agent Skill](/guide/agent-skill)
- [Template Tools](/api/template-tools) — the same validate / render / import / live commands from a shell

## JSON to sendable HTML

The editor stores JSON. `@templatical/renderer` emits MJML. Any MJML library compiles HTML. You send through whatever you already use.

- [How Rendering Works](/getting-started/how-rendering-works)
- [Renderer API](/api/renderer-typescript)
- [Template Tools](/api/template-tools) `render --format html`

## Leave a hosted builder

Unlayer, BeeFree, Stripo, and the others are products with their own accounts. Importers map their exports onto Templatical JSON.

- [Hosted builders](/getting-started/hosted-builders)
