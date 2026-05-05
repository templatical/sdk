# Getting started

## Install

```bash
pnpm add @templatical/quality
```

## First lint call

```ts
import { lintAccessibility } from "@templatical/quality";
import { createDefaultTemplateContent, createImageBlock } from "@templatical/types";

const content = createDefaultTemplateContent();
content.blocks = [
  createImageBlock({ src: "https://example.com/hero.png", alt: "" }),
];

const issues = lintAccessibility(content);
console.log(issues);
// [
//   {
//     blockId: "…",
//     ruleId: "img-missing-alt",
//     severity: "error",
//     message: "Image is missing alt text. Add a short description, …",
//   },
//   { blockId: null, ruleId: "missing-preheader", severity: "info", … }
// ]
```

`lintAccessibility(content, options?)` is synchronous and pure — no DOM, no network, no fetch. The same call works in Node.js, Cloudflare Workers, the browser, and inside the editor.

## Wire into the editor

The editor reads `accessibility` from `init()` / `initCloud()`:

```ts
import { init } from "@templatical/editor";

const editor = init({
  container: "#editor",
  locale: "en",
  accessibility: {
    rules: {
      "img-missing-alt": "warning", // soften from default 'error'
      "text-all-caps": "off", // turn off entirely
    },
    thresholds: {
      minFontSize: 16,
    },
  },
});
```

The sidebar tab and inline canvas badges appear automatically once the optional peer is resolved. When `accessibility.disabled === true`, the editor never lazy-loads the package — no chunk download, no UI surface.

## What's next

- Browse the [rule catalog](./rule-catalog) to see every check.
- Read [severity & fixes](./severity-and-fixes) to learn how auto-fix patches land in the editor.
- See [headless usage](./headless-usage) for CI / pre-send validation patterns.
