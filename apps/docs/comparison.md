---
title: Comparison
description: How Templatical compares to Beefree SDK, Unlayer, and GrapesJS + MJML — honest strengths, weaknesses, and when to choose each.
---

# How Templatical compares

If you're picking an embeddable email editor, you've probably shortlisted **Beefree SDK**, **Unlayer**, and **GrapesJS + MJML**. This page is a straight, fact-checked comparison so you can pick the right tool for your team — including the cases where another product fits your needs better than Templatical does.

Every claim links to a primary source at the bottom of the page. If something looks out of date, [open an issue](https://github.com/templatical/sdk/issues) and we'll fix it.

## At a glance

|  | **Templatical** | Beefree SDK | Unlayer | GrapesJS + MJML |
|---|---|---|---|---|
| **License** | FSL-1.1-MIT (auto-MIT after 2y) | Closed source | Wrapper MIT, editor closed | BSD-3-Clause |
| **Self-hostable** | ✅ Fully | ❌ Iframe-only | ❌ Iframe-only | ✅ Fully |
| **Output format** | MJML (native) | Proprietary JSON → HTML via Cloud API | Proprietary JSON → HTML via Cloud API | MJML (via plugin) |
| **Framework** | Mountable from any framework (Vue+TipTap canvas) | iframe SDK (any host) | React-first wrapper, iframe inside | Vanilla JS, React wrapper available |
| **Block / module library** | 14 typed block types | Email + Page + Popup + Document builders | Email + Page + Popup + Document builders | ~20 MJML components |
| **Custom blocks API** | ✅ Open API | Paid tier only (Superpowers, $2,500/mo) | Paid tier only (Scale, $750/mo) | ✅ Open plugin API |
| **AI rewrite / generation** | ✅ Cloud (or self-host the OSS code) | Paid tier (writing assistant, image gen, alt-text) | Paid tier (Scale+ writing) | ❌ |
| **Real-time collaboration** | ✅ Cloud (or self-host the OSS code) | Paid tier ($2,500/mo) | Team-level only (no block locking) | ❌ |
| **Comments / review** | ✅ Cloud (or self-host the OSS code) | Paid tier | Audit tab only | ❌ |
| **Merge tags** | ✅ Built-in | ✅ Built-in | ✅ Built-in (smart on Scale+) | ❌ Build it yourself |
| **Display conditions** | ✅ Built-in | ✅ Built-in | ⚠️ Limited per user reviews | ❌ |
| **Built-in dark mode** | ✅ | ⚠️ Editor UI only | ⚠️ Editor UI only | ❌ |
| **Bilingual i18n (en/de)** | ✅ Built-in, key-parity tested | ✅ 21-language editor UI | ⚠️ Localization gated to Launch+ | ⚠️ Community |
| **TypeScript** | ✅ Strict, end-to-end | Type defs on SDK only | Wrapper types, editor opaque | ✅ Core is TS |
| **Embed price floor (paid)** | Free / self-host | $350–$5,000+/mo | $250–$2,000+/mo | Free |

## Why these rows matter

The interesting thing in this table isn't any single row — it's where the rows **cluster**.

**Custom blocks, full theming, advanced merge tags, display conditions.** In Beefree these features start unlocking at the **Superpowers** tier ($2,500/mo) — Beefree's own pricing page lists custom blocks as a Superpowers-and-up feature. In Unlayer, custom blocks unlock at **Scale** ($750/mo) and custom CSS at **Optimize** ($2,000/mo). In GrapesJS, several of these don't exist out of the box and you build them yourself.

In Templatical, they're part of the open-source SDK — no tier, no paywall.

Concretely:

- 🧩 **[Custom blocks with API-backed data sources](/guide/custom-blocks)** — your domain entities (deals, contacts, products) become first-class drag-and-drop blocks, with content fetched live from your API at preview time.
- 🏷️ **[Merge tags with pluggable syntax](/guide/merge-tags)** — handlebars, liquid, JS literals, or your own — with automatic human-readable label replacement directly in the editor canvas.
- 👁️ **[Display conditions](/guide/display-conditions)** — show/hide blocks per recipient attributes with live editor preview.
- 🎨 **[Full theming via design tokens](/guide/theming)** — 27 OKLch tokens, custom fonts, dark mode. No CSS hacking, no paid tier.
- 📐 **[Template & block defaults](/guide/defaults)** — define your brand once; new templates and blocks pick it up automatically.

That's the practical impact of "open source" beyond the license badge.

::: tip Cloud (in development)
Real-time collaboration with block-level locking, AI rewrite, AI chat, comments, snapshots, and more are coming as the Templatical Cloud tier — currently in development. The implementation is open code in [`@templatical/core/cloud`](https://github.com/templatical/sdk/tree/main/packages/core/src/cloud), so you'll be able to use the managed tier or self-host. [Learn more →](/cloud/)
:::

## Templatical

**Open-source, MJML-output, fully-typed, self-hostable email editor with optional Cloud features available either as a managed tier or as readable OSS code you can host yourself.**

Built around three opinionated decisions:

1. **JSON in, MJML out.** Templates are portable JSON (versionable, diffable, AI-friendly). Output is MJML — meaning [universal email-client compatibility](https://documentation.mjml.io/) and no dependency on a vendor's render API.
2. **Mount anywhere.** The canvas is Vue 3 + TipTap, but you embed it via a vanilla `init()` function — first-class examples for React, Vue, Svelte, Angular, and plain JS.
3. **Cloud features are open code.** AI rewrite, real-time collaboration with block locking, comments, scoring, snapshots — all live in the [`@templatical/core/cloud`](https://github.com/templatical/sdk/tree/main/packages/core/src/cloud) subpath under FSL-1.1-MIT. Use the managed Cloud tier or run your own backend.

**Pick Templatical when:**
- You want to own your email editor (license + self-host) without writing one from scratch.
- MJML's email-client compatibility matters more than a proprietary HTML renderer.
- You like TypeScript and full type safety end-to-end.
- You want collaboration, AI, and comments without paying enterprise per-seat pricing.
- You want a focused, modern email editor and a maintainer who ships fast.

**Don't pick Templatical when:**
- You need popup, page, or document builders in the same tool — Templatical is email-first by design.
- You need a 1,000+-template library shipped on day one — we don't bundle one yet.
- Your team strictly forbids any Vue dependency, even one mounted via a vanilla JS API.

## Beefree SDK

**Mature hosted editor with the deepest feature set on the market, priced for funded startups and enterprises.**

Beefree SDK runs as a hosted iframe served from Beefree's servers. Templates are stored in Beefree's proprietary JSON format and rendered to HTML through Beefree's [Content Services API](https://docs.beefree.io/beefree-sdk/apis/content-services-api/export). The product covers email, page, popup, and document builders, with hosted saved rows, synced rows, multi-language templates, and a 21-language editor UI.

**Pricing** ([source](https://developers.beefree.io/pricing-plans)): Free → Essentials **$350/mo** → Core **$1,000/mo** → Superpowers **$2,500/mo** → Enterprise **$5,000/mo**, with per-user overage fees. The Template Catalog API and 1,500+ template library is a separate add-on. A startup program offers 90% off for 12 months ([source](https://developers.beefree.io/startup-program)).

**Notable tier gating** (per Beefree's pricing page): real-time co-editing and custom blocks are available on Superpowers and above. AI features (writing assistant, text-to-image, alt-text, translation) span paid tiers depending on the specific feature.


## Unlayer

**Easy React drop-in around a hosted editor. The fastest path to an embedded editor in a React app.**

Unlayer publishes [`react-email-editor`](https://github.com/unlayer/react-email-editor) under MIT — a wrapper component that loads the editor as an iframe from Unlayer's servers. Self-hosting the editor is not offered ([upstream issue #99](https://github.com/unlayer/react-email-editor/issues/99)). Unlayer's product covers email, page, popup, and document builders.

**Pricing** ([source](https://unlayer.com/pricing)): Free → Launch **$250/mo** → Scale **$750/mo** → Optimize **$2,000/mo** → Enterprise custom.

**Notable tier gating** (per Unlayer's pricing page): custom blocks and AI-assisted writing on Scale and above; custom CSS and themes on Optimize and above; "Custom OpenAI Connector" on Enterprise. Output is HTML through Unlayer's render API on paid tiers.


## GrapesJS + MJML preset

**Open-source web-builder framework you can pair with the MJML plugin to build an email editor yourself.**

[GrapesJS](https://github.com/GrapesJS/grapesjs) is a BSD-3-Clause web-builder framework with a large community (25k+ stars, 190+ contributors). The [official MJML plugin](https://github.com/GrapesJS/mjml) adds MJML components and live MJML compilation. GrapesJS is a framework, not an email product — features like AI rewrite, real-time collaboration, comments, merge tags, and display conditions are not part of the core or MJML preset; you implement them via the plugin API or pull in third-party plugins.

**Pricing:** Free. Commercial templates and presets are sold by third parties (e.g. [gjs.market](https://gjs.market/grapesjs-email)).


## Where Templatical fits

Templatical is the open-source, MJML-output, fully-typed, self-hostable email editor with optional Cloud features available as open code — a focused, email-first product, not a generic page builder retrofitted for email or a closed iframe SDK.

We invest in architecture, openness, output format, and price floor. If those matter to your team, [start here](/getting-started/installation).

## Sources

Pricing and feature claims as of April 2026. If something is out of date, please [open an issue](https://github.com/templatical/sdk/issues) — we'll fix it.

- Beefree SDK pricing: <https://developers.beefree.io/pricing-plans>
- Beefree Content Services API: <https://docs.beefree.io/beefree-sdk/apis/content-services-api/export>
- Beefree startup program: <https://developers.beefree.io/startup-program>
- Unlayer pricing: <https://unlayer.com/pricing>
- Unlayer self-host issue: <https://github.com/unlayer/react-email-editor/issues/99>
- Unlayer wrapper license: <https://github.com/unlayer/react-email-editor/blob/master/LICENSE>
- GrapesJS repo: <https://github.com/GrapesJS/grapesjs>
- GrapesJS MJML plugin: <https://github.com/GrapesJS/mjml>
- MJML documentation: <https://documentation.mjml.io>
