# Importing an existing template

**Before:** [cli.md](cli.md)
**Consult:** [rules.md](rules.md) for what may and may not be emitted
**After:** [validate.md](validate.md) on the result
**Then:** [live.md](live.md), to refine the blocks that fell back to `html` into
native ones — see [blocks.md](blocks.md) for what to turn them into

Import is lossy on every route. The value over running a converter yourself is
the convert → validate → preview → refine loop, not the first pass.

If the user has an existing email to start from, don't build from scratch —
route by what you were actually handed, not by a fixed list of named formats:

| What you have | Route |
|---|---|
| A design or export from an email builder, or any HTML email | `import`, for a deterministic first pass, then refine the `html`-fallback blocks into native ones in [live mode](live.md) |
| A JSON export from an editor with no converter (Mailchimp, Klaviyo, HubSpot…) | Read the export, hand-map it to blocks against `reference/schema.json`, validate, then refine |
| An image or PDF of an email | Read it visually and compose blocks from scratch against the schema |

**Always try `import` first, and ask it rather than guessing what it supports** —
converters are added often, and `--list-formats --json` reports exactly what is
resolvable right now:

```
npx -y @templatical/template-tools@0.38.0 import --list-formats --json
```

Then:

```
npx -y @templatical/template-tools@0.38.0 import <source-file> [--format <fmt>] --json
```

It auto-detects the format from the file's name and content when `--format` is
omitted, writes the result to a working file `.templatical/<name>.json` (same
as a generated template — `--out <name>` overrides the default, which is the
source file's own name), and reports how many blocks converted cleanly vs.
were approximated vs. fell back to `html` vs. were skipped, plus warnings.

One detail worth knowing, because it changes which file you point at: some
builders export a stylesheet beside the HTML rather than inlining it. If a
`.css` sits next to the source file, pass the **HTML** file — the converter
picks up the sibling itself. Handing it the `.css` converts nothing.

Two rules keep this from going stale:

- **Never enumerate supported formats**, here or in conversation — more
  converters ship over time, and a hardcoded list drifts the moment one does.
  Ask the CLI instead:
  ```
  npx -y @templatical/template-tools@0.38.0 import --list-formats --json
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
[Requirements](cli.md) for the exit-`3` contract.
