---
title: AI Agent Skills
description: Two open Agent Skills for Templatical — generate and validate email templates from a prompt, or get integration guidance for embedding @templatical/editor. Free, open-source, no backend or API key.
---

# AI Agent Skills

Templatical ships two [Agent Skills](https://agentskills.io) — **free, open-source, and running entirely in your own AI coding agent:**

- **`templatical-email`** — design a complete email from a natural-language prompt, preview it in the real editor, and export sendable MJML/HTML.
- **`templatical-sdk`** — install, mount, configure, theme and troubleshoot an [`@templatical/editor`](/getting-started/quick-start) integration, and answer "how do I" / "is it possible" questions about the SDK.

Most people want exactly one of the two — that's why they're separate skills, and separate Claude Code plugins (see [Install](#install)). Authoring or editing a template is `templatical-email`; wiring the editor into your own codebase is `templatical-sdk`. "Build a welcome email and wire it into my app" wants both, in that order: `templatical-email` builds and validates the template JSON first, then `templatical-sdk` mounts the editor and loads it in. Each skill's `SKILL.md` names the other, so an agent with both installed hands off between them on its own.

There is no backend and no API key for either: your agent is the inference. Nothing is sent to Templatical.

## Install

Both skills are plain [Agent Skills](https://agentskills.io) folders — Claude Code, Codex CLI, Cursor, Gemini CLI, GitHub Copilot and others all read `SKILL.md`.

### `npx skills add` (recommended)

```bash
npx skills add templatical/sdk
```

One command installs **both** skills — [`skills`](https://github.com/vercel-labs/skills) detects which supported agent(s) you have and installs each straight into the right directory for it. It reports anonymous usage telemetry by default (which repo and skill you installed, for public repositories); set `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` first if you'd rather it didn't.

### Claude Code plugin

Each skill ships as its **own** plugin in the same marketplace, so this route is two installs, not one — get `templatical-email` for authoring, `templatical-sdk` for integration, or both:

```text
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
/plugin install templatical-sdk@templatical
```

They version and update independently, so installing one never pulls down the other's reference material. Add the marketplace from the git repository (not a raw file URL) so each plugin's source resolves.

### Copy the folder manually

Clone the repository once:

```bash
git clone https://github.com/templatical/sdk.git
```

`~/.agents/skills/` is the vendor-neutral location that Codex CLI, Gemini CLI and others read by default — installing there once covers all of them. Copy whichever skill (or both) you need:

```bash
mkdir -p ~/.agents/skills
cp -r sdk/skills/templatical-email ~/.agents/skills/
cp -r sdk/skills/templatical-sdk ~/.agents/skills/
```

For an agent that uses its own directory, or if you would rather keep skills separate:

::: code-group

```bash [Codex CLI]
mkdir -p ~/.agents/skills
cp -r sdk/skills/templatical-email ~/.agents/skills/
cp -r sdk/skills/templatical-sdk ~/.agents/skills/
```

```bash [Cursor]
mkdir -p ~/.cursor/skills
cp -r sdk/skills/templatical-email ~/.cursor/skills/
cp -r sdk/skills/templatical-sdk ~/.cursor/skills/
```

```bash [Gemini CLI]
mkdir -p ~/.gemini/skills
cp -r sdk/skills/templatical-email ~/.gemini/skills/
cp -r sdk/skills/templatical-sdk ~/.gemini/skills/
```

```bash [Claude Code]
# Only if you skipped the plugin route above.
mkdir -p ~/.claude/skills
cp -r sdk/skills/templatical-email ~/.claude/skills/
cp -r sdk/skills/templatical-sdk ~/.claude/skills/
```

```bash [Project-scoped]
# Committed with the repo, so teammates get it on clone.
# Use .agents/skills/ for cross-agent, or .claude/skills/, .cursor/skills/, …
mkdir -p .agents/skills
cp -r /path/to/sdk/skills/templatical-email .agents/skills/
cp -r /path/to/sdk/skills/templatical-sdk .agents/skills/
```

:::

To keep a copy in step across several agents, symlink instead of copying:

```bash
ln -s ~/.agents/skills/templatical-email ~/.claude/skills/templatical-email
ln -s ~/.agents/skills/templatical-sdk ~/.claude/skills/templatical-sdk
```

Copies do not auto-update — re-copy after pulling the repository.

If your agent doesn't pick a skill up, check that its folder landed in a directory the agent actually reads, and that the skill is enabled in its skill list.

## `templatical-email`: design and validate a template

Design a complete email just by describing it. The skill teaches your agent how Templatical templates are structured, so it builds valid emails you can **preview and hand-edit in the real editor, then export as sendable MJML or HTML** — ready to send through any provider (Amazon SES, Postmark, Resend, Mailchimp, …), or to load into your own [`@templatical/editor`](/getting-started/quick-start) integration.

**Two ways to use it:**

- **Design and send** — build an email end to end, preview and tweak it live, export the HTML, and send it through your email provider. No app, no integration, nothing to embed — all you need is a coding agent.
- **A developer aid** — generate branded starter templates, fixtures, and prototypes for your own editor integration. See [Where this fits](#where-this-fits-in-your-product).

::: tip Prefer a hosted experience?
An in-editor AI chat, tuned prompts, and a hosted MCP server are part of the [Templatical Cloud](/cloud/) tier. This skill is the open, self-hosted path — bring your own agent, keep full control.
:::

### What you need

A few things need to be in place on your machine before you start.

| | What | Needed for |
|---|---|---|
| **A coding agent** | One that supports [Agent Skills](https://agentskills.io) and runs on your own machine — Claude Code, Codex CLI, Cursor 2.4+, Gemini CLI, GitHub Copilot and others all read `SKILL.md`. It must be allowed to run commands and write files. | Everything |
| **Node.js 20+** | Version 22 (LTS) recommended. Check with `node -v`; if that prints nothing or a version below 20, install it from [nodejs.org](https://nodejs.org). | Everything |
| **An internet connection** | Every command — including generating and validating JSON — runs through a small CLI fetched on demand via `npx`. The first run downloads the pinned version from npm; after that, npm caches it and there's no further network round trip until a future release moves the pin. Nothing is installed into your project: no `package.json` edit, no lockfile change, no `node_modules` entry. | Everything |
| **A modern browser** | Chrome/Edge 80+, Firefox 101+, Safari 16.4+ — you almost certainly have this. | [Live preview](#preview-it-live) |
| **`npm`** | Fetches the converter for your source format the first time you import. Comes with Node.js. | [Importing](#import-an-existing-template) |
| **`git`** | To clone the repository, or for the plugin install (the marketplace is a git repository). | Install |

**Nothing else** — no Templatical account, no API key, and no backend.

Two different things can stop this working, so it helps to tell them apart: **no internet connection blocks everything**, since even generating and validating JSON now goes through the CLI. **No local filesystem or reachable port** — a hosted, server-side sandbox — blocks only the live preview; generating and validating JSON is unaffected there.

### Using it

Describe the email you want. For example:

> Give me a product-launch email for an outdoors brand — a hero image, a short intro, and a "Shop now" button, using forest green and a warm neutral background.

The agent will:

1. Read the block schema and worked examples bundled with the skill.
2. Generate a complete template as `{ blocks, settings }` JSON.
3. Run the validator itself and fix any structural or accessibility issues it reports — repeating until the template passes.
4. Hand you the finished email — preview and refine it live (below), then **export MJML/HTML to send**, or load the JSON into your own editor integration with `editor.setContent(json)`.

### Preview it live

You don't have to stop at JSON — you can watch the template render in the **real** editor and keep refining it by prompting. Ask to **show it live** (or "preview it live", "build this in live mode") and the skill:

1. Opens a live preview in your browser, showing your current template in the real editor.
2. Updates it **live** each time you prompt a change — no refresh.
3. Lets you **hand-edit in the browser** too; the agent notices when you've diverged and asks whether to build on your version or replace it before overwriting.

Build in plain JSON first and switch to a live preview mid-session — it picks up right where you are. Each template is saved under its own name, and a new session starts a fresh one (ask to "continue" a previous template to reopen it). Live mode is local and single-user — not the [Cloud](/cloud/) realtime path — and needs nothing beyond a coding agent running on your own machine.

When it looks right, hit **Export** for the MJML or HTML and send it through your provider — that's a complete email, start to finish, with no integration to build.

### Import an existing template

Already have a template in another editor? The skill can convert **Unlayer**, **BeeFree**, **Stripo**, **Topol**, **Chamaileon**, **Easy Email Pro**, **MJML**, and **HTML** emails into Templatical JSON — point it at the file and it writes a working template plus a short report of what converted cleanly and what fell back to raw HTML (import is lossy by nature). Then preview it live and refine the rough edges into native blocks. To run the converters directly in your own code instead, see the migration guides: [Unlayer](/guide/migration-from-unlayer), [BeeFree](/guide/migration-from-beefree), [Stripo](/guide/migration-from-stripo), [Topol](/guide/migration-from-topol), [Chamaileon](/guide/migration-from-chamaileon), [Easy Email Pro](/guide/migration-from-easy-email-pro), [MJML](/guide/migration-from-mjml), [HTML](/guide/migration-from-html).

### Bring your own brand and rules

The skill defines the _format_; you supply the _taste_. Layer your own context on top — brand colors and fonts, tone of voice, a house system prompt, a mandatory footer or unsubscribe block. When you give the agent your brand settings, it uses them instead of generic defaults.

Custom blocks are the one exception: they are consumer-registered runtime extensions, so the skill will not generate them from a prompt. See [Custom Blocks](/guide/custom-blocks).

### Validating template JSON directly

The agent already runs this validator itself (step 3 above), so you don't have to. But it's just the published CLI, so you can also run it yourself whenever you want — in CI, or to spot-check a template:

```bash
npx -y @templatical/template-tools@0.36.0 validate path/to/template.json
```

It checks each block against its type in the [block schema](/guide/blocks) and reports precise errors (for example, `blocks[2] (button) must have required property 'url'`). It then layers accessibility, structure, and link checks on top. Exit code `0` on success, `1` on failure.

### How it stays correct

The skill's JSON Schema is generated directly from `@templatical/types` — the same types the editor and renderer use — so it never drifts from the real block model. See the [skill's README](https://github.com/templatical/sdk/tree/main/skills/templatical-email) for regeneration and contribution details.

### Where this fits in your product

The skill covers two very different needs.

**Design and ship an email — no integration.** If you just need an email out the door — a campaign, a transactional message, a one-off — build it here, preview and tweak it live, then export the **MJML/HTML** and send it through your ESP (Amazon SES, Postmark, Resend, Mailchimp, …). You never touch `@templatical/editor` or write a line of integration code — it's a complete authoring tool for anyone with a coding agent.

**A build-time aid for an editor integration.** If you're embedding the editor in your own app, the skill is the fastest way to generate branded starter templates, fixtures, and prototypes. Your _runtime_ integration is still [`@templatical/editor`](/getting-started/quick-start) (your users build emails, you get JSON out) + [`@templatical/renderer`](/api/renderer-typescript) (JSON → MJML/HTML to send) — you don't embed the skill itself. Wiring that integration is `templatical-sdk`'s job, next.

For an in-product **"generate with AI"** feature (your users type a prompt and get a template), your backend calls an LLM with the block schema, validates the result with [`@templatical/quality`](/quality/), and renders it. If you'd rather not build and host that, [Templatical Cloud](/cloud/) offers managed AI generation and collaboration.

## `templatical-sdk`: integrate the editor

The other skill is aimed at the opposite job: **install, mount, configure, theme and troubleshoot an [`@templatical/editor`](/getting-started/quick-start) integration**, and answer "how do I" / "is it possible" questions about the SDK — providers, theming, Shadow DOM, version skew, and the integration traps that don't show up until a consumer actually hits them (duplicate Vue reactivity, a missing `style.css` import, a trapped `position: fixed` ancestor, `toHtml()` needing a `render` provider, and more).

Ask it to scaffold a brand-new integration, add a save/load provider to an existing one, or explain why an editor mounted inside a modal renders its dialogs in the wrong place. For a new integration, it:

1. **Detects your stack** — package manager, framework, bundler, TypeScript, and whether `@templatical/editor` is already installed, and at what version.
2. **Proposes the change and waits** — the packages to add, the files to create or edit, the mount point — before touching anything.
3. **Writes it**, installing with your own package manager.
4. **Verifies by running your dev server** and reading its console and network output — not by asking you to check yourself.
5. **Reports** what changed, what was left alone, and what's still needed — a provider, an optional peer, a Cloud auth endpoint.

Diagnosing an existing integration runs the same steps backwards: it reads your `init()`/`initCloud()` call, bundler config and CSS setup, and checks each against the known failure modes.

Its knowledge is a generated copy of this documentation site, bundled directly in the skill and regenerated every release, so most questions need no network access at all. The exceptions: an exact schema lookup runs the same published CLI `templatical-email` uses (`npx -y @templatical/template-tools@0.36.0 schema`), and a version-skew check — when your installed `@templatical/editor` is older than the reference describes — reads pinned source straight from GitHub at your version's tag. Full detail, including the failure-mode table and the six provider contracts (`templates`, `versionHistory`, `comments`, `savedBlocks`, `testEmail`, `render`), lives in [the skill itself](https://github.com/templatical/sdk/tree/main/skills/templatical-sdk) — ask it directly, or read `SKILL.md` in the repository.

It doesn't run the live preview above — that's `templatical-email`'s — and it never touches git.
