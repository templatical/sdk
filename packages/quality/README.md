# @templatical/quality

> Accessibility linter for Templatical email templates. Runs in the browser or on Node.

[![npm version](https://img.shields.io/npm/v/@templatical/quality?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/quality)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

Deterministic accessibility checks against the JSON `TemplateContent` block tree — missing alt text, low-contrast text and buttons, vague link / CTA copy, heading-skip, undersized touch targets, and more. Same package validates inside the editor (live sidebar tab + canvas badges) and in headless / CI checks.

MIT-licensed, JSON-only, no Vue, no DOM. Optional peer of `@templatical/editor`.

## Install

```bash
npm install @templatical/quality
```

## Usage

### Headless

```ts
import { lintAccessibility } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

const content: TemplateContent = JSON.parse(stored);
const issues = lintAccessibility(content);

for (const issue of issues) {
  console.log(`[${issue.severity}] ${issue.ruleId}: ${issue.message}`);
}
```

`lintAccessibility(content, options?)` is synchronous and pure — no DOM, no network, no fetch.

### Editor

`@templatical/editor` lazy-imports this package on demand. Pass `accessibility` to `init()` / `initCloud()`:

```ts
import { init } from "@templatical/editor";

init({
  container: "#editor",
  locale: "en",
  accessibility: {
    rules: {
      "img-missing-alt": "warning",
      "text-all-caps": "off",
    },
    thresholds: { minFontSize: 16 },
  },
});
```

The sidebar tab and inline canvas badges appear automatically once this peer is resolved.

### Custom rules

Compose your own walkers using the same primitives the package ships:

```ts
import { walkBlocks, getContrastRatio } from "@templatical/quality";

walkBlocks(content, (block, ctx) => {
  if (block.type === "title" && block.color) {
    const ratio = getContrastRatio(block.color, ctx.resolvedBackgroundColor);
    if (ratio < 4.5) {
      console.warn(`Heading ${block.id} contrast ${ratio.toFixed(2)}:1`);
    }
  }
});
```

## Docs

- [Overview](https://docs.templatical.com/quality/accessibility/)
- [Rule catalog](https://docs.templatical.com/quality/accessibility/rule-catalog)
- [Options](https://docs.templatical.com/quality/accessibility/options)
- [Headless usage](https://docs.templatical.com/quality/accessibility/headless-usage)
- [Contributing locales](https://docs.templatical.com/quality/accessibility/contributing-locales)
