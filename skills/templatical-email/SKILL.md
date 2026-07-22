---
name: templatical-email
description: >-
  Generate and validate Templatical email templates as JSON (content blocks +
  settings) that load into the Templatical drag-and-drop editor. This skill
  should be used whenever the user wants to create, design, draft, mock up, or
  edit a marketing, transactional, or newsletter email — for example "make a
  product-launch email", "design a welcome email", "build an event invite with a
  countdown", "draft an order-confirmation email", or "turn this copy into an
  email template" — even when they don't say "Templatical" or "JSON". Also use it
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
with the bundled script, then hand it back. No API key or server is involved —
the agent running this skill is the inference.

This skill has **two modes**, one install:

- **Build mode** (default) — generate and validate template JSON. Fully offline,
  cross-agent, needs only `ajv`. This is everything below up to "Live mode".
- **[Live mode](#live-mode)** (optional) — open the template in the **real**
  Templatical editor in a browser, update it live as the user prompts, and
  reconcile their in-browser hand-edits. Local, needs **no** npm dependencies,
  and runs on any local-shell agent that supports this skill (not just Claude
  Code — see [Live mode](#live-mode)). Entered by intent; build mode is otherwise
  unchanged.

Within a session both modes operate on one **working template file** in the
user's `.templatical/` folder — so building in JSON and then saying "show it
live" picks up the current template seamlessly. Each template gets its own
uniquely named file and **each new session starts a new template by default** —
see [Working files](#working-files).

## Talking to the user

Communicate about the _email_, not the machinery. The mechanical steps — reading
the references, picking an example, validating, generating file names, managing
`.templatical/` — are for you, not the user; do them silently.

- **Lead with intent and result.** A sentence of what you're building is plenty
  ("Building an event invitation with clean neutral defaults"), then hand over
  the template. Skip the play-by-play of your own file reads and checks.
- **Surface real choices, not internals.** Worth saying: "there's a template
  from a previous session — start fresh or continue it?" Not worth saying:
  dependency names (`ajv`), file paths, example filenames, or "reading the
  schema / validating" — keep those out of user-facing messages.
- **Mention setup only on action or failure** — say something when you're
  installing the validator or a step actually fails, not to confirm that routine
  state is fine.
- **Report real problems plainly** when they happen (a validation error you
  couldn't resolve, a missing dependency) with the fix — that's signal, not noise.

## Setup (first run)

From this skill's folder, install the validator's dependencies:

```
npm install ajv @templatical/quality
```

`ajv` is **required** (structural validation). `@templatical/quality` is
**optional but highly recommended** — it layers accessibility / structure / link
linting on top, catching issues structural validation alone can't. If you skip
it, validation still works; the quality layer just doesn't run.

If the validator ever reports a missing dependency, it prints the exact
`npm install` to run — run that in the skill folder, then re-run the validator.

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
   node scripts/validate.mjs .templatical/<name>.json
   ```
   Fix every structural error reported and re-run until it passes. When
   `@templatical/quality` is installed, also resolve reported accessibility /
   structure / link warnings. Writing to that file is what lets a later "show it
   live" pick up the current template with no extra step.
5. **Hand off** — return the validated JSON. The user loads it into the editor
   (`editor.setContent(json)`) and refines it there — or asks to preview it live
   (see [Live mode](#live-mode)).

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
  ("keep working on the welcome email", "open misty-copper-otter"), list
  `.templatical/*.json` — using each file's first title/heading block as a hint —
  and use the one they mean.
- **One template per session.** Track the active file name for the whole session
  so build mode and live mode operate on the same template — validate, preview,
  and reload all target that file. The `.templatical/` folder is a working area;
  it's fine to leave old templates there (suggest the user gitignore it), and the
  user can clear it whenever they like.

## Rules

- **Emit these block types:** `section`, `title`, `paragraph`, `image`,
  `button`, `divider`, `spacer`, `social`, `video`, `menu`, `table`, `countdown`,
  `html`. Prefer native blocks — reach for `html` only when nothing else fits,
  since raw HTML is not visually editable afterward. Do **not** emit `custom`
  blocks — those are consumer-registered runtime extensions and cannot be created
  from a prompt.
- **Every block needs** `id` (unique, e.g. `"title_1"`), `type`, and
  `styles.padding` (`{ top, right, bottom, left }` in px).
- **Structure content in sections.** A `section` has `children`: an array of
  columns, each column an array of blocks. `columns` is `"1"`, `"2"`, `"3"`,
  `"2-1"`, or `"1-2"`, and the column count in `children` must match. Don't nest
  a section inside another section — MJML has no equivalent, so the renderer
  drops it on export.
- **Rich text** (`title.content`, `paragraph.content`, table cell `content`) is
  HTML — use inline tags (`<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`). Use blocks,
  not HTML, for layout.
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
background process (the bridge) alive across turns and reaches `localhost`. If
your environment can't do that (e.g. a hosted or server-side sandbox with no
local filesystem or reachable port), tell the user live mode isn't available here
and stay in build mode. Build mode itself is unchanged.

**It adds no npm dependencies.** The bridge (`scripts/live-server.mjs`) uses only
Node built-ins; the editor and `mjml-browser` load from the CDN. These assets are
inert until live mode is started.

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

> **Working directory matters.** The working file and the server's pidfile live
> under the **user's project** directory (`<project>/.templatical/`), not this
> skill's folder. Run every command below — `live-server.mjs` (start/`reload`/
> `stop`) and `validate.mjs` — with the project as the current directory,
> referencing the skill script by its path (`node <skill>/scripts/live-server.mjs`).
> If you can't control the cwd, pass `--cwd <project>` (and optionally
> `--file <path>`) so `start`/`reload`/`stop` all agree on the same location.

1. Ensure the session's `.templatical/<name>.json` exists and is valid (run the
   validator; build a new template first if there isn't one yet).
2. Start the bridge in the background (from the project root), pointing it at the
   session's template with `--file`:
   ```
   node <skill>/scripts/live-server.mjs --file .templatical/<name>.json
   ```
   It **prints the URL it's serving** and the working-file path. It prefers port
   4747 but falls back to a free port if that's taken, so **read the actual URL
   from its output** (the port is also recorded in `.templatical/live-server.pid`
   as `port`) — don't assume a fixed port. It is single-instance via the pidfile
   guard; a second start just reports the running one. Other flags: `--port <n>`,
   `--cwd <project>`.
3. Open that URL — in Claude Code use the browser/preview pane; in other agents
   open the system browser. The page loads the editor from the CDN and shows the
   current template.

### The prompt → live-update loop

When the user asks for a change:

1. **Check for divergence first.** Read the editor's latest state from the
   bridge's `GET /content` endpoint (at the URL from step 2) → `{ divergent, content }`.
   - `divergent: false` → no in-browser hand-edits since your last write. Proceed.
   - `divergent: true` → the user hand-edited in the browser. **Ask before
     overwriting:** _"You've edited the template in the browser since I last
     updated it. Build on your browser version, or replace it with what I have?"_
     - **Browser version** → take the returned `content` as your new base, apply
       the requested change on top of it, and continue.
     - **Replace with mine** → apply to your own version; say explicitly that
       this discards their browser edits.
2. **Validate**, always, before writing: `node <skill>/scripts/validate.mjs .templatical/<name>.json`
   (write your candidate first). Never push invalid content to the editor.
3. **Write** the validated JSON to the session's `.templatical/<name>.json`, then push it:
   ```
   node <skill>/scripts/live-server.mjs reload
   ```
   The page updates live (over Server-Sent Events) — no refresh.

### Export

The page has **Copy JSON**, **Get MJML**, and **Get HTML** buttons (HTML compiles
in-browser via `mjml-browser`, loaded from the CDN on demand). You can also hand
the user JSON directly, or MJML/HTML via `@templatical/renderer` in build mode.

### Ending live mode

Stop the bridge when the user is done (or the session ends) so no process or port
is orphaned:

```
node <skill>/scripts/live-server.mjs stop
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
- The CDN editor version is **pinned** to this skill's schema version, so the
  live editor's block model matches `reference/schema.json`.
