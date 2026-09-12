# @templatical/template-tools

CLI and library for [Templatical](https://templatical.com) email templates.

```bash
npx -y @templatical/template-tools validate .templatical/my-template.json
```

## Commands

| Command | What it does |
|---|---|
| `validate <file>` | Structural validation plus the accessibility / structure / link lint |
| `render <file> --format mjml\|html` | Render to MJML, or to sending-ready HTML |
| `edit <file> --op <json>` | Apply one operation, or a batch with `--ops <file>` |
| `import <file>` | Convert a template from another tool's export format — run `import --list-formats` to see what's supported |
| `live` | Open the template in the real editor in a browser |
| `schema` | Print the block JSON Schema |
| `list` | List the working templates in `.templatical/` |

Add `--json` to any command for machine-readable output on stdout.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. Lint warnings may still be reported. |
| `1` | The template is invalid — structural errors, or a lint issue of severity `error`. |
| `2` | Usage error — bad flags, missing or unreadable input. |
| `3` | An optional dependency is missing. The message names the install command. |

## Optional dependencies

Nothing is installed into your project by default. Two commands can ask for one thing:

- `render --format html` needs `mjml` (the SDK bundles no MJML compiler).
- `import` needs the converter package for that format. Run `import --list-formats` to see which are resolvable right now — the list grows over time, so this is the only answer that doesn't go stale.

Install them wherever you run the command; they are resolved from your working directory.

## Library use

```ts
import { validateTemplate, runQualityLint, applyOperation } from "@templatical/template-tools";
import { startBridge } from "@templatical/template-tools/live";
```

MIT.
