---
title: Template Tools
description: API reference for @templatical/template-tools — the CLI and library for validating, rendering, editing, importing and previewing Templatical templates outside the editor.
---

# Template Tools

`@templatical/template-tools` is the CLI and library behind every mechanical operation on a Templatical template: validate its JSON, render it to MJML or HTML, apply a scoped edit, import it from another editor's export format, or preview it live in the real Templatical editor. MIT-licensed, published on npm, and runs via `npx` with nothing installed into your project and no Templatical account.

The bundled [Agent Skill](/guide/agent-skill) drives this CLI internally — every command an AI coding agent runs while building or editing a template with the skill is one of the seven documented below. The CLI itself needs no agent: everything here works the same from a shell, a script, or a CI job.

## Invoking it

Every command follows the same shape:

```bash
npx -y @templatical/template-tools <command> [options]
```

Add `--json` to any command for a single parseable JSON document on stdout. Installed as a project dependency instead, the binary is named `templatical`.

**Pin an exact version in CI.** The CLI and the block model it validates against (`@templatical/types`) are released together, so an unpinned call always matches itself — but it can grow stricter between two runs with no change of yours to explain it. Pinning makes a version bump a reviewable diff instead.

## Commands

| Command | Does |
|---|---|
| `validate <file>` | Structural check, then the quality lint |
| `schema [--out <file>]` | Print the block JSON Schema |
| `render <file> [--format mjml\|html] [-o <file>]` | Render to MJML, or to sending-ready HTML |
| `edit <file> --op '<json>'` \| `--ops <file>` | Apply one operation, or a batch, and write the result |
| `import <file> [--format <fmt>]` \| `--list-formats` | Convert a design from another tool into Templatical JSON |
| `live` \| `live reload` \| `live stop` | Preview and hand-edit the template in the real editor |
| `list` | List the working templates in `.templatical/` |

`--json` (see below) is a global flag — it works identically on every command above, not just some of them. Every command that touches a file also accepts `--cwd <dir>`, resolving relative paths against it instead of the process's own working directory.

### `validate <file>`

```bash
npx -y @templatical/template-tools validate emails/welcome.json
```

Structural validation against the generated JSON Schema — discriminator-aware, so a bad button reports `blocks[2] (button) must have required property 'url'` rather than a raw `anyOf` failure. Once the structure passes, `@templatical/quality`'s full lint (accessibility, structure, links — 31 rules) runs on top. No command-specific flags.

### `schema [--out <file> | -o <file>]`

```bash
npx -y @templatical/template-tools schema --out block-schema.json
```

Prints the same JSON Schema `validate` checks against — the block model as a plain JSON Schema document, useful for grounding an LLM prompt or generating types in another language. Without `--out`/`-o` it prints to stdout; with it, writes to that file instead (creating parent directories as needed) and prints nothing to stdout.

### `render <file> [--format mjml|html] [--out <file> | -o <file>]`

```bash
npx -y @templatical/template-tools render emails/welcome.json --format html -o welcome.html
```

Defaults to `--format mjml`. `--format html` compiles that MJML further and needs the optional `mjml` package — see "Optional dependencies" below. The template is validated structurally before rendering starts, so an invalid template fails with the same error list `validate` would give you, not a renderer crash. Without `--out`/`-o`, the result prints to stdout.

### `edit <file> --op '<json>'` or `--ops <file>`

```bash
npx -y @templatical/template-tools edit emails/welcome.json \
  --op '{"operation":"updateBlock","data":{"blockId":"button_1","updates":{"backgroundColor":"#1d4ed8"}}}'
```

One operation via `--op '<json>'`, or a batch via `--ops <file>` pointing at a JSON array of the same shape — never both. Each operation is `{ "operation": "<name>", "data": {...} }`, where `operation` is one of the seven the editor itself uses: `addBlock`, `updateBlock`, `deleteBlock`, `moveBlock`, `updateSettings`, `setContent`, `updateBlockStyle`.

A batch is all-or-nothing: the first operation that would be rejected stops the whole batch, nothing is written, and the error names which operation (by index) and why. Even once every operation in a batch succeeds, the result is re-validated structurally before anything is written — a sequence that produces an invalid document is refused and the file is left untouched. On success, `edit` overwrites `<file>` in place; there's no `--out`.

### `import <file> [--format <fmt>] [--out <name>]` or `import --list-formats`

```bash
npx -y @templatical/template-tools import design.json --format unlayer
```

Converts a design from another tool's export format into a new Templatical template, written to `.templatical/<name>.json` (`<name>` defaults to `<file>`'s own base name; override it with `--out <name>`). Without `--format`, `import` sniffs the format from the file's extension and content — reliable for most exports, but pass `--format` explicitly if detection guesses wrong. The result includes a conversion report: how many blocks converted cleanly, how many were approximated, how many fell back to a raw HTML block, and how many were skipped.

Run `import --list-formats` (optionally with `--json`) to see which converter packages are actually resolvable from your current working directory right now — see "Optional dependencies" below.

### `live` · `live reload` · `live stop`

Starts a local server that opens the real Templatical editor (loaded from the CDN) in your browser and keeps one working template file in `.templatical/` synced to it over Server-Sent Events. `live reload` pushes your latest edit to the open page; `live stop` shuts the server down. `[--file <f>]` picks the working file, `[--port <n>]` picks the port (default `4747`, falling back to a random free one if it's busy), `[--cwd <d>]` resolves both against a directory other than the current one, and `--no-open` skips launching a browser automatically. This is the protocol the [Agent Skill](/guide/agent-skill)'s live mode is built on — see that page for how an agent drives it turn by turn; the CLI command here only starts and stops the server.

### `list`

```bash
npx -y @templatical/template-tools list
```

Lists every working template under `.templatical/` (or `--cwd`'s `.templatical/`), with a title hint pulled from the first title block found in each. Useful for recovering the name of the file you were just working on.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. `validate` may still report `warning`/`info` lint findings — see below. |
| `1` | The template is invalid: a structural error, or a quality-lint finding of severity `error`. |
| `2` | Usage error — bad flags, a missing argument, an unreadable or unparseable input file. |
| `3` | An optional dependency isn't installed. The error message names the exact install command. |

::: tip Exit code 3 is not a failure
It means the CLI did its job and hit a genuinely optional piece it can't do without — the `mjml` package for `render --format html`, or a converter package for `import`. Handle it differently from `1`/`2` in any script or CI step you write: `3` means "install one thing and re-run," not "something is wrong with this template."
:::

## Reading `--json`

Every command's `--json` output is exactly one parseable document on stdout — nothing else is ever written there in that mode. Diagnostics, progress notes and human-readable errors all go to stderr instead, in both modes, so `<command> --json | jq .` is always safe to pipe.

`validate --json` emits `{ valid, errors, issues }`. `errors` is the structural error list, populated only when `valid` is `false`. `issues` is `@templatical/quality`'s complete report against the template — every accessibility, structure and link finding, at whatever severity that rule defaults to (`error`, `warning`, or `info`) — regardless of whether that finding affected the exit code.

**The thing this gets people:** `issues.length > 0` is not "the template failed." Most rules default to `warning` or `info` and are advisory only. A handful — missing image `alt` text, a `javascript:` URL, a duplicate block ID, low-contrast text, and a few more — default to `error`, and those *do* fail the command: `validate` already computed this for you, which is exactly what the exit code is for (`1` for a structural failure or any `severity: "error"` issue, `0` otherwise). A CI script that fails the build merely because the `issues` array is non-empty will reject templates the command itself considers passing. Trust the exit code — or the top-level `valid` field, if you want it in-process — over hand-rolling an "any issue fails" check against `issues`.

## Using it in CI

A minimal pull-request check — no install step for the CLI itself, because there isn't one:

```yaml
name: Validate email templates

on:
  pull_request:
    paths:
      - "emails/**/*.json"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Validate templates
        run: |
          for file in emails/*.json; do
            npx -y @templatical/template-tools validate "$file"
          done
```

Adjust the glob to wherever your templates actually live. GitHub Actions runs a `run:` step's script with `bash -e` by default, so the loop stops and the step fails at the first template that doesn't validate — nothing here tracks an exit status by hand. Pin the `npx` call to an exact version here, as described under "Invoking it" above, so a template-tools release can't change what "passing" means for this workflow between two runs with no diff to review.

## Optional dependencies

Running the CLI never installs anything into your project on its own — `npx` resolves the package itself (from npm's cache, or by fetching it once, the first time), and that's the only network or filesystem activity a bare command performs. Two commands can each ask for exactly one more package, and the error names the install command when it's missing:

- **`render --format html`** needs `mjml`. The renderer produces MJML only — by design, this SDK bundles no MJML-to-HTML compiler of its own — so turning that into sendable HTML needs an MJML implementation, and `mjml` is the one this command knows how to load.
- **`import`** needs the converter package for whatever format you're importing.

For `import`, don't guess which converters are installed — ask the CLI:

```bash
npx -y @templatical/template-tools import --list-formats --json
```

This reports exactly what's resolvable from your current working directory right now. The converter list grows over time, so this is the only answer that can't go stale the way a hardcoded list on a doc page would.

Install either kind of optional dependency in whatever project the CLI is invoked from — both are resolved starting from your current working directory (or `--cwd`, if you passed it).

## Library use

Three entry points, for three different jobs.

### `@templatical/template-tools` (root)

```ts
import {
  schema,
  validateTemplate,
  runQualityLint,
  applyOperation,
  getColumnCount,
  type ValidationResult,
  type QualityLintResult,
  type OperationResult,
} from "@templatical/template-tools";
```

- **`schema`** — the generated JSON Schema for `TemplateContent`, as a plain object. Same content the `schema` command prints and the published `schema.json` file (below) contains.
- **`validateTemplate(data: unknown): ValidationResult`** — the same discriminator-aware structural check `validate` runs. Synchronous; needs only `ajv` and the committed schema, no build step and no other workspace package.
- **`runQualityLint(data: unknown): QualityLintResult`** — `@templatical/quality`'s `lintTemplate` layered on top, assuming structurally-valid input. Wrapped in a try/catch, so a malformed template can't crash the caller: `{ issues, error? }`, where `error` is only set if the linter itself threw.
- **`applyOperation(content: TemplateContent, payload: TemplateOperationPayload): OperationResult`** — the pure reducer behind `edit --op`. Never mutates `content`; returns `{ ok, content, error? }`, where `content` on a rejection is the same object passed in, provably untouched.
- **`getColumnCount(layout: ColumnLayout): number`** — columns a section layout declares: `'1'` → `1`, `'3'` → `3`, everything else (`'2'`, `'2-1'`, `'1-2'`) → `2`. Mirrors the identical helper in `@templatical/core`'s own editor, reimplemented here because this package never imports core — see "How it relates to the other packages" below.

### `@templatical/template-tools/live`

```ts
import { startBridge } from "@templatical/template-tools/live";
```

Node-only (`node:http`, `node:fs`) — a separate subpath so a bundler building for the browser never has to resolve those built-ins just because it imported the root entry. `startBridge(options?)` starts the same local bridge server the `live` command wraps: it serves the CDN editor harness and keeps one working template file synced to it. The returned handle exposes `reload()` and `getEditorState()` directly, so a caller already running in the same Node process can drive the bridge and read back its divergence state without an HTTP round trip to its own server. Most consumers won't need this directly — it's what `live` is built from.

### `@templatical/template-tools/schema.json`

The raw generated JSON Schema as a `.json` file — importable anywhere your bundler or runtime can load JSON (`import schema from "@templatical/template-tools/schema.json"`, or read it with `fetch`/`fs.readFileSync` outside a bundler). Identical content to the `schema` export above and to what the `schema` command prints.

**Building a "generate with AI" feature into your own product?** This is what you need. The bundled [Agent Skill](/guide/agent-skill) runs exactly this loop for a coding agent: read the block schema as grounding, generate a template, validate what comes back, and feed any errors to the model until it passes. `schema.json` and `validateTemplate` are the two pieces of that loop this package gives you directly — hand the schema to your model (a system prompt, a tool definition, structured-output mode, whatever your provider supports), then run its output through `validateTemplate` before you trust it. Nothing else in this package is relevant to that path: `runQualityLint`, `applyOperation` and `./live` all assume you already have a structurally valid template to work with.

## How it relates to the other packages

Builds on three MIT packages, all real `dependencies` rather than peers, so none of them are optional: `@templatical/types` for the block model the schema is generated from, `@templatical/quality` for the lint `validate` layers on top, and `@templatical/renderer` for the MJML output `render` produces. It is not the editor — there's no visual surface in this package, and nothing in it mounts UI or touches a DOM.

It never imports `@templatical/core`, the one SDK package still under [FSL-1.1-MIT](/license-faq) rather than plain MIT. `edit`'s operation reducer (`applyOperation`) reimplements the same invariants core's own editor mutators enforce — most importantly, that a section can never land inside a column, because MJML forbids nesting `mj-section` inside `mj-column` — instead of importing them. That is a real maintenance cost: the two implementations can drift apart, which is exactly why this package's own test suite checks both descriptions of each invariant against one another. What it buys back is what keeps this package's own license plain MIT — safe to run via a bare, unauthenticated `npx`, with no license terms to reason about beyond MIT's.
