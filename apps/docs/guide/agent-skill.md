---
title: AI Agent Skill
description: Generate and validate Templatical email templates from a natural-language prompt using your own AI coding agent — free, open-source, no backend or API key.
---

# AI Agent Skill

Generate email templates from a natural-language prompt — **free, open-source, and running entirely in your own AI agent.** The `templatical-email` [Agent Skill](https://code.claude.com/docs/en/skills) teaches Claude Code, Cursor, Claude Desktop, or any Agent Skills–compatible agent how Templatical templates are structured, so it produces valid template JSON and validates it against the block schema. You then load the result into the editor and refine it like any other template.

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

The `SKILL.md` format is an open standard, so the skill works across compatible agents. Copy it from a clone of the repository into your agent's skills directory:

```bash
# Claude Code / Claude Desktop
cp -r skills/templatical-email ~/.claude/skills/
# Cursor
cp -r skills/templatical-email ~/.cursor/skills/
# OpenAI Codex (and other agents that read the vendor-neutral Agent Skills dir)
cp -r skills/templatical-email ~/.agents/skills/
```

Then install the validator's one dependency inside the copied folder:

```bash
npm install ajv
# optional — adds accessibility / structure / link linting:
npm install @templatical/quality
```

## Using it

Describe the email you want. For example:

> Give me a product-launch email for an outdoors brand — a hero image, a short intro, and a "Shop now" button, using forest green and a warm neutral background.

The agent will:

1. Read the block schema and worked examples bundled with the skill.
2. Generate a complete template as `{ blocks, settings }` JSON.
3. Run the bundled validator itself and fix any structural or accessibility issues it reports — repeating until the template passes.
4. Hand you the JSON — load it with `editor.setContent(json)` (or your framework's equivalent) and refine it visually.

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
