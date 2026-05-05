# Options

The full `A11yOptions` shape, every field optional:

```ts
interface A11yOptions {
  disabled?: boolean;
  locale?: string;
  rules?: Record<string, Severity>;
  thresholds?: Partial<A11yThresholds>;
}

type Severity = "error" | "warning" | "info" | "off";
```

## `disabled`

| Default | `false` |
|---|---|

When `true`:

- The editor **does not lazy-import** `@templatical/quality` — its chunk never downloads.
- The accessibility sidebar tab is **not registered**.
- The inline canvas badges produce **no DOM**.

Use this when a tenant has explicitly opted out, or to keep the default OSS bundle minimal. There's no soft-disable — `disabled: true` is a complete, irreversible-per-instance shut-off.

## `locale`

| Default (headless) | `'en'` |
|---|---|
| Editor | always matches `init({ locale })` |

Drives the message templates the linter returns (`messages/{locale}.ts`) and is accepted by the locale-aware rules (`link-vague-text`, `button-vague-label`). Falls back to `en` when the locale (or its base language) isn't bundled.

```ts
// Headless — set explicitly
lintAccessibility(content, { locale: "de" });

// Editor — linter automatically follows the editor locale
init({ locale: "de" });
```

::: warning Editor mode ignores `accessibility.locale`
In editor mode the linter locale is **forced** to the editor's `locale` from `init({ locale })`. Setting `accessibility.locale` has no effect — it's overwritten on the way through.

Headless callers (`lintAccessibility(...)` directly) keep full control.
:::

::: tip Vague-text dictionaries are cross-locale
The dictionary is a union of every registered locale, so a German-locale email with an English `Click here` button still flags `link-vague-text` / `button-vague-label`. The `locale` option doesn't gate matching — it only drives message text.
:::

## `rules`

| Default | `{}` |
|---|---|

Per-rule severity override. Set a rule to `'off'` to disable it entirely. Set to a different severity to bend the default classification:

```ts
{
  "img-missing-alt": "warning",   // soften
  "text-all-caps": "off",          // disable
  "missing-preheader": "warning",  // promote from info → warning
}
```

The override applies before the rule runs, so disabled rules don't even execute. See the [rule catalog](./rule-catalog) for default severities.

## `thresholds`

| Default | See below |
|---|---|

Numeric knobs that some rules consult:

| Threshold | Default | Used by |
|---|---|---|
| `altMaxLength` | `125` | `img-alt-too-long` |
| `minFontSize` | `14` | `text-too-small` |
| `allCapsMinLength` | `20` | `text-all-caps` |
| `minTouchTargetPx` | `44` | `button-touch-target` |

Override one without losing the others — partial merging is built in:

```ts
lintAccessibility(content, {
  thresholds: { minFontSize: 16 },
});
```
