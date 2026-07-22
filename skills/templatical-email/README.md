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
  scripts/
    validate.mjs           # validates a template JSON (ajv + optional quality lint)
    generate-schema.mjs    # regenerates schema.json from @templatical/types (maintainers)
    sync-editor-version.mjs # syncs live mode's CDN editor pin to @templatical/editor (release)
    live-server.mjs        # live mode: zero-dep Node bridge (serves the editor, syncs edits)
  live/
    index.html             # live mode: CDN editor harness + sync + export buttons
```

## Two modes

- **Build mode** (default) — generate and validate template JSON. Fully offline,
  cross-agent, needs only `ajv`.
- **Live mode** (optional) — open the template in the **real** Templatical editor
  in a browser, update it live as you prompt, and reconcile in-browser hand-edits.
  Local, adds **no** npm dependencies (the bridge is Node built-ins; the editor
  and `mjml-browser` load from the CDN), and runs on any local-shell agent with
  Agent Skills + a persistent process + localhost — Claude Code, Cursor, the
  Agent SDK, and Codex CLI (with a local-network opt-in); not the
  claude.ai/Desktop server sandbox. See the "Live mode" section of
  [`SKILL.md`](./SKILL.md).

## Install

### Option A — Claude Code plugin (recommended)

```
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

(Add the marketplace from the git repo, not a raw file URL, so the plugin's
relative source resolves.) The skill installs its one dependency (`ajv`) on first
use, then auto-activates whenever you ask Claude Code to build a Templatical
email.

### Option B — copy the folder (any agent)

The `SKILL.md` format is an open standard, so this works in Claude Code, Claude
Desktop, Cursor, OpenAI Codex, the Agent SDK, and other compatible agents. Copy
the folder into your agent's skills directory and install the validator
dependency:

```
# Claude Code / Claude Desktop
cp -r skills/templatical-email ~/.claude/skills/
# Cursor: use ~/.cursor/skills/  ·  OpenAI Codex: use ~/.agents/skills/

cd ~/.claude/skills/templatical-email
npm install ajv
# optional — adds accessibility / structure / link linting (if available):
npm install @templatical/quality
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
