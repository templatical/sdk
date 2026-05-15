# Options

`lintAccessibility` and `lintStructure` accept the same `LintOptions` shape. Every field is optional.

```ts
interface LintOptions {
  disabled?: boolean;
  locale?: string;
  rules?: Record<string, Severity>;
  thresholds?: Partial<LintThresholds>;
}

type Severity = "error" | "warning" | "info" | "off";
```

The same object also gates the editor's `init({ lint })` config — every option here applies to both linters via the shared `useTemplateLint` composable.

## `disabled`

| Default | `false` |
|---|---|

When `true`:

- The editor **does not lazy-import** `@templatical/quality` — its chunk never downloads.
- The Issues sidebar tab is **not registered**.
- The inline canvas badges produce **no DOM**.

Use this when a tenant has explicitly opted out, or to keep the default OSS bundle minimal. There's no soft-disable — `disabled: true` is a complete, irreversible-per-instance shut-off.

## `locale`

| Default (headless) | `'en'` |
|---|---|
| Editor | always matches `init({ locale })` |

Drives the message templates the linter returns (one file per locale per linter) and is accepted by the locale-aware accessibility rules (`a11y.link-vague-text`, `a11y.button-vague-label`, `a11y.img-linked-no-context`). Falls back to `en` when the locale (or its base language) isn't bundled.

```ts
// Headless — set explicitly
lintAccessibility(content, { locale: "de" });
lintStructure(content, { locale: "de" });

// Editor — linter automatically follows the editor locale
init({ locale: "de" });
```

::: warning Editor mode ignores `lint.locale`
In editor mode the linter locale is **forced** to the editor's `locale` from `init({ locale })`. Setting `lint.locale` has no effect — it's overwritten on the way through.

Headless callers (`lintAccessibility(...)` / `lintStructure(...)` directly) keep full control.
:::

::: tip Vague-text dictionaries are cross-locale
The dictionary is a union of every registered locale, so a German-locale email with an English `Click here` button still flags `a11y.link-vague-text` / `a11y.button-vague-label`, and a German `Jetzt kaufen` alt on an English-locale linked image still satisfies `a11y.img-linked-no-context`'s action-hint check. The `locale` option doesn't gate matching — it only drives message text.
:::

## `rules`

| Default | `{}` |
|---|---|

Per-rule severity override. Set a rule to `'off'` to disable it entirely. Set to a different severity to bend the default classification:

```ts
{
  "a11y.img-missing-alt": "warning",   // soften
  "a11y.text-all-caps": "off",         // disable
  "a11y.missing-preheader": "warning", // promote info → warning
  "structure.empty-column": "info",    // demote warning → info
}
```

Rule IDs are namespaced by linter: `a11y.*` for accessibility rules, `structure.*` for structure rules. Override keys must use the full prefixed ID.

The override applies before the rule runs, so disabled rules don't even execute. See each linter's rule catalog for default severities: [accessibility](./accessibility/rule-catalog) · [structure](./structure/rule-catalog).

## `thresholds`

| Default | See below |
|---|---|

Numeric knobs that some accessibility rules consult. (Structure rules don't currently use thresholds.)

| Threshold | Default | Used by |
|---|---|---|
| `altMaxLength` | `125` | `a11y.img-alt-too-long` |
| `minFontSize` | `14` | `a11y.text-too-small` |
| `allCapsMinLength` | `20` | `a11y.text-all-caps` |
| `minTouchTargetPx` | `44` | `a11y.button-touch-target` |

Override one without losing the others — partial merging is built in:

```ts
lintAccessibility(content, {
  thresholds: { minFontSize: 16 },
});
```

The `DEFAULT_A11Y_THRESHOLDS` constant is also exported if you need to reference the baseline programmatically.
