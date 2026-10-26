# validate — check a template, and read the result

**Before:** [cli.md](cli.md), for the exit-code contract
**After:** on failure, back to [build.md](build.md) or [edit.md](edit.md) to fix
what it named
**Related:** [export.md](export.md) refuses to be useful on an invalid template,
so this always runs first

Run it before writing any template to disk, and whenever the user asks whether
one is correct.

```
npx -y @templatical/template-tools@0.51.1 validate <file> --json
```

## Reading the result

`--json` is not optional here — structured output is what removes the guesswork
from prose.

| Exit | Means | Do |
|---|---|---|
| `0` | Valid, with no error-severity lint | Report warnings and info without treating them as failure |
| `1` | Invalid structure or any `severity: "error"` lint issue | Fix `errors[]` for structure or error-severity `issues[]` for lint; output can still say `valid: true` |
| `2` | Misuse or a broken tool | A file the JSON parser cannot read arrives here too — check it parses before blaming the template |
| `3` | A missing optional dependency | Not a validation result. Install what it names and re-run |

`valid: true` alone does not mean exit 0. Act on the exit code as the command's result. Usage and tool errors (2, 3) go to stderr without a result document, even with `--json`.

## Lint severity

`issues[]` is the quality lint — accessibility, structure, links, deliverability, compatibility — with severity
`error`, `warning` or `info`. Structural failure or any error-severity lint issue
returns exit 1. Warnings and info never change the exit code. A missing preheader
(`info`) is worth one mention; a `warning` is worth fixing before the user sends.
`valid` reports structural validity only; error-severity lint can fail the command
while `valid` remains `true` and `errors[]` stays empty.
`deliverability.*` issues are warning or info advice in this CLI and never
cause exit 1.

For compiled size, run `npx -y @templatical/template-tools@0.51.1 validate <file> --html --json`. Read `htmlBytes` and any `compat.gmail-clipping` warning. This flag needs the optional `mjml` peer; if it is missing, exit `3` with an install hint and no JSON. `compat.*` issues are warning/info for template validation and never cause exit `1` by themselves. Each lint issue supplies `suggestion` and `reference`; use them when repairing the template.
