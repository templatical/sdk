---
title: Showcase & use cases
description: Where Templatical fits — common product patterns, real-world integrations, and how to add yours to the showcase.
---

# Showcase & use cases

Templatical is purpose-built to be the email-composition layer of a larger product. This page describes the patterns it fits best — and is the place where teams who ship Templatical in production can list themselves.

## Common use cases

These are the integration patterns we see most often. Each describes how Templatical typically fits, what's worth knowing up front, and which packages are most relevant.

### Transactional email tool

You're building (or extending) a transactional email API — Postmark, Resend, SES wrappers, internal sending platforms. Customers connect their codebase, then need a way to design and version the templates the API sends.

**Templatical fits because:**
- Templates are JSON — versionable, diffable, AI-friendly, easy to store next to your customers' data.
- MJML output renders consistently across Outlook, Gmail, Apple Mail, and the long tail of clients.
- The renderer runs in Node, so you can compile to HTML server-side at send time without a vendor-hosted render API.

**Likely setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) for the visual editor in your dashboard, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) on your backend to compile to HTML before sending.

### Newsletter or marketing-email SaaS

You're building a Mailchimp-style product, an automation tool, or a creator-newsletter platform. Email composition is one of several features your customers need.

**Templatical fits because:**
- Drop-in editor mounts with one function call — no rewrite of your existing dashboard.
- Theming via design tokens means your customers' emails feel native to your brand, not Templatical's.
- Display conditions and merge tags are built in — important for personalization-heavy newsletter use.
- Cloud features (AI rewrite, comments, snapshots) are available either as managed Cloud or as open-source code you self-host.

**Likely setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) embedded in your customer dashboard, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) for HTML compilation, optional Cloud tier for AI/collab.

### CRM or marketing automation product

You're building a CRM, a sales-engagement tool, or a marketing automation platform where customers send branded emails as one workflow among many.

**Templatical fits because:**
- It's not a separate "email designer" tab — it embeds inline alongside contact records, campaign builders, and automation flows.
- Custom blocks let you surface your product's data (contact fields, deal info, calculated values) as first-class content blocks customers can drop into emails.
- Real-time collaboration lets sales and marketing teams co-edit campaign templates without clobbering each other.

**Likely setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) with `customBlocks` registered for your domain entities, plus [`@templatical/core/cloud`](https://www.npmjs.com/package/@templatical/core) for collab and comments.

### Internal email composer

You're not building a customer-facing product — you need a controlled tool for your team to design transactional and marketing emails, with the JSON output stored in your own systems.

**Templatical fits because:**
- Self-hostable in full. The OSS SDK has no required cloud dependency.
- Bilingual (en/de) out of the box, with a clean path to add more locales for international teams.
- TypeScript-strict end-to-end, which makes it easy to wire into existing internal tooling and codegen pipelines.

**Likely setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) inside your internal portal, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) in your job runners or send pipeline.

### Headless / programmatic template generation

You're not embedding a visual editor at all — you want to generate templates from data programmatically, version them in source control, and render them through a deterministic pipeline.

**Templatical fits because:**
- The block system has factory functions (`createTitleBlock`, `createImageBlock`, …) and full TypeScript types — you can build templates entirely in code with full type safety.
- The renderer is a pure function with no DOM dependency. Run it in serverless, edge, or Node.

**Likely setup:** [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) for factories and types, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) for MJML output, no editor needed.

See [Programmatic Templates](/guide/programmatic-templates) for a full walkthrough of this pattern.

## Built with Templatical?

If your team ships Templatical in production, we'd love to feature you here. Open a pull request adding your entry, or [start a discussion](https://github.com/templatical/sdk/discussions) and we'll do it together.

What we list:
- A short product description (one sentence)
- Your logo and a link
- Optional: a one-paragraph note on how you use Templatical (which packages, which features, anything notable)

This page populates as adoption grows. Be the first.

::: tip Sponsorship & support
If your company depends on Templatical, you can also support development directly on [GitHub Sponsors](https://github.com/sponsors/orkhanahmadov). Sponsorship is independent from being listed here — listing is free, and it stays free.
:::
