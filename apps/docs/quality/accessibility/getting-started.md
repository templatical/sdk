# Getting started

## Install

::: code-group
```bash [npm]
npm install @templatical/quality
```
```bash [pnpm]
pnpm add @templatical/quality
```
```bash [yarn]
yarn add @templatical/quality
```
```bash [bun]
bun add @templatical/quality
```
:::

## Wire into the editor

Pass `accessibility` to `init()` or `initCloud()`:

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
- Tune severity, thresholds, and the `disabled` flag in [options](./options).
- Read [severity & fixes](./severity-and-fixes) to learn how auto-fix patches land in the editor.
- Need to lint outside the editor? See [headless usage](./headless-usage) for CI validation.
