# Requirements

**Phase island.** Read once per session, before the first command. Every other
playbook assumes it and none repeat it.
**Related:** [working-files.md](working-files.md) — where templates live.

**Every command below runs through one pinned CLI, and the invocation always
starts the same way:**
```
npx -y @templatical/template-tools@0.51.1 validate <file> --json
```
`npx`, then `-y`, then the package name pinned to an exact version, is the
fixed prefix — identical for `validate`, `render`, `edit`, `import`, `live`,
`strings` and `list`; only the subcommand and its own flags change after it. Copy that
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

- `render --format html` and `validate --html` need the `mjml` package.
- `import` needs the converter for the source format.

**The exit code says which situation you're in — read it, don't guess from
the output:**

| Exit | Meaning |
|---|---|
| `0` | Succeeded. `validate` may still report lint warnings. |
| `1` | The template is invalid, or `strings import` rejected fields (accepted fields are still written). |
| `2` | The command was misused, or the tool broke — bad flags, an unreadable file, an unexpected internal error. |
| `3` | An optional package above is missing. Install it, then re-run — not a bug. |

`deliverability.*` and `compat.*` issues are warning or info advice in the default CLI
configuration. They never cause exit 1; structural errors and error-severity
lint issues do. `localization.merge-tags-differ` is also blocking at warning severity: `validate --locale` exits 1 for a merge-tag mismatch even when `valid: true`. Missing and stale translations alone are advisory; see [localize.md](localize.md).

When a prerequisite is absent, say so plainly with the fix and fall back to a
mode that works — no Node, too old a version (`node -v`, then
<https://nodejs.org>), or no network blocks everything; no background process
or reachable port (a hosted, server-side sandbox) blocks only [live
mode](live.md), and build mode is unaffected.

`validate <file> --html --json` compiles the rendered email and adds exact UTF-8 `htmlBytes` plus a `compat.gmail-clipping` warning above 90 KiB. It requires `mjml`: missing peer means exit `3` and the existing install hint on stderr before any JSON output. Compatibility warning/info never changes a valid template to exit `1`.

If quality lint itself throws during `validate`, the command exits 2 with a diagnostic on stderr and no result document, including with `--json`.

## Strings

For a saved template with German in `settings.locales`, export its missing/stale fields, edit each entry’s `text`, then import:

```bash
npx -y @templatical/template-tools@0.51.1 strings export template.json --locale de --out strings.de.json --json
npx -y @templatical/template-tools@0.51.1 strings import template.json strings.de.json --json
npx -y @templatical/template-tools@0.51.1 validate template.json --locale de --json
```

The file is `{ "templatical": "strings/1", "sourceLocale": "en", "targetLocale": "de", "strings": [] }`. Its `LocaleString` entries have `id`, `format: "html" | "text"`, masked `source`, `sourceHash` and optional masked `text`. Keep the ids and hashes. Missing `text` is skipped; empty `text` is applied. Tokens are regenerated from current defaults and are not stored in the file.

- `--only gaps|all` selects export fields (default `gaps`: missing and stale); `--block <id>` restricts export to one block.
- `--syntax liquid|handlebars|mailchimp|ampscript` selects the editor’s preset (default `liquid`).
- `--definitions <file>` loads a JSON array of `CustomBlockDefinition` for custom `text`/`textarea` fields; also supported by `validate` and `render`. Each definition is checked with `validateCustomBlockDefinition`. Render and `validate --html` use each type’s Liquid template and stylesheet. Liquid is a hard dependency; it has no optional-install exit 3.
- `--do-not-translate <file>` loads a JSON array of at most 500 protected terms, each 1–100 characters after trimming. Matching is case-sensitive, longest first, non-overlapping, in text and HTML attribute values; boundaries are characters other than Unicode letters, numbers or `_`.
- `--out <file>` selects the destination. Export defaults to stdout, where even `--json` prints the strings file itself. With `--out <file> --json`, the result is `{ file, sourceLocale, targetLocale, count }`. Import defaults to overwriting the template; use `--out` to preserve the input.

Use the same syntax, definitions and protected terms for export/import. Preserve every `<x id="n"/>` (text) and `__xn__` (HTML attributes) exactly once, sharing one sequence per field. Import checks placeholders, unmasks, then checks restored HTML. Allowed tags: `p`, `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br`, `span` (merge/logic chips included). Any `on*` attribute or trimmed, lower-cased `href`/`src` starting with `javascript:` is refused.

Import reports `{ applied, rejected: [{ id, reason }], file }` with `--json`. Reasons: `stale` (default changed after export), `tags_changed`, `unknown_field`, `not_translatable`, `unsafe_html`. Accepted fields are validated and written even with rejections. Exit `0` means nothing was rejected; exit `1` means partial or complete rejection. Export exits `0`; an unknown locale exits `1` with `unknown_locale` on stderr. Missing arguments, unreadable/invalid strings files or invalid definitions/term files exit `2`, without a result document. Inspect rejections and run `validate --locale de` afterward; warnings alone can still exit `0`.

Fetch `api/template-tools` through [docs.md](docs.md) for the full contract and [localize.md](localize.md) for the localization workflow.
