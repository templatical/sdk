# @templatical/email-skill

An [Agent Skill](https://templatical.com) that teaches any coding agent — Claude
Code, Cursor, Claude Desktop, etc. — to **generate and validate** email templates
for the [Templatical](https://templatical.com) editor, with no backend and no API
key. The agent is the inference; this skill supplies the format knowledge and a
validator.

## What's here

```
templatical-email/
  SKILL.md                 # the skill: workflow + rules the agent follows
  .claude-plugin/
    plugin.json            # Claude Code plugin manifest
  reference/
    schema.json            # JSON Schema for TemplateContent — the validation contract
    block-guide.md         # concise per-block field reference
    examples/*.json        # complete, valid templates to model output on
  scripts/                 # invoked by the skill — ships and runs on the user's machine
    validate.mjs           # validates a template JSON (ajv + optional quality lint)
    import.mjs             # import Unlayer/BeeFree/HTML/MJML → Templatical JSON (via @templatical/import-*)
    live-server.mjs        # live mode: zero-dep Node bridge (serves the editor, syncs edits)
  vendor/                  # committed bundles — why the skill needs no install
    ajv.mjs                # ajv, for structural validation
    quality.mjs            # @templatical/quality, for the a11y/structure/link lint
  tools/                   # maintainer-only — never invoked by the skill
    generate-schema.mjs    # regenerates schema.json from @templatical/types (maintainers)
    bundle-vendor.mjs      # rebuilds vendor/*.mjs (esbuild)
    sync-editor-version.mjs # release: syncs the CDN editor pin, re-bundles vendor, bumps plugin.json
  live/
    index.html             # live mode: CDN editor harness + sync + export buttons
```

The `scripts/` vs `tools/` split is load-bearing: a change under `scripts/`, `reference/`, `live/`, `vendor/` or `SKILL.md` reaches installed users, so
`.github/workflows/plugin-version.yml` requires a `plugin.json` version bump for it. Changes confined to `tools/`, `tests/`, `evals/` or `package.json`
are exempt — `package.json` declares no runtime dependencies (they are vendored), so a devDependency bump cannot change what an installed skill does.

## Two modes

- **Build mode** (default) — generate and validate template JSON. Fully offline,
  cross-agent, needs only `ajv`.
- **Live mode** (optional) — open the template in the **real** Templatical editor
  in a browser, update it live as you prompt, and reconcile in-browser hand-edits.
  Local, single-user, and adds **no** npm dependencies. Runs in a coding agent on
  your own machine. See the "Live mode" section of [`SKILL.md`](./SKILL.md).

You can also **import** an existing Unlayer / BeeFree / HTML / MJML template as a
starting point (via the `@templatical/import-*` converters, install-on-demand) —
see "Importing an existing template" in [`SKILL.md`](./SKILL.md).

## Requirements

- **A coding agent that supports Agent Skills, running on your own machine** —
  and allowed to run commands and write files. Verified: Claude Code, Cursor
  2.4+, OpenAI Codex CLI, the Claude Agent SDK. Build mode also works in hosted
  agents (claude.ai, Claude Desktop); **live mode does not** — it needs a local
  filesystem and a port you can open in your browser. (Codex CLI additionally
  needs its local-network access enabled for live mode — its sandbox blocks the
  agent's own `localhost` calls by default.)
- **Node.js 20 or newer** (22 LTS recommended) — the validator, importer and
  live bridge are plain Node scripts. Check with `node -v`; install from
  <https://nodejs.org> if it's missing.
- **A modern browser** — live mode only. Chrome/Edge 80+, Firefox 101+,
  Safari 16.4+ (the editor mounts in shadow DOM).
- **An internet connection** — live mode only: the editor and the MJML compiler
  load from the CDN. Build mode is fully offline.
- **`npm`** — import mode only, to fetch the converter for your source format
  on demand. Ships with Node.
- **`git`** — only to install as a Claude Code plugin (the marketplace is a git
  repo) or to clone this repo for the folder-copy route.

Not needed: a Templatical account, an API key, a backend, or `npm install` of
anything for build mode — `ajv` and `@templatical/quality` are vendored.

## Install

### Option A — Claude Code plugin (recommended)

```
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

(Add the marketplace from the git repo, not a raw file URL, so the plugin's
relative source resolves.) There is nothing to install afterwards — the skill
auto-activates whenever you ask Claude Code to build a Templatical email.

### Option B — copy the folder (any agent)

The `SKILL.md` format is an open standard, so this works in Claude Code, Claude
Desktop, Cursor, OpenAI Codex, the Agent SDK, and other compatible agents. Copy
the folder into your agent's skills directory:

```
# Claude Code / Claude Desktop
cp -r skills/templatical-email ~/.claude/skills/
# Cursor: use ~/.cursor/skills/  ·  OpenAI Codex: use ~/.agents/skills/
```

Your agent picks the skill up automatically when you ask it to build a
Templatical email.

## Validate a template manually

The agent runs the validator itself as part of the skill (generate → validate →
fix → hand off), so you don't need to. This is only for running it yourself — in
CI or to spot-check a template:

```
node scripts/validate.mjs path/to/template.json
```

Exit code `0` on success, `1` on structural failure. Errors are reported per
block with precise paths, e.g. `blocks[2] (button) must have required property
'url'`.

## Regenerating the schema (maintainers)

`schema.json` is generated from the canonical types in `@templatical/types` — it
is the single source of truth and must never be hand-edited. After any change to
the block model, regenerate it:

```
pnpm --filter @templatical/email-skill run generate-schema
```

The `tests/` suite includes a drift guard that fails if the committed schema no
longer accepts a canonical instance of every block type, so a stale schema is
caught in CI.

## License

MIT.
