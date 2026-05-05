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
- The cloud save-gate is **bypassed** regardless of `planConfig.accessibility.blockOnError`.

Use this when a tenant has explicitly opted out, or to keep the default OSS bundle minimal. There's no soft-disable — `disabled: true` is a complete, irreversible-per-instance shut-off.

## `locale`

| Default | `'en'` |
|---|---|

Selects the dictionary used by `link-vague-text` and `button-vague-label`. Falls back to `en` when the locale (or its base language) isn't bundled. The locale also feeds the rule message formatting.

```ts
lintAccessibility(content, { locale: "de" });
// "hier klicken" now matches as a vague link phrase.
```

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

## Cloud merge order

`initCloud()` additionally merges `planConfig.accessibility` from the server. Server-side policy **wins on conflict** so an enterprise plan can lock specific rules to `error` regardless of the consumer config.

```
defaults  →  consumer-supplied  →  server policy
```

The `blockOnError` field on the cloud's `PlanConfig.accessibility` is server-only — there's no consumer-side equivalent.
