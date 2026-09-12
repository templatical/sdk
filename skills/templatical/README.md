# @templatical/skill

An [Agent Skill](https://templatical.com) that teaches any coding agent
reading `SKILL.md` to work with [Templatical](https://templatical.com): author
and validate email template JSON from a prompt, preview and hand-edit it live
in the real editor, and install, mount, configure, theme, extend or
troubleshoot the
[`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) SDK
in an application — including "how do I" and "is it possible" questions about
it. The agent is the inference for both jobs: no backend, no API key, nothing
sent to Templatical. Every mechanical operation — validating, rendering,
editing, importing, live-previewing, an exact schema lookup — runs through the
published
[`@templatical/template-tools`](https://www.npmjs.com/package/@templatical/template-tools)
CLI via `npx`.

One request often needs both jobs, in order: "build a welcome email and wire
it into my app" authors and validates the template first, then mounts the
editor and loads it in. The skill decides which job a request is itself — see
What it does below.

## What it does

Ask for what you want in plain language. The skill reads the request as
either about a template — its content, design, correctness or output — or
about the SDK — installing, mounting, configuring or debugging the editor in
code — and routes to the matching mode, defaulting to `build` on the template
side and `docs` on the SDK side when nothing more specific matches:

| Mode | For | Playbook |
|---|---|---|
| `build` | Write a template from a brief | [reference/build.md](reference/build.md) |
| `edit` | Change a template that already exists | [reference/edit.md](reference/edit.md) |
| `import` | Convert a template from another editor | [reference/import.md](reference/import.md) |
| `validate` | Check a template and read the result | [reference/validate.md](reference/validate.md) |
| `export` | Render MJML or HTML | [reference/export.md](reference/export.md) |
| `live` | Preview and co-edit in the browser | [reference/live.md](reference/live.md) |
| `integrate` | Mount the editor in an application | [reference/integrate.md](reference/integrate.md) |
| `scaffold` | Write the integration into your repository | [reference/scaffold.md](reference/scaffold.md) |
| `diagnose` | Fix an integration that misbehaves | [reference/diagnose.md](reference/diagnose.md) |
| `docs` | Answer a question from the SDK reference | [reference/docs.md](reference/docs.md) |

`import` is also where an existing template lands — a design or HTML export
from Unlayer, BeeFree, Stripo, Topol, Chamaileon, Easy Email Pro or MJML
converts to a first pass rather than starting from scratch, with a report of
what converted cleanly and what needs a hand-refine.

## What's here

```
templatical/
  SKILL.md                     # the router: the template-vs-SDK
                                # discrimination, the Commands table above,
                                # and the routing rule
  reference/
    cli.md                     # phase island, read once per session before
                                # the first command — see below
    build.md, edit.md, import.md, validate.md, export.md, live.md
                                # entry islands for authoring a template
    integrate.md, scaffold.md, diagnose.md, docs.md
                                # entry islands for the SDK integration
    annotations.md, blocks.md, brand.md, failure-modes.md, live-setup.md,
    providers.md, resume.md, rules.md, talking.md, version-awareness.md,
    working-files.md           # consult islands — reached only by a link
                                # from inside another playbook, never routed
                                # to directly
    schema.json                # generated JSON Schema — the block model's
                                # validation contract
    block-guide.md              # per-block field reference
    examples/*.json               # five complete, valid templates
  tests/                        # guard tests — see Tests, below
  evals/
    evals.json, README.md        # prompt / expected-output pairs across
                                  # both jobs
  package.json
  vitest.config.ts
```

`SKILL.md` itself stays small: frontmatter, the discrimination, the Commands
table, and the routing rule. Nothing else loads unconditionally. Everything
under `reference/` is an island in one of three roles:

- **Entry** — the ten playbooks in the Commands table above. The router
  picks exactly one per request.
- **Consult** — the eleven remaining `.md` files. Reached only by a link
  from inside another playbook; never routed to directly, so they can go as
  deep as a topic needs without weighing on every request.
- **Phase** — `cli.md` alone. Read once per session, before the first
  command, regardless of which mode the request resolves to — every other
  playbook assumes its invocation prefix and exit-code contract rather than
  repeating them.

Every island names its own neighbours — what runs before and after it, what
it consults — so the graph is walkable from any file, not only from
`SKILL.md`. A `validate`-only request loads the router, `cli.md`, and
`validate.md`; it never touches the live-mode protocol, the SDK failure-mode
table, or the provider contracts.

## Install

```
npx skills add templatical/sdk
```

This is the only documented way to install the skill. To update:

```
npx skills update
```

## Requirements

- **A coding agent that reads `SKILL.md`, running on your own machine** —
  and allowed to run commands and write files.
- **Node.js 20 or newer** (22 LTS recommended) **and network access — for
  every command, not just live mode.** Generating and validating JSON runs
  through the CLI below too. `npx` fetches the pinned version from npm the
  first time it runs, then npm caches it — no further network round trip
  until a future release moves the pin. Nothing is installed into your
  project: no `package.json` edit, no lockfile change, no `node_modules`
  entry.
- **A modern browser and a reachable local port** — live mode only.
  Chrome/Edge 80+, Firefox 101+, Safari 16.4+ (the editor mounts in shadow
  DOM). A hosted, server-side sandbox with no local filesystem or open port
  can't run live mode; every other mode is unaffected there.
- **`npm`** — used implicitly by `npx`, and to install whichever of the two
  optional packages below a command asks for. Ships with Node.

Two commands may each ask for **one** additional install, and the CLI prints
the exact command when they do:

- `render --format html` needs the `mjml` package.
- `import` needs the converter for the source format.

Not needed: a Templatical account, an API key, or a backend.

Every command runs through one pinned CLI, and the invocation always starts
the same way:

```
npx -y @templatical/template-tools@0.36.0 validate <file> --json
```

`npx`, then `-y`, then the package name at an exact version, is the fixed
prefix for every command this skill documents — only the subcommand and its
own flags change after it. `-y` is required: without it, `npx`'s first-fetch
confirmation prompt stalls the agent with no visible cause. The version
stays pinned rather than `@latest` so `reference/schema.json` can never
disagree with the CLI's own block model, since a release moves both
together.

**The exit code says which situation you're in:**

| Exit | Meaning |
|---|---|
| `0` | Succeeded. `validate` may still report lint warnings. |
| `1` | The template itself is invalid. |
| `2` | The command was misused, or the tool broke. |
| `3` | One of the two optional packages above is missing — install it and re-run, not a bug. |

## The schema stays generated

`reference/schema.json` is generated from `@templatical/types` — the same
types the editor and renderer use — and is never hand-edited. Regenerate it
after any change to the block model:

```bash
pnpm --filter @templatical/template-tools run generate-schema
```

The generator writes both `packages/template-tools`'s own `schema.json` and
this skill's copy in one run, so the two can't disagree about what a valid
template is. Three guards in `packages/template-tools/tests/` hold that: one
regenerates the schema in memory and diffs it against each committed copy,
one asserts the two committed copies are byte-identical, and one builds a
canonical instance of every block type via the `@templatical/types`
factories and validates it against the committed schema.

## The SDK reference is fetched, not packed

`reference/schema.json`, `reference/block-guide.md` and
`reference/examples/` travel with the skill because they are the
**contract**: `schema.json` has to be exactly what the pinned CLI validates
against, or the agent could generate a template its own validator then
rejects.

The SDK's integration documentation is **prose**, and it takes the opposite
route: [reference/docs.md](reference/docs.md) fetches it live from
[docs.templatical.com](https://docs.templatical.com) rather than carrying a
copy. A packed copy would be frozen at whatever the docs said on the day
someone last ran `npx skills add` — agents don't refresh an installed skill
on their own, so it would stay frozen indefinitely while the real docs keep
moving. The skill fetches the page index at `docs.templatical.com/llms.txt`,
picks the one page that answers the question, then fetches that page's own
raw markdown — falling back to `curl` when the agent has no fetch tool of
its own, and to naming the URL when it has neither.

## Tests

- **`island-graph.test.ts`** — every Commands-table row resolves to a file,
  every link between islands resolves, every consult island is reachable
  from somewhere, every entry island (and no consult island) is named in
  `SKILL.md`'s `argument-hint`, `SKILL.md` is confirmed to point at the
  phase island before the first command, and no island links into another
  file by anchor.
- **`block-type-coverage.test.ts`** — every block type declared in
  `schema.json` is named in `reference/blocks.md` or `reference/rules.md`,
  so a new block type can't ship without the agent being told it exists.
- **`template-locale.test.ts`** — `reference/rules.md` tells the agent to
  set `settings.locale` to the language of the copy it's writing, not to a
  hardcoded default.
- **`reference-assets.test.ts`** — this package is named
  `@templatical/skill`, and `schema.json`, `block-guide.md` and `examples/`
  are present and shaped the way the islands assume: a valid schema rooted
  at `TemplateContent`, a guide starting with the right heading, at least
  five examples that each carry a non-empty `blocks` array.
- **`consumer-safe-manifest.test.ts`** — `package.json` declares no
  `workspace:*` dependency, which resolves only inside this monorepo and
  would break installation everywhere else.

## Out of scope

- **Cloud onboarding.** `initCloud()` and its provider contracts are
  covered; signing up, issuing keys and plan entitlements happen in Cloud's
  own dashboard.
- **Git.** The skill proposes file changes — and for an integration, waits
  for a go-ahead before writing them — then verifies by running your dev
  server. It never runs a commit, a branch, or a stash; reviewing and
  committing the result is yours to do.

## License

MIT.
