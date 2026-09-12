# validate — check a template, and read the result

**Before:** [cli.md](cli.md), for the exit-code contract
**After:** on failure, back to [build.md](build.md) or [edit.md](edit.md) to fix
what it named
**Related:** [export.md](export.md) refuses to be useful on an invalid template,
so this always runs first

Run it before writing any template to disk, and whenever the user asks whether
one is correct.

```
npx -y @templatical/template-tools@0.36.0 validate <file> --json
```

## Reading the result

`--json` is not optional here — structured output is what removes the guesswork
from prose.

| Exit | Means | Do |
|---|---|---|
| `0` | Structurally valid | Report any lint issues rather than passing them on silently |
| `1` | The template is invalid | `errors[]` names the exact path. Fix the JSON, not the tool |
| `2` | Misuse, or the tool broke | A file the JSON parser cannot read arrives here too — check it parses before blaming the template |
| `3` | An optional package is missing | Not a validation result. Install what it names and re-run |

## Issues are not errors

`issues[]` is the quality lint — accessibility, structure, links — with severity
`error`, `warning` or `info`. **Only structural failure moves the exit code.** A
missing preheader (`info`) is worth one mention; a `warning` is worth fixing
before the user sends. Never present a lint issue as though the template were
invalid.
