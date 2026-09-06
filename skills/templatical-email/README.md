# @templatical/email-skill

An [Agent Skill](https://templatical.com) that teaches any coding agent — Claude
Code, Cursor, Claude Desktop, etc. — to **generate and validate** email templates
for the [Templatical](https://templatical.com) editor, with no backend and no API
key. The agent is the inference; this skill supplies the format knowledge, and
every mechanical operation — validate, render, edit, import, live-preview — runs
through the published
[`@templatical/template-tools`](https://www.npmjs.com/package/@templatical/template-tools)
CLI via `npx`.

## What's here

```
templatical-email/
  SKILL.md                       # the skill: workflow + rules the agent follows
  .claude-plugin/
    plugin.json                  # Claude Code plugin manifest
  reference/
    schema.json                  # JSON Schema for TemplateContent — the validation contract
    block-guide.md               # concise per-block field reference
    examples/*.json              # complete, valid templates to model output on
  tests/
    block-type-coverage.test.ts  # asserts SKILL.md mentions every schema block type
  package.json
  vitest.config.ts
```

That's the whole skill — **no `scripts/`, no `tools/`, no `vendor/`, no
`live/`.** Every command `SKILL.md` documents is
`npx -y @templatical/template-tools@<pinned version> <command> …` against the
published CLI (`packages/template-tools` in this monorepo) — not a script this
folder carries. A change to `SKILL.md` or this `README.md` reaches installed
users, so `.github/workflows/plugin-version.yml` requires a
`.claude-plugin/plugin.json` version bump for it; changes confined to `tests/`,
`evals/`, `vitest.config.ts` or `package.json` are exempt — `package.json`
declares no runtime dependencies, so a devDependency bump there cannot change
what an installed skill does.

## Two modes

- **Build mode** (default) — generate and validate template JSON. Cross-agent;
  the only cost is the CLI's own npm download, cached after the first run.
- **Live mode** (optional) — open the template in the **real** Templatical
  editor in a browser, update it live as you prompt, and reconcile in-browser
  hand-edits — including notes the user leaves as annotations instead of typing
  in chat. Runs a local bridge process; the editor and MJML compiler load from
  the CDN in your browser. Local, single-user — not the Cloud realtime path.

Both modes run through the one CLI, so there is nothing extra to install for
either. See the "Live mode" section of [`SKILL.md`](./SKILL.md).

You can also **import** an existing Unlayer / BeeFree / HTML template as a
starting point (via the `@templatical/import-*` converters, installed on
demand) — see "Importing an existing template" in [`SKILL.md`](./SKILL.md).

## Requirements

- **A coding agent that supports Agent Skills, running on your own machine** —
  and allowed to run commands and write files. Verified: Claude Code, Cursor
  2.4+, OpenAI Codex CLI, the Claude Agent SDK. Build mode also works in hosted
  agents (claude.ai, Claude Desktop); **live mode does not** — it needs a local
  filesystem and a port you can open in your browser. (Codex CLI additionally
  needs its local-network access enabled for live mode — its sandbox blocks the
  agent's own `localhost` calls by default.)
- **Node.js 20 or newer** (22 LTS recommended) **and network access — for every
  command, not just live mode.** `npx` fetches the pinned CLI package from npm
  the first time it runs at that version, then npm caches it — no further
  network round trip until the pin changes at a future release. **Nothing is
  installed into your project**: no `package.json` edit, no lockfile change, no
  `node_modules` entry — `npx` runs the package straight from npm's cache.
  Check Node with `node -v`; install from <https://nodejs.org> if it's missing.
- **A modern browser** — live mode only. Chrome/Edge 80+, Firefox 101+,
  Safari 16.4+ (the editor mounts in shadow DOM).
- **`npm`** — used implicitly by `npx`, and to install the one optional package
  `render --format html` or `import` may ask for. Ships with Node.
- **`git`** — only to install as a Claude Code plugin (the marketplace is a git
  repo) or to clone this repo for the folder-copy route.

Not needed: a Templatical account, an API key, or a backend.

Two commands may each ask for **one** additional install, and the CLI prints
the exact command when they do:

- `render --format html` needs the `mjml` package.
- `import` needs the converter for your source format.

**The exit code says which situation you're in:** `0` succeeded (`validate` may
still report lint warnings), `1` the template itself is invalid, `2` the
command was misused or the tool broke, `3` one of the two optional packages
above is missing — install it and re-run, not a bug.

## Install

### Option A — `npx skills add` (any supported agent)

```
npx skills add templatical/sdk
```

Uses the [`skills` CLI](https://github.com/vercel-labs/skills) (unrelated to
`@templatical/template-tools`), which detects your agent and installs
**both** this skill and `templatical-sdk` into its skills directory — no code
change needed on our side for this to work. It reports anonymous usage telemetry by default (repo and skill
identifiers, for GitHub-confirmed-public repos); disable with
`DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` if you'd rather not.

### Option B — Claude Code plugin

```
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

(Add the marketplace from the git repo, not a raw file URL, so the plugin's
relative source resolves.) There is nothing to install afterwards — the skill
auto-activates whenever you ask Claude Code to build a Templatical email.

### Option C — copy the folder (any agent)

The `SKILL.md` format is an open standard, so this works in Claude Code, Claude
Desktop, Cursor, OpenAI Codex, the Agent SDK, and other compatible agents. Copy
the folder into your agent's skills directory:

```
# Claude Code / Claude Desktop
cp -r skills/templatical-email ~/.claude/skills/
# Cursor: use ~/.cursor/skills/  ·  vendor-neutral / Codex CLI: use ~/.agents/skills/
```

Your agent picks the skill up automatically when you ask it to build a
Templatical email.

## Validate a template manually

The agent runs the CLI's validator itself as part of the skill (generate →
validate → fix → hand off), so you don't need to. This is only for running it
yourself — in CI, or to spot-check a template:

```bash
npx -y @templatical/template-tools validate path/to/template.json
```

Left unpinned deliberately: this always resolves the latest published CLI,
unlike the exact-version pin `SKILL.md` uses for every agent-driven invocation
— that pin exists so the CLI's block model never gets ahead of the
`reference/schema.json` copy the agent reads in context (see "Regenerating the
schema" below). Exit code `0` on success, `1` on structural failure, with
errors reported per block and precise path, e.g. `blocks[2] (button) must have
required property 'url'`. It then layers accessibility, structure and link
checks from `@templatical/quality` on top.

## Regenerating the schema (maintainers)

`reference/schema.json` is generated from the canonical types in
`@templatical/types` — it is the single source of truth and must never be
hand-edited. The generator lives in `packages/template-tools` and writes
**both** that package's own `schema.json` and this skill's copy in one run, so
the two can never diverge from each other. After any change to the block
model:

```bash
pnpm --filter @templatical/template-tools run generate-schema
```

`packages/template-tools`'s test suite includes freshness and parity guards
that fail CI if either committed copy goes stale or the two copies disagree
with each other; this skill's own `tests/block-type-coverage.test.ts` fails if
`SKILL.md` stops mentioning a block type the schema declares.

## License

MIT.
