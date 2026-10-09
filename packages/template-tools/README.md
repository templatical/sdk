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
| `live --custom-block <file> [--host <template>]` | Preview a custom block definition in the real editor, optionally inside a host template |
| `custom-block validate <file>` | Check a custom block definition against its schema, its Liquid template and email-client safety rules |
| `custom-block render <file>` | Render a custom block's specimen states to MJML (`--format html` for HTML, `--state <name>` for one state) |
| `custom-block fetch <file>` | Run the definition's `dataSourcePreview` recipe and print the response |
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

Nothing is installed into your project by default. These commands can ask for an optional package:

- `render --format html` and `custom-block render --format html` need `mjml` (the SDK bundles no MJML compiler).
- `custom-block validate` compiles to HTML when `mjml` is installed and skips that check (with a note) when it isn't.
- `import` needs the converter package for that format. Run `import --list-formats` to see which are resolvable right now — the list grows over time, so this is the only answer that doesn't go stale.

Install them wherever you run the command; they are resolved from your working directory.

## Library use

```ts
import {
  validateTemplate,
  runQualityLint,
  applyOperation,
  checkCustomBlock,
} from "@templatical/template-tools";
import { startBridge } from "@templatical/template-tools/live";
```

`checkCustomBlock` runs the same checks as `custom-block validate`; `validateCustomBlockDefinition` runs only the structural check. The JSON Schema for a custom block definition is at `@templatical/template-tools/custom-block-schema.json`.

MIT.
