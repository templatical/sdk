---
name: templatical-sdk
description: 'Integration guidance for the Templatical SDK (@templatical/editor). Use when embedding, configuring, theming, extending, or troubleshooting an integration, or answering "how do I" / "is it possible" questions about the SDK — not for authoring or editing an email template.'
---

_The content below this line is written by a later task (design-notes/sdk-skill-plan.md, Task 3)._

<!-- BEGIN GENERATED INDEX -->

_Generated from `@templatical/editor@0.30.0` — 65 pages. Regenerate with `pnpm --filter @templatical/sdk-skill run generate-reference` (wired into the release's `changeset:version` step)._

## Overview

- [Templatical](reference/index.md): Templatical is an embeddable drag-and-drop email editor SDK — saving, versioning, comments, and rendering wired to your own backend.
- [License FAQ](reference/license-faq.md): Plain-English answers about Templatical's FSL-1.1-MIT and MIT licenses — what's allowed, what isn't, when FSL becomes MIT.
- [Showcase & use cases](reference/showcase.md): Where Templatical fits — common product patterns, real-world integrations, and how to add yours to the showcase.

## Getting Started

- [Embedding the editor](reference/getting-started/embedding.md): CSS constraints on the container you mount the editor into, and what breaks when an ancestor violates them.
- [How Rendering Works](reference/getting-started/how-rendering-works.md): Understand the JSON → MJML rendering pipeline in Templatical.
- [Installation](reference/getting-started/installation.md): Install the Templatical email editor via npm or CDN.
- [Quick Start](reference/getting-started/quick-start.md): Get the Templatical email editor running in under 5 minutes.

## Guide

- [AI Agent Skill](reference/guide/agent-skill.md): Design a complete email from a natural-language prompt, preview it in the real editor, and export sendable MJML/HTML — in your own AI coding agent. Free, open-source, no backend or API key.
- [Block Types](reference/guide/blocks.md): Reference for all 14 built-in block types in Templatical.
- [Custom Blocks](reference/guide/custom-blocks.md): Define your own block types with custom fields, Liquid templates, and data sources in Templatical.
- [Block & Template Defaults](reference/guide/defaults.md): Customize default properties for newly created blocks and template settings with blockDefaults and templateDefaults.
- [Display Conditions](reference/guide/display-conditions.md): Conditional block visibility using display conditions in Templatical email templates.
- [Custom Fonts](reference/guide/fonts.md): Configure custom fonts for the email editor's font picker.
- [Internationalization](reference/guide/i18n.md): Configure the editor's UI language with built-in or custom locale support.
- [Images](reference/guide/images.md): Handle image input, integrate custom media pickers, and configure image block properties.
- [Logic Tags](reference/guide/logic-tags.md): Insert and highlight control-flow logic tags in Templatical email templates.
- [Merge Tags](reference/guide/merge-tags.md): Dynamic content via merge tags in Templatical email templates.
- [Migration from BeeFree](reference/guide/migration-from-beefree.md): Convert BeeFree email templates to Templatical format using @templatical/import-beefree.
- [Migration from HTML](reference/guide/migration-from-html.md): Convert HTML email templates to Templatical format using @templatical/import-html.
- [Migrating from hand-written MJML](reference/guide/migration-from-mjml.md): How to move existing MJML email templates into Templatical's visual editor — mapping table, rebuild approach, and what's coming next.
- [Migration from Unlayer](reference/guide/migration-from-unlayer.md): Convert Unlayer email templates to Templatical format using @templatical/import-unlayer.
- [Preview Rendering](reference/guide/preview-rendering.md): Control what the editor's preview surfaces show — labels, sample values, or real data resolved by your backend.
- [Programmatic Templates](reference/guide/programmatic-templates.md): Build email template content programmatically using factory functions.
- [Sections and Columns](reference/guide/sections-and-columns.md): Multi-column layouts with the SectionBlock container in Templatical.
- [Shadow DOM](reference/guide/shadow-dom.md): How Templatical isolates the editor from host page CSS using Shadow DOM, and when to opt out.
- [Styling](reference/guide/styling.md): Block styles, spacing, visibility, and template-level settings in Templatical.
- [Theming](reference/guide/theming.md): Customize the editor's appearance with CSS variables, theme overrides, dark mode, and custom fonts.

## API Reference

- [Editor API](reference/api/editor.md): Complete reference for the init() function, TemplaticalEditorConfig, and TemplaticalEditor instance.
- [Events](reference/api/events.md): Editor event callbacks — onChange, onDirtyChange, onError, and media/merge tag request handlers.
- [Renderer](reference/api/renderer-typescript.md): API reference for @templatical/renderer — convert template JSON to MJML.
- [Types Reference](reference/api/types.md): Complete reference for @templatical/types — shared TypeScript types, block factories, and utilities.

## Connect your backend

- [Comments](reference/backend/comments.md): A threaded review conversation on a template — over your own storage, or Templatical Cloud's.
- [Connect your backend](reference/backend/index.md): Saving, version history, comments, saved blocks, test emails and rendering are each one config key holding methods you implement — against your own stack, or Templatical Cloud's.
- [Rendering & Export](reference/backend/render.md): Turn a template into MJML or sending-ready HTML — locally, on your own backend, or with a single mjml2html endpoint.
- [Saved Blocks](reference/backend/saved-blocks.md): Let users save reusable groups of blocks and insert them into other templates, backed by your own storage.
- [Saving & Loading Templates](reference/backend/templates.md): Wire the editor's save/load lifecycle to your own storage — name, save button, autosave and unsaved-changes guard included.
- [Test Emails](reference/backend/test-email.md): Let users mail themselves the template they're editing, sent through your own infrastructure.
- [Version History](reference/backend/version-history.md): Browse, preview and restore a template's past versions — over your own storage, or Templatical Cloud's.

## Cloud

- [AI Assistant](reference/cloud/ai.md): Generate email content, rewrite text, and convert designs to templates with AI.
- [Authentication](reference/cloud/authentication.md): Configure authentication for Templatical Cloud.
- [Collaboration](reference/cloud/collaboration.md): Real-time co-editing with live cursors and block locking.
- [Comments](reference/cloud/comments.md): Templatical Cloud as one implementation of the comments contract.
- [Getting Started with Cloud](reference/cloud/getting-started.md): Set up Templatical Cloud in your application.
- [Headless API](reference/cloud/headless-api.md): Full programmatic access to templates, media, and rendering.
- [Templatical Cloud](reference/cloud/index.md): Premium hosted features for teams building email tooling at scale.
- [MCP Integration](reference/cloud/mcp.md): Connect AI agents to build and modify templates programmatically via Model Context Protocol.
- [Media Library](reference/cloud/media-library.md): Upload, organize, and manage images with folders and search.
- [Multi-Tenant Architecture](reference/cloud/multi-tenant.md): Project and tenant isolation with API keys.
- [Rendering](reference/cloud/rendering.md): How Templatical Cloud renders a template to MJML and HTML, and why it does not take a render provider.
- [Saved Blocks](reference/cloud/saved-blocks.md): Templatical Cloud as one implementation of the saved-blocks storage contract.
- [Template Scoring](reference/cloud/template-scoring.md): Automated quality checks for deliverability, accessibility, and best practices.
- [Templates](reference/cloud/templates.md): Templatical Cloud as one implementation of the saving-and-loading contract.
- [Test Emails](reference/cloud/test-emails.md): How Templatical Cloud sends test emails, and how to send them from your own infrastructure instead.
- [Version History](reference/cloud/version-history.md): Templatical Cloud as one implementation of the version-history contract.

## Quality

- [Accessibility linter](reference/quality/accessibility/index.md): lintAccessibility checks alt text, color contrast, vague link and button copy, heading structure, and touch targets against WCAG and EU accessibility law.
- [Accessibility rule catalog](reference/quality/accessibility/rule-catalog.md): All 21 lintAccessibility rules — alt text, headings, link and button wording, contrast, touch targets, and preheader text — with default severities.
- [Contributing locales](reference/quality/contributing-locales.md): Add a new locale's rule messages for accessibility, structure, and link rules, plus the vague-text dictionaries the accessibility linter alone uses.
- [Headless usage](reference/quality/headless-usage.md): Run the quality linters headless in Node.js — CI guards, save-time validation, ruleId filtering, and custom rules built with walkBlocks and walkUrls.
- [Quality](reference/quality/index.md): MIT-licensed linter for Templatical templates — accessibility, structure, and link rules, 31 in total, run via lintTemplate() in the editor or in CI.
- [Links linter](reference/quality/links/index.md): lintLinks flags dangerous javascript-protocol hrefs, malformed mailto and tel links, unsupported URL schemes, and staging URLs leaking into templates.
- [Link rule catalog](reference/quality/links/rule-catalog.md): All 5 lintLinks rules — javascript-protocol hrefs, unsupported protocols, malformed mailto/tel URIs, and localhost-or-staging hosts — with default severities.
- [Options](reference/quality/options.md): Reference for LintOptions — the disabled, locale, accessibility, structure, and links fields accepted by lintTemplate and the editor's lint config.
- [Severity & fixes](reference/quality/severity-and-fixes.md): The four-level severity model (error, warning, info, off) shared by every linter, and how auto-fix LintPatch objects apply as undoable edits.
- [Structure linter](reference/quality/structure/index.md): lintStructure catches template JSON that can't safely render — duplicate block IDs, section-column mismatches, nested sections, and empty sections or columns.
- [Structure rule catalog](reference/quality/structure/rule-catalog.md): All 5 lintStructure rules — duplicate block IDs, nested sections, section-column mismatches, and empty sections or columns — with severities and fixes.

<!-- END GENERATED INDEX -->
