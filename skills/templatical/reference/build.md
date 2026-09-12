# Workflow

**Before:** [cli.md](cli.md)
**Consult:** [rules.md](rules.md) for what may and may not be emitted ·
[blocks.md](blocks.md) for field-level shape · [brand.md](brand.md) when the
project has its own colours and fonts
**After:** [validate.md](validate.md), always, before the file is written
**Then:** [live.md](live.md) to refine together, or [export.md](export.md) for
sendable output

Use [edit.md](edit.md) instead when the template exists and the change is
scoped — a whole-document rewrite discards work the user did by hand.

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
   `.templatical/<name>.json` (see [Working files](working-files.md) — generate a
   fresh three-word name for a new template; create the folder if needed) and run:
   ```
   npx -y @templatical/template-tools@0.36.0 validate .templatical/<name>.json --json
   ```
   Fix every structural error reported and re-run until it exits `0` or `1`
   (see [Requirements](cli.md)), and resolve the reported accessibility
   / structure / link issues too. Writing to that file is what lets a later
   "show it live" pick up the current template with no extra step.
5. **Hand off** — return the validated JSON. What the user does with it depends
   on who they are: a developer loads it into their editor integration
   (`editor.setContent(json)`); many others just want a finished email — for
   them, **preview it live and export MJML/HTML to send** (see [Live
   mode](live.md)) through any provider (SES, Postmark, …), no integration
   needed, or render it yourself (see [Rendering to MJML or
   HTML](export.md)). Frame the hand-off for what they're
   actually doing.
