---
title: AI Agent Skill
description: One free, open-source Agent Skill that writes, edits, imports and validates Templatical email templates from a prompt, previews them live in the real editor, and installs, scaffolds or diagnoses an @templatical/editor integration — no backend or API key.
---

# AI Agent Skill

Templatical ships one [Agent Skill](https://agentskills.io) — **free, open-source, and running entirely in your own AI coding agent:** `templatical`. Ask it for an email and it writes, edits, imports, validates or previews a template; ask it about the SDK and it installs, mounts, scaffolds or troubleshoots an `@templatical/editor` integration. One skill, and it decides for itself which job a request needs.

There is no backend and no API key: your agent is the inference. Nothing is sent to Templatical.

## Install

```bash
npx skills add templatical/sdk
```

To update:

```bash
npx skills update
```

If your agent doesn't pick the skill up afterwards, check that it is enabled in the agent's own skill list.

## What it can do

- **Build** a template from a brief — "make a product-launch email", "design a welcome email".
- **Edit** an existing template as a scoped change, not a rewrite.
- **Import** a template from another builder — Unlayer, BeeFree, Stripo, Topol, Chamaileon, Easy Email Pro, MJML, or HTML.
- **Validate** a template's JSON against the block schema and get back precise, per-block errors.
- **Export** a template as sendable MJML or HTML.
- **Preview it live** in the real Templatical editor in your browser, kept in sync as you keep prompting — your own hand-edits included.
- **Integrate** the editor into an application — detect the stack, propose the change, and wait before writing anything.
- **Scaffold** a proposed integration into your repository, installed with your own package manager and checked against your running dev server.
- **Diagnose** an integration that misbehaves, against a table of verified traps.
- **Answer a question** about the SDK by fetching this documentation site directly.

::: tip Prefer a hosted experience?
An in-editor AI chat, tuned prompts, and a hosted MCP server are part of the [Templatical Cloud](/cloud/) tier. This skill is the open, self-hosted path — bring your own agent, keep full control.
:::

## Examples

### Build, validate, and export an email — no integration needed

Describe the email you want. For example:

> Give me a product-launch email for an outdoors brand — a hero image, a short intro, and a "Shop now" button, using forest green and a warm neutral background.

The agent will:

1. Read the block schema and worked examples bundled with the skill.
2. Generate a complete template as `{ blocks, settings }` JSON.
3. Run the validator itself and fix any structural or accessibility issues it reports — repeating until the template passes.
4. Hand you the finished email: export **MJML/HTML to send**, or load the JSON into your own editor integration with `editor.setContent(json)`.

That's a complete email, start to finish, with no integration to build. You can also preview it live before exporting — see the next example.

### Preview and hand-edit it live

Ask to **show it live** (or "preview it live", "build this in live mode") and the skill:

1. Opens a live preview in your browser, showing your current template in the real editor.
2. Updates it **live** each time you prompt a change — no refresh.
3. Lets you **hand-edit in the browser** too; the agent notices when you've diverged and asks whether to build on your version or replace it before overwriting.

Build in plain JSON first and switch to a live preview mid-session — it picks up right where you are. Live mode is local and single-user — not the [Cloud](/cloud/) realtime path — and needs nothing beyond a coding agent running on your own machine.

### Import a template from another builder

Already have a template somewhere else? The skill converts **Unlayer**, **BeeFree**, **Stripo**, **Topol**, **Chamaileon**, **Easy Email Pro**, **MJML**, and **HTML** emails into Templatical JSON — point it at the file and it writes a working template plus a short report of what converted cleanly and what fell back to raw HTML (import is lossy by nature). Then preview it live and refine the rough edges into native blocks.

To run the converters directly in your own code instead, see the migration guides: [Unlayer](/guide/migration-from-unlayer), [BeeFree](/guide/migration-from-beefree), [Stripo](/guide/migration-from-stripo), [Topol](/guide/migration-from-topol), [Chamaileon](/guide/migration-from-chamaileon), [Easy Email Pro](/guide/migration-from-easy-email-pro), [MJML](/guide/migration-from-mjml), [HTML](/guide/migration-from-html).

### Integrate the editor — or diagnose an existing integration

Ask it to scaffold a brand-new integration, add a save/load provider to an existing one, or explain why an editor mounted inside a modal renders its dialogs in the wrong place. For a new integration, it:

1. **Detects your stack** — package manager, framework, bundler, TypeScript, and whether `@templatical/editor` is already installed, and at what version.
2. **Proposes the change and waits** — the packages to add, the files to create or edit, the mount point — before touching anything.
3. **Writes it**, installing with your own package manager.
4. **Verifies by running your dev server** and reading its console and network output — not by asking you to check yourself.
5. **Reports** what changed, what was left alone, and what's still needed — a provider, an optional peer, a Cloud auth endpoint.

Diagnosing an existing integration runs the same steps backwards: it reads your `init()`/`initCloud()` call, bundler config and CSS setup, and checks each against a table of verified traps — duplicate Vue reactivity, a missing `style.css` import, a trapped `position: fixed` ancestor, and more.

## Good to know

### The schema can't drift from the real block model

The skill's JSON Schema is generated directly from `@templatical/types` — the same types the editor and renderer use — so it never disagrees with what the SDK actually accepts. That's also what the validator checks against: whatever the skill hands you is guaranteed to load. See [`packages/template-tools`](https://github.com/templatical/sdk/tree/main/packages/template-tools) in the repository for regeneration and contribution details.

### Validate a template without the agent

The agent already runs this validator itself before handing anything back, so you don't have to. But it's just the published CLI, so you can also run it yourself — in CI, or to spot-check a template:

```bash
npx -y @templatical/template-tools@0.36.0 validate path/to/template.json
```

It checks each block against its type in the [block schema](/guide/blocks) and reports precise errors (for example, `blocks[2] (button) must have required property 'url'`). It then layers accessibility, structure, and link checks on top. Exit code `0` on success, `1` on failure.

### Custom blocks are never generated from a prompt

Custom blocks are consumer-registered runtime extensions — the skill has no way to know what one does, so it never invents one from a prompt. See [Custom Blocks](/guide/custom-blocks) for how to register your own.

### SDK answers are fetched, not packed in

Integration and troubleshooting questions are answered by fetching this documentation site directly, rather than from knowledge bundled with the skill — so an answer is never older than the site itself, and there's nothing to go stale between installs.

### What this skill doesn't do

You don't embed the skill itself — your runtime integration is [`@templatical/editor`](/getting-started/quick-start) (your users build emails, you get JSON out) plus [`@templatical/renderer`](/api/renderer-typescript) (JSON → MJML/HTML to send).

For an in-product **"generate with AI"** feature — your users type a prompt and get a template — your backend calls an LLM with the block schema, validates the result with [`@templatical/quality`](/quality/), and renders it. If you'd rather not build and host that, [Templatical Cloud](/cloud/) offers managed AI generation and collaboration.

It never touches git.
