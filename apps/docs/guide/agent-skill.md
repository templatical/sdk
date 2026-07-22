---
title: AI Agent Skill
description: Generate and validate Templatical email templates from a natural-language prompt using your own AI coding agent — free, open-source, no backend or API key.
---

# AI Agent Skill

Generate email templates from a natural-language prompt — **free, open-source, and running entirely in your own AI agent.** The `templatical-email` [Agent Skill](https://code.claude.com/docs/en/skills) teaches your coding agent how Templatical templates are structured, so it produces valid template JSON and validates it against the block schema. You then load the result into the editor and refine it like any other template.

There is no backend and no API key: your agent is the inference. Nothing is sent to Templatical.

::: tip Prefer a hosted experience?
An in-editor AI chat, tuned prompts, and a hosted MCP server are part of the [Templatical Cloud](/cloud/) tier. This skill is the open, self-hosted path — bring your own agent, keep full control.
:::

## Install

### Claude Code (plugin)

```text
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

Add the marketplace from the git repository (not a raw file URL) so the plugin's source resolves. The skill activates automatically when you ask Claude Code to build a Templatical email.

### Any agent (copy the folder)

`SKILL.md` is an open standard, so the skill works in any compatible agent. Copy `skills/templatical-email` from a clone of the repository into your agent's skills directory:

```bash
# Claude Code
cp -r skills/templatical-email ~/.claude/skills/
# Cursor
cp -r skills/templatical-email ~/.cursor/skills/
# OpenAI Codex (and other agents using the vendor-neutral dir)
cp -r skills/templatical-email ~/.agents/skills/
```

Then install the validator's one dependency inside the copied folder:

```bash
npm install ajv                    # required
npm install @templatical/quality   # optional but highly recommended — adds accessibility / structure / link linting
```

## Using it

Describe the email you want. For example:

> Give me a product-launch email for an outdoors brand — a hero image, a short intro, and a "Shop now" button, using forest green and a warm neutral background.

The agent will:

1. Read the block schema and worked examples bundled with the skill.
2. Generate a complete template as `{ blocks, settings }` JSON.
3. Run the bundled validator itself and fix any structural or accessibility issues it reports — repeating until the template passes.
4. Hand you the JSON — load it with `editor.setContent(json)` (or your framework's equivalent) and refine it visually.

## Preview it live

You don't have to stop at JSON — you can watch the template render in the **real** editor and keep refining it by prompting. Ask to **show it live** (or "preview it live", "build this in live mode") and the skill:

1. Opens a live preview in your browser, showing your current template in the real editor.
2. Updates it **live** each time you prompt a change — no refresh.
3. Lets you **hand-edit in the browser** too; the agent notices when you've diverged and asks whether to build on your version or replace it before overwriting.
4. Exports straight from the page: **Copy JSON**, **Get MJML**, or **Get HTML**.

Build in plain JSON first and switch to a live preview mid-session — it picks up right where you are. Each template is saved under its own name, and a new session starts a fresh one (ask to "continue" a previous template to reopen it). Live mode is local and single-user — not the [Cloud](/cloud/) realtime path — and needs nothing beyond a coding agent running on your own machine.

## Bring your own brand and rules

The skill defines the _format_; you supply the _taste_. Layer your own context on top — brand colors and fonts, tone of voice, a house system prompt, a mandatory footer or unsubscribe block. When you give the agent your brand settings, it uses them instead of generic defaults.

Custom blocks are the one exception: they are consumer-registered runtime extensions, so the skill will not generate them from a prompt. See [Custom Blocks](/guide/custom-blocks).

## Validating template JSON directly

The agent already runs this validator itself (step 3 above), so you don't have to. But it's a plain Node script, so you can also run it yourself whenever you want — in CI, or to spot-check a template:

```bash
node scripts/validate.mjs path/to/template.json
```

It checks each block against its type in the [block schema](/guide/blocks) and reports precise errors (for example, `blocks[2] (button) must have required property 'url'`). When `@templatical/quality` is installed, it layers accessibility, structure, and link checks on top. Exit code `0` on success, `1` on failure.

## How it stays correct

The skill's JSON Schema is generated directly from `@templatical/types` — the same types the editor and renderer use — so it never drifts from the real block model. See the [skill's README](https://github.com/templatical/sdk/tree/main/skills/templatical-email) for regeneration and contribution details.

## Where this fits in your product

This skill is a **build-time** aid, not a runtime integration. Your actual integration is two packages: [`@templatical/editor`](/getting-started/quick-start) to embed the editor (your users build emails; you get JSON out) and [`@templatical/renderer`](/api/renderer-typescript) to turn that JSON into MJML/HTML to send. You don't embed the skill itself in your product.

Use the skill while _building_ — to generate branded starter templates, fixtures, and prototypes in your own coding agent.

For an in-product **"generate with AI"** feature (your users type a prompt and get a template), your backend calls an LLM with the block schema, validates the result with [`@templatical/quality`](/quality/), and renders it. If you'd rather not build and host that, [Templatical Cloud](/cloud/) offers managed AI generation and collaboration.

A first-party local MCP server (`@templatical/mcp`) is planned for **agent-based** integrations — it runs locally over stdio (no account or key needed) and exposes validate / render / lint as callable tools. Until it ships, use the packages above directly.
