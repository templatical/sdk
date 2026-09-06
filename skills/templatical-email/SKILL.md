---
name: templatical-email
description: >-
  Generate and validate Templatical email templates as JSON (content blocks +
  settings) that load into the Templatical drag-and-drop editor. This skill
  should be used whenever the user wants to create, design, draft, mock up, or
  edit a marketing, transactional, or newsletter email — for example "make a
  product-launch email", "design a welcome email", "build an event invite",
  "draft an order-confirmation email", or "turn this copy into an email
  template" — even when they don't say "Templatical" or "JSON". Also use it
  when producing or editing Templatical template JSON that must validate against
  the block schema. It can also open a live preview of the template in the real
  Templatical editor (loaded from the CDN) and update it as the user prompts,
  reconciling any in-browser hand-edits — triggered by natural-language intent
  such as "show it live", "preview it live", "open it in the editor", or "build
  this in live mode".
---

# Templatical Email Templates

Generate and validate email templates for the [Templatical](https://templatical.com)
editor. A template is a single JSON document — an array of content **blocks** plus
global **settings** — that loads straight into the editor for a human to refine.

The workflow is simple: read the brief, emit valid template JSON, validate it
with the CLI, then hand it back. No API key or Templatical server is involved —
the agent running this skill is the inference.

This skill has **two modes**, both run through the same published CLI:

- **Build mode** (default) — generate and validate template JSON. Cross-agent,
  nothing installed into the user's project. This is everything below up to
  "Live mode".
- **[Live mode](#live-mode)** (optional) — open the template in the **real**
  Templatical editor in a browser, update it live as the user prompts, and
  reconcile their in-browser hand-edits. Runs locally, on any local-shell
  agent that supports this skill (not just Claude Code — see [Live
  mode](#live-mode)). Entered by intent; build mode is otherwise unchanged.

Within a session both modes operate on one **working template file** in the
user's `.templatical/` folder — so building in JSON and then saying "show it
live" picks up the current template seamlessly. Each template gets its own
uniquely named file and **each new session starts a new template by default** —
see [Working files](#working-files).

**Wiring the result into an app is a different skill.** This one authors and
validates template JSON; it doesn't mount the editor, configure providers, or
touch a consumer's codebase. "How do I load a template into the editor?" or
any other integration/configuration/troubleshooting question about
`@templatical/editor` itself belongs to `templatical-sdk`. "Build a welcome
email and wire it into my app" is both, in that order: build and validate the
template here first, then hand off.

## Talking to the user

Communicate about the _email_, not the machinery. The mechanical steps — reading
the references, picking an example, validating, generating file names, managing
`.templatical/` — are for you, not the user; do them silently.

- **Lead with intent and result.** A sentence of what you're building is plenty
  ("Building an event invitation with clean neutral defaults"), then hand over
  the template. Skip the play-by-play of your own file reads and checks.
- **Surface real choices, not internals.** Worth saying: "there's a template
  from a previous session — start fresh or continue it?" Not worth saying: the
  exact CLI invocation, flags, file paths, example filenames, or "reading the
  schema / validating" — keep those out of user-facing messages.
- **npx's own noise isn't yours to narrate.** On a cold cache it prints its own
  progress fetching the pinned CLI version — that's normal, not part of this
  skill's output, and not an error. Don't call it out and don't apologize for
  it; only speak up when a command's exit code says something actually went
  wrong.
- **Mention setup only on action or failure** — say something when a
  prerequisite is genuinely missing (see [Requirements](#requirements)) or a
  step actually fails, not to confirm that routine state is fine.
- **Report real problems plainly** when they happen (a validation error you
  couldn't resolve, a missing dependency) with the fix — that's signal, not noise.

## Requirements

**Every command below runs through one pinned CLI, and the invocation always
starts the same way:**
```
npx -y @templatical/template-tools@0.30.0 validate <file> --json
```
`npx`, then `-y`, then the package name pinned to `0.30.0`, is the fixed
prefix — identical for `validate`, `render`, `edit`, `import`, `live`, and
`list`; only the subcommand and its own flags change after it. Copy that
prefix exactly: no reordering, no requoting, and never `@latest` in its
place — pinning is what keeps this skill's `reference/schema.json` from ever
disagreeing with the CLI's own block model, since a release moves both
together. `-y` is required: without it, npx's first-fetch confirmation
prompt stalls the turn with no visible cause.

**Node 20+ and network access — for everything, not just live mode.** `npx`
fetches the pinned CLI package from npm the first time it's run at that
version, then npm caches it; after that, no network round trip is needed
until the pin changes at a future release. **Nothing is installed into the
user's project** — no `package.json` edit, no lockfile change, no
`node_modules` entry. `npx` runs the package straight from npm's cache. That's
the property to reassure a wary user about first.

Two commands may each ask for **one** additional install, and the CLI prints
the exact command when it does:

- `render --format html` needs the `mjml` package.
- `import` needs the converter for the source format.

**The exit code says which situation you're in — read it, don't guess from
the output:**

| Exit | Meaning |
|---|---|
| `0` | Succeeded. `validate` may still report lint warnings. |
| `1` | The template itself is invalid — fix the JSON, not the tool. |
| `2` | The command was misused, or the tool broke — bad flags, an unreadable file, an unexpected internal error. |
| `3` | One of the two optional packages above is missing. Install it, then re-run — not a bug. |

When a prerequisite is absent, say so plainly with the fix and fall back to a
mode that works — no Node, too old a version (`node -v`, then
<https://nodejs.org>), or no network blocks everything; no background process
or reachable port (a hosted, server-side sandbox) blocks only [live
mode](#live-mode), and build mode is unaffected.

## Workflow

1. **Understand the brief** — purpose (sale, newsletter, welcome…), audience,
   tone, brand colors/fonts, and any copy or links supplied. Ask only if a hard
   blocker is missing; otherwise choose sensible defaults.
2. **Read the references** in `reference/`:
   - `reference/schema.json` — the authoritative JSON Schema for the whole
     document. When unsure about a field, this is the source of truth.
   - `reference/block-guide.md` — a concise description of every block type and
     its fields.
   - `reference/examples/*.json` — complete, valid templates to model your
     output on.
3. **Generate the JSON** — a complete `{ "blocks": [...], "settings": {...} }`
   document, following the schema exactly (see Rules).
4. **Validate before returning** — write the JSON to the session's working file
   `.templatical/<name>.json` (see [Working files](#working-files) — generate a
   fresh three-word name for a new template; create the folder if needed) and run:
   ```
   npx -y @templatical/template-tools@0.30.0 validate .templatical/<name>.json --json
   ```
   Fix every structural error reported and re-run until it exits `0` or `1`
   (see [Requirements](#requirements)), and resolve the reported accessibility
   / structure / link issues too. Writing to that file is what lets a later
   "show it live" pick up the current template with no extra step.
5. **Hand off** — return the validated JSON. What the user does with it depends
   on who they are: a developer loads it into their editor integration
   (`editor.setContent(json)`); many others just want a finished email — for
   them, **preview it live and export MJML/HTML to send** (see [Live
   mode](#live-mode)) through any provider (SES, Postmark, …), no integration
   needed, or render it yourself (see [Rendering to MJML or
   HTML](#rendering-to-mjml-or-html)). Frame the hand-off for what they're
   actually doing.

## Working files

Every template lives in the user's `.templatical/` folder as its own file with a
random three-word name, like a Claude plan file — e.g.
`.templatical/misty-copper-otter.json`. This keeps finished work around as a
browsable history instead of one file that silently carries state between
unrelated sessions.

- **New by default.** When the user asks for a template, treat it as a **new**
  one: generate a fresh three-word kebab-case name (playful is fine), confirm no
  file of that name already exists in `.templatical/` (regenerate if it does —
  never overwrite an existing template), and write there. A fresh session thus
  starts a fresh template; never silently resume an earlier one.
- **Resume only on request.** If the user asks to continue a previous template
  ("keep working on the welcome email", "open misty-copper-otter"), list what's
  there:
  ```
  npx -y @templatical/template-tools@0.30.0 list --json
  ```
  Each entry carries a title hint pulled from the template's first heading
  block — use it to figure out which one the user means.
- **One template per session.** Track the active file name for the whole
  session so build mode and live mode operate on the same template — validate,
  render, edit, and reload all target that file. **If that tracking is ever
  lost** — a fresh turn with no memory of which file was active — `list` is
  how to recover it: it enumerates `.templatical/*.json` straight off disk, so
  it's authoritative even when your own context isn't. The `.templatical/`
  folder is a working area; it's fine to leave old templates there (suggest
  the user gitignore it), and the user can clear it whenever they like.

## Importing an existing template

If the user has an existing email to start from, don't build from scratch —
route by what you were actually handed, not by a fixed list of named formats:

| What you have | Route |
|---|---|
| HTML — a file, an editor's HTML export, or a page you can fetch and save | `import`, for a deterministic first pass, then refine the `html`-fallback blocks into native ones in [live mode](#live-mode) |
| A JSON export from an editor with no converter (Mailchimp, Klaviyo, Stripo, HubSpot…) | Read the export, hand-map it to blocks against `reference/schema.json`, validate, then refine |
| An image or PDF of an email | Read it visually and compose blocks from scratch against the schema |

For the first route:

```
npx -y @templatical/template-tools@0.30.0 import <source-file> [--format <fmt>] --json
```

It auto-detects the format from the file's content when `--format` is
omitted, writes the result to a working file `.templatical/<name>.json` (same
as a generated template — `--out <name>` overrides the default, which is the
source file's own name), and reports how many blocks converted cleanly vs.
were approximated vs. fell back to `html` vs. were skipped, plus warnings.

Two rules keep this from going stale:

- **Never enumerate supported formats**, here or in conversation — more
  converters ship over time, and a hardcoded list drifts the moment one does.
  Ask the CLI instead:
  ```
  npx -y @templatical/template-tools@0.30.0 import --list-formats --json
  ```
  which reports exactly what's resolvable right now, per format, in the
  current project.
- **Always try `import` first**, even for a JSON export you're not sure has a
  converter — a deterministic converter plus a conversion report beats
  guessing, and the report is what tells you which blocks need hand-refining.
  Hand-mapping against the schema is the fallback for a format with no
  converter, not the default move.

**Import is lossy on every route.** Unmapped constructs become `html` blocks,
get approximated, or get dropped — expected, not a converter bug to chase. The
value isn't a one-shot perfect conversion; it's the loop: convert (or
hand-map) → validate → preview in live mode → refine the fallback blocks into
native ones.

Each format's converter is optional and installed on demand — see
[Requirements](#requirements) for the exit-`3` contract.

## Editing with operations

For a **scoped change** to a template that's already valid — recolor a button,
swap a headline, delete a block, reorder two sections — apply an operation
instead of regenerating and rewriting the whole document:

```
npx -y @templatical/template-tools@0.30.0 edit .templatical/<name>.json --op '{"operation":"update_block","data":{"blockId":"button_1","updates":{"backgroundColor":"#1d4ed8"}}}' --json
```

`edit` applies the operation, validates the result, and writes the file — all
in one step, and nothing is written if the result isn't structurally valid.
The vocabulary: `add_block`, `update_block`, `update_block_style`,
`delete_block`, `move_block`, `update_settings`, and `set_content` (a full
replacement — the operation-shaped equivalent of a rewrite, not a scoped
change). **Use `update_block_style` for a block's `styles`** — it merges, so
setting one property doesn't drop `padding`; `update_block`'s `updates`
replaces whichever top-level keys you pass, `styles` included, so passing
`styles` there clobbers the rest of it. Batch several operations with `--ops
<file>` (a JSON array of the same objects) instead of one `--op` per call —
the batch is all-or-nothing.

**Prefer an operation over a whole-document rewrite whenever the change is
scoped.** It matters most once [live mode](#live-mode) is running: a
whole-document write discards whatever the user just hand-edited in the
browser, even for a one-word change, while an operation composes on top of
it — which is also what keeps the live-update loop's divergence check from
firing on edits that were never actually in conflict. Reach for a full
rewrite only for a genuine rebuild — a new layout, a different brief,
starting over.

## Rendering to MJML or HTML

Most hand-offs are the JSON itself (see [Workflow](#workflow) step 5). When
the user needs the email in a sendable format instead — to paste into an ESP,
or because they have no editor integration to load JSON into — render it:

```
npx -y @templatical/template-tools@0.30.0 render .templatical/<name>.json --format mjml -o .templatical/<name>.mjml
npx -y @templatical/template-tools@0.30.0 render .templatical/<name>.json --format html -o .templatical/<name>.html
```

Drop `-o <file>` to print the rendered output to stdout instead, if you'd
rather hand it to the user inline than read it back from disk.

- **`--format mjml` always works** on a bare `npx` call — the renderer is a
  hard dependency of the CLI, nothing extra to install.
- **`--format html` needs the optional `mjml` compiler.** If it's missing the
  command exits `3` and prints the install command (see
  [Requirements](#requirements)) — that's the one extra install to offer, not
  a failure to work around.
- **[Live mode](#live-mode)'s Export button** offers JSON / MJML / HTML from
  the browser, compiled client-side — reachable for anyone with a browser and
  no npm at all.

**Be plain about the one real gap this leaves.** On a hosted, sandboxed agent
with network access but no ability to run an install and no reachable
browser, you can produce MJML but not HTML — and almost no ESP accepts MJML
directly. Say so rather than imply HTML is always one command away: offer
live mode's Export when it's reachable, and otherwise name the exact `npm
install mjml` the environment would need.

## Rules

- **Emit these block types:** `section`, `title`, `paragraph`, `image`,
  `button`, `divider`, `spacer`, `social`, `video`, `menu`, `table`, `html`.
  Prefer native blocks — reach for `html` only when nothing else fits, since raw
  HTML is not visually editable afterward.
- **Never emit `countdown` or `custom` blocks** (even though the schema allows
  them): `countdown` needs the Templatical **Cloud** backend to render its
  animated GIF — the open-source renderer can't, so it would break — and `custom`
  blocks are consumer-registered runtime extensions that can't be produced from a
  prompt. If the user asks for a countdown, say it's a Cloud feature and offer a
  static stand-in instead — a `title`/`paragraph` with the date/time, or a "X days
  to go" line (optionally a `{{merge_tag}}`).
- **Every block needs** `id` (unique, e.g. `"title_1"`), `type`, and
  `styles.padding` (`{ top, right, bottom, left }` in px).
- **Structure content in sections.** A `section` has `children`: an array of
  columns, each column an array of blocks. `columns` is `"1"`, `"2"`, `"3"`,
  `"2-1"`, or `"1-2"`, and the column count in `children` must match. Don't nest
  a section inside another section — MJML has no equivalent, so the renderer
  drops it on export.
- **Rich text** (`title.content`, `paragraph.content`) is HTML — use inline tags
  (`<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`). Use blocks, not HTML, for layout.
  **Table cell `content` is the exception — plain text, no inline HTML** (tags
  render literally); for emphasis use `hasHeaderRow`, or a 2-column `section` of
  `paragraph` blocks for a label/value layout.
- **Merge tags** for personalization use `{{contact.field_name}}` (e.g.
  `{{contact.first_name}}`); they're substituted when the email is sent.
- **No extra fields** — the schema rejects unknown properties. If unsure a field
  exists, check `reference/schema.json`.
- **Colors** are hex strings (`"#4CBB17"`). **Images**: use a real URL when
  given, else a placeholder like `https://placehold.co/600x300`, and always write
  meaningful `alt` text.
- **Settings** must include `width` (usually `600`), `backgroundColor`,
  `textColor`, `fontFamily`, `linkUnderline`, and `locale` (BCP-47, e.g. `"en"`).

## Composing with project context

Layer the user's own context **on top of** these rules — brand guidelines, a
house system prompt, tone of voice, preferred fonts/palette, a mandatory
footer or links. When brand settings are provided, use them for colors, fonts,
and copy voice instead of generic defaults. This skill defines the _format_; the
user's context defines the _taste_.

## Design defaults (when the brief is thin)

- 600px width, generous side padding (~24px), clear hierarchy (one lead
  title, supporting paragraphs).
- One primary call-to-action button with a high-contrast background.
- Readable body text (14–16px), sufficient contrast, alt text on every image.
- A footer section (divider + social/menu + an unsubscribe line) for anything
  campaign-like.

## Live mode

Live mode opens the template in the **real** Templatical editor in a browser and
keeps it in sync as the user prompts, so they watch the email take shape and can
also drag-edit it directly. It's optional.

**Where it runs.** Live mode runs on the user's own machine — it keeps a
background process (the bridge) alive across turns, reaches `localhost`, and
needs the user's browser (Chrome/Edge 80+, Firefox 101+, Safari 16.4+ — the
floor the CDN-loaded editor needs). If your environment can't do that (e.g. a
hosted or server-side sandbox with no local filesystem or reachable port),
tell the user live mode isn't available here and stay in build mode. Build
mode itself is unaffected.

**It adds nothing beyond the CLI itself.** The bridge — the CLI's `live`
command — uses only Node built-ins; the editor and `mjml-browser` load from
the CDN in the browser. None of that is fetched or run until live mode
actually starts.

### Entering live mode

Enter it whenever the user expresses the intent — "show it live", "preview it
live", "open it in the editor", "build this in live mode", or similar — mid-session
is fine. Natural-language intent is the portable trigger and works on every
harness. (In Claude Code you can also pass it as an argument with a **space**:
`/templatical-email live` — use a space, not a colon; `/templatical-email:live` is
plugin-command-namespace syntax that silently starts build mode instead.)
Live mode serves the session's working template (`.templatical/<name>.json`, see
[Working files](#working-files)); if the user hasn't built one yet, create a new
template first. A mid-session switch just points the bridge at that file.

> **Working directory matters — every command in this file resolves relative
> to it.** `npx` fetches the pinned CLI package from npm's cache no matter
> where you run it, but everything the CLI *touches* — the working file, the
> live server's pidfile, any cwd-installed optional converter — resolves
> against the current directory. Run every command below with the **user's
> project** as the current directory, not this skill's folder. If you can't
> control the cwd, pass `--cwd <project>` (and, for `live`, optionally
> `--file <path>`) so `start`/`reload`/`stop` all agree on the same location.

1. Ensure the session's `.templatical/<name>.json` exists and is valid (run
   `validate`; build a new template first if there isn't one yet — see
   [Workflow](#workflow)).
2. Start the bridge in the background (from the project root), pointing it at
   the session's template with `--file`:
   ```
   npx -y @templatical/template-tools@0.30.0 live --file .templatical/<name>.json --json
   ```
   Read the URL and working-file path from the JSON line on stdout (`url`,
   `workingFile`) rather than pattern-matching prose — the bridge also opens
   the URL in the user's default browser itself. It prefers port 4747 but
   falls back to a free OS-assigned port if that's taken (`fellBack: true`
   when it did — don't assume the fixed port). It's single-instance via a
   pidfile guard; a second start just reports the one already running. Other
   flags: `--port <n>`, `--cwd <project>`, `--no-open` (skip the auto-open).
3. Share the URL in your reply so the user has it (to reopen, or open on
   another device). The bridge **already opened it in their default
   browser** on start, so you don't need to open it yourself — and never with
   a browser-automation/testing tool (e.g. Playwright). If the auto-open
   didn't fire (a headless or sandboxed environment), just point the user to
   the URL. The page shows the current template in the real editor.

### The prompt → live-update loop

When the user asks for a change:

1. **Check for divergence and notes first.** Read the editor's latest state
   from the bridge's `GET /content` endpoint (at the URL from step 2 above,
   e.g. `http://localhost:4747/content`) → `{ divergent, content, annotations }`.
   - `divergent: false` → no in-browser hand-edits since your last write. Proceed.
   - `divergent: true` → the user hand-edited in the browser. **Ask before
     overwriting:** _"You've edited the template in the browser since I last
     updated it. Build on your browser version, or replace it with what I have?"_
     - **Browser version** → take the returned `content` as your new base and
       continue.
     - **Replace with mine** → apply to your own version; say explicitly that
       this discards their browser edits.
   - **Non-empty `annotations`** → each entry (`{ id, blockId, text, createdAt }`,
     `blockId: null` for a template-wide note) is a request the user left in
     the browser instead of in chat. Act on every one, scoped to its block,
     together with whatever they asked for this turn in chat. **A note is
     picked up on your next turn, not the moment it's written** — nothing can
     wake you from a web page, so say that plainly if it comes up rather than
     let the delay read as a bug.
2. **Apply the change.** For a scoped edit, prefer an operation (see [Editing
   with operations](#editing-with-operations)) — `edit` validates and writes
   in one step, composing on top of whatever's currently in the working file
   rather than discarding it:
   ```
   npx -y @templatical/template-tools@0.30.0 edit .templatical/<name>.json --op '<json>' --json
   ```
   For a genuine rebuild, regenerate the document and **validate it before
   writing** — never push invalid content to the editor:
   ```
   npx -y @templatical/template-tools@0.30.0 validate .templatical/<name>.json --json
   ```
   then write it to `.templatical/<name>.json` yourself.
3. **Push the write** to the browser:
   ```
   npx -y @templatical/template-tools@0.30.0 live reload --json
   ```
   The page updates live (over Server-Sent Events) — no refresh. This also
   clears `annotations`, so a note is never acted on twice.

### Export

The page's **Export** button opens a modal with **JSON / MJML / HTML** tabs
(HTML compiles in-browser via `mjml-browser`, loaded on demand) — reachable
for anyone with a browser and no `npm`. You can also render either format
yourself without live mode; see [Rendering to MJML or
HTML](#rendering-to-mjml-or-html).

### Ending live mode

Stop the bridge when the user is done (or the session ends) so no process or port
is orphaned:

```
npx -y @templatical/template-tools@0.30.0 live stop --json
```

### Notes & limits

- **`.templatical/` is a working directory** — it holds the shared template and
  the bridge's pidfile. Suggest the user add `.templatical/` to their project's
  `.gitignore` (don't edit their `.gitignore` without asking).
- **Local and single-user.** This is an ephemeral local bridge, not the Cloud
  realtime/collaboration path (no accounts, no persistence, no multi-user).
- **`html` blocks run as-is** in the preview (the editor sanitizes rich text, but
  raw `html` blocks are not sanitized). It's the user's own local content, but be
  aware the preview executes it.
- The CDN editor the live harness loads is pinned to a version whose block
  model matches `reference/schema.json` — kept in sync automatically at
  release time, so the live editor and this skill's schema never drift apart.
