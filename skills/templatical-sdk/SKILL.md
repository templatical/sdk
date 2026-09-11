---
name: templatical-sdk
description: 'Integration guidance for the Templatical SDK (@templatical/editor). Use when embedding, configuring, theming, extending, or troubleshooting an integration, or answering "how do I" / "is it possible" questions about the SDK — not for authoring or editing an email template.'
---

# Templatical SDK Integration

Integration guidance for `@templatical/editor` — the embeddable drag-and-drop
email editor SDK. Answers "how do I" and "is it possible" questions about the
SDK, and helps install, mount, configure, theme and troubleshoot an
integration in an existing application.

**A different skill authors the email itself.** This skill wires the editor
into an app; `templatical-email` writes and validates the template JSON that
goes inside it. "How do I load a template into the editor?" is this skill.
"Make me a welcome email" is `templatical-email`. "Build a welcome email and
wire it into my app" is both, in that order — author and validate in
`templatical-email` first, then integrate here.

## Install and mount

`@templatical/editor` is self-contained: Vue, TipTap and its other runtime
dependencies are all bundled inside it.

```bash
npm install @templatical/editor
```

`@templatical/renderer`, `@templatical/quality`, `@templatical/media-library`
and `pusher-js` are optional peers, each gated by a specific feature — install
only the ones actually used (see Failure modes, below).

### Vanilla

```html
<div id="editor" style="height: 100vh;"></div>

<script type="module">
  import { init } from "@templatical/editor";
  import "@templatical/editor/style.css";

  const editor = await init({ container: "#editor" });

  // Later, when removing the editor:
  editor.unmount();
</script>
```

### Framework

Same shape in any component-based framework: mount on the container ref,
unmount on cleanup. React shown; Vue, Svelte and Angular equivalents are in
`reference/getting-started/installation.md`, under "Framework integration".

```tsx
import { useEffect, useRef } from "react";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    (async () => {
      const ed = await init({ container: containerRef.current });
      if (!cancelled) editorRef.current = ed;
    })();
    return () => {
      cancelled = true;
      editorRef.current?.unmount();
    };
  }, []);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
```

### Cloud

`initCloud()` is the same mount with Cloud's storage, comments, saved blocks,
test email, rendering and AI wired in behind an auth endpoint the consumer
hosts — swap the import, add `auth`, nothing else about the mount changes:

```ts
import { initCloud } from "@templatical/editor";

const editor = await initCloud({
  container: "#editor",
  auth: { url: "/api/templatical/token" },
});
```

Issuing keys, plan entitlements and the Cloud account itself are Cloud's own
dashboard — this skill documents `initCloud()`'s shape and the provider
contracts it fills in, not signup. The auth endpoint the consumer's server
needs to implement is in `reference/cloud/getting-started.md`.

## Failure modes

A working mount snippet doesn't protect against any of these. Every row is a
verified fact about this SDK, not a general best practice.

| Trap | The rule |
| --- | --- |
| **Duplicate Vue reactivity** | The editor bundles Vue, `@templatical/core` and `@templatical/types` inline, and dedupes `vue`/`@vue/reactivity` to one instance at build time. Add `@templatical/core` — or any other Vue-using `@templatical/*` package — to the consumer's own dependencies and it can resolve to a second, separate reactivity instance with its own dep-tracking `WeakMap`: refs the editor creates are never seen by that second instance's effects, and the editor renders its chrome and then silently ignores every click, drag and keystroke — nothing thrown, nothing logged. Never add a Vue-using `@templatical/*` package to the consumer's own dependencies; the bundled copy is the only one the editor needs. |
| **Tailwind is never a peer** | `dist/style.css` ships fully compiled. `tailwindcss` is a build-time dev dependency of the editor's own project, never a peer — don't tell a consumer to install it; doing so changes nothing about the editor's styles. |
| **The stylesheet subpath** | `import "@templatical/editor/style.css"` — the package's `exports` map resolves that subpath to `dist/style.css` specifically so this works. Forgetting it mounts a fully functional, completely unstyled editor — easy to mistake for a broken integration. |
| **ESM only** | No CJS, no UMD, no `require` export. The `exports` map exposes only an `import` condition plus `types` — there's no `main` field at all. A consumer whose own build is CJS-only needs a bundler that can consume ESM, not a workaround here. |
| **Host style inheritance** | Shadow DOM blocks the host's *rules*, not *inheritance* — twelve typography properties (letter-spacing, word-spacing, text-transform, font-style, font-weight, text-indent, text-align, white-space, list-style-type, cursor, font-variant-numeric, text-shadow), plus font-family/size/line-height/color, cross the boundary in both DOM modes. The editor neutralizes them at its own root. **Don't advise resetting the container** — `all: initial`/`revert` there wipes the `--tpl-user-*` custom properties that are the theming surface, and can break the height chain below. See `reference/getting-started/embedding.md`. |
| **A trapped `position: fixed`** | Any ancestor of the container with `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` below `1`, or a positioned element carrying a `z-index`, becomes a stacking context or a containing block the editor's dialogs resolve against instead of the viewport. Symptoms: dialogs clipped or painted under the host's own chrome, or a drag-and-drop ghost that drifts from the cursor. See `reference/getting-started/embedding.md`. |
| **The height chain** | The container needs a definite height — the editor fills it. Without one, a small anti-collapse floor (~320px) keeps the mount from vanishing outright, but its chrome is positioned assuming real height, so the sidebar's last items, the footer and panel content clip with no way to scroll them into view. Fix the container's height rather than the symptom. |
| **`toHtml()` needs a provider** | The SDK bundles no MJML compiler. `toHtml()` resolves `render.toHtml`, else `toMjml()`'s result through `render.compileMjml`, else rejects — there's no local HTML path, ever. `toMjml()` alone falls back to the local `@templatical/renderer` only when no `render.toMjml` is configured. See Providers, below. |
| **Four optional peers, each lazy and feature-gated** | `@templatical/renderer` (first `toMjml()` call), `@templatical/quality` (Issues sidebar, loaded at mount), `@templatical/media-library` (first media-browser open, `initCloud()` only), `pusher-js` (Cloud realtime connect, `initCloud()` only). Installing one that's unused is dead weight; omitting one that's needed is a silent missing feature, not a thrown error. |
| **The browser floor differs by mount mode** | Default shadow mount: Chrome/Edge 80+, Firefox 101+, Safari 16.4+ (driven by `adoptedStyleSheets`). `shadowDom: false` drops the floor to Firefox 80+ / Safari 14+, at the cost of host-CSS isolation. |

## Providers

Six optional config keys, each a plain object of methods: `templates`,
`versionHistory`, `comments`, `savedBlocks`, `testEmail`, `render`. Every key
stands alone — a feature is absent until its key is passed, not merely
disabled: no half-rendered panel, no dead button.

**On the four storage providers (`templates`, `versionHistory`, `comments`,
`savedBlocks`) every mutation is `false | fn`, and it's required, never
optional.** Passing `false` is a typed statement that the action is
unavailable — calling it rejects, and the editor hides the control for it
rather than rendering one that does nothing. Leaving a mutation off the
object is not the same decision as writing `false`, and a provider has to
make the choice explicit. `render` and `testEmail` are shaped differently:
every `render` method (`toMjml`, `toHtml`, `compileMjml`) is independently
optional, and `testEmail` is a single `send`.

Full contracts, headless use (`useSavedBlocks`, `useVersionHistory`,
`useComments` from `@templatical/core`, for driving a custom UI with no
editor mounted), and Cloud as one implementation of each: `reference/backend/`.

## Version awareness

Resolve the consumer's installed `@templatical/editor` version — from their
lockfile or `package.json` — before answering anything version-sensitive.

- **Pin source reads to that version's tag:**
  `https://raw.githubusercontent.com/templatical/sdk/v<version>/<path>`. No
  auth needed on the public repo. That's the aggregated `v<version>` tag —
  per-package tags (like `@templatical/editor@<version>`) exist for old
  releases but are no longer created; don't construct one. Reading `main`
  quotes unreleased source.
- **`reference/` is latest-only.** It describes the release named in
  `reference/manifest.json`'s `sdkVersion` field — not necessarily the
  consumer's installed version. When the consumer is behind, say so, and
  offer to diff via `docs.templatical.com/changelog.json` rather than
  silently answering from a newer release.

## Scaffolding a new integration

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

### Diagnosing an existing integration

The same table, read backwards. Read the consumer's `init()`/`initCloud()`
call, bundler config and CSS setup, and check each against the failure modes
above. "The editor renders but ignores every click" is the
duplicate-reactivity signature specifically — otherwise close to
undiagnosable, since nothing throws and nothing logs.

## Out of scope

- **Doesn't carry a copy of the block schema.** Get it fresh from the CLI —
  `npx -y @templatical/template-tools@<version> schema` — the same one
  `templatical-email` validates against. A second copy here would drift
  from it.
- **Doesn't run the CDN live preview.** That's `templatical-email`'s live
  mode. This skill verifies the consumer's own app instead — see
  Scaffolding, above.
- **Not a Cloud onboarding flow.** It documents `initCloud()` and the
  provider contracts; signing up, issuing keys, and plan entitlements happen
  in Cloud's own dashboard.
- **Never touches git.** Not a commit, not a branch, not a stash — file
  changes it proposes are the consumer's to review and commit.

<!-- BEGIN GENERATED INDEX -->

_Generated from `@templatical/editor@0.36.0` — 70 pages. Regenerate with `pnpm --filter @templatical/sdk-skill run generate-reference` (wired into the release's `changeset:version` step)._

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

- [AI Agent Skills](reference/guide/agent-skill.md): Two open Agent Skills for Templatical — generate and validate email templates from a prompt, or get integration guidance for embedding @templatical/editor. Free, open-source, no backend or API key.
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
- [Migrating from Chamaileon](reference/guide/migration-from-chamaileon.md): Convert Chamaileon email templates to Templatical format using @templatical/import-chamaileon.
- [Migrating from Easy Email Pro](reference/guide/migration-from-easy-email-pro.md): Convert Easy Email Pro email templates to Templatical format using @templatical/import-easy-email-pro.
- [Migration from HTML](reference/guide/migration-from-html.md): Convert HTML email templates to Templatical format using @templatical/import-html.
- [Migrating from MJML](reference/guide/migration-from-mjml.md): Convert MJML email templates to Templatical format using @templatical/import-mjml.
- [Migrating from Stripo](reference/guide/migration-from-stripo.md): Convert Stripo email templates to Templatical format using @templatical/import-stripo.
- [Migrating from Topol](reference/guide/migration-from-topol.md): Convert Topol.io email templates to Templatical format using @templatical/import-topol.
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
- [Connect your backend](reference/backend/index.md): Saving, version history, comments, saved blocks, media, test emails and rendering are each one config key holding methods you implement — against your own stack, or Templatical Cloud's.
- [Media](reference/backend/media.md): Back the editor's image picker with your own gallery, DAM or CMS — or use the bundled browser-local store.
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
- [Media Library](reference/cloud/media-library.md): Templatical Cloud as one implementation of the media storage contract.
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
