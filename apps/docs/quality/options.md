---
description: Reference for LintOptions — disabled, locale, contentLocale, accessibility, structure, links, deliverability, compatibility, and localization fields accepted by lintTemplate and editor lint config.
---

# Options

`lintTemplate`, `lintAccessibility`, `lintStructure`, `lintLinks`, `lintDeliverability`, `lintCompatibility`, and `lintLocalization` all accept the same `LintOptions` shape. Every field is optional.

```ts
interface LintOptions {
  disabled?: boolean;
  locale?: string;
  contentLocale?: string;
  customBlocks?: CustomBlockDefinition[];
  mergeTagSyntax?: SyntaxPresetName | SyntaxPreset;
  accessibility?: false | AccessibilityLintOptions;
  structure?: false | StructureLintOptions;
  links?: false | LinksLintOptions;
  deliverability?: false | DeliverabilityLintOptions;
  compatibility?: false | CompatibilityLintOptions;
  localization?: false | LocalizationLintOptions;
}

interface LocalizationLintOptions {
  rules?: RuleOverrides;
}

interface AccessibilityLintOptions {
  rules?: Record<string, Severity>;
  thresholds?: Partial<LintThresholds>;
}

interface StructureLintOptions {
  rules?: Record<string, Severity>;
}

interface LinksLintOptions {
  rules?: Record<string, Severity>;
  nonProductionHosts?: string[];
}

interface CompatibilityLintOptions {
  rules?: RuleOverrides;
  thresholds?: Partial<CompatibilityThresholds>;
}

interface CompatibilityThresholds {
  maxHtmlBytes: number;
}

interface DeliverabilityThresholds {
  minTextLength: number;
}

interface DeliverabilityLintOptions {
  rules?: RuleOverrides;
  thresholds?: Partial<DeliverabilityThresholds>;
  shortenerHosts?: string[];
}

type Severity = "error" | "warning" | "info" | "off";
type RuleOverrides = Record<string, Severity>;
```

The same object also gates the editor's `init({ lint })` config — every option here applies to every linter via the shared `useTemplateLint` composable.

Severity overrides and tool-specific knobs (`thresholds`, `nonProductionHosts`, `shortenerHosts`) are namespaced under their owning linter, so each linter only sees the config that's relevant to it.

## `disabled`

| Default | `false` |
|---|---|

When `true`:

- The editor **does not lazy-import** `@templatical/quality` — its chunk never downloads.
- The Issues sidebar tab is **not registered**.
- The inline canvas badges produce **no DOM**.

Use this when a tenant has explicitly opted out, or to keep the default editor bundle minimal. There's no soft-disable — `disabled: true` is a complete, irreversible-per-instance shut-off.

::: tip Disabling every linter individually has the same effect
The editor treats `{ accessibility: false, structure: false, links: false, deliverability: false, compatibility: false, localization: false }` as equivalent to `{ disabled: true }`: no chunk download, no sidebar tab, no canvas badges. So you don't need the global flag if every linter is already off.
:::

## `locale`

| Default (headless) | `'en'` |
|---|---|
| Editor | always matches `init({ locale })` |

Drives the message templates the linter returns (one file per locale per linter) and is accepted by the locale-aware accessibility rules (`a11y.link-vague-text`, `a11y.button-vague-label`, `a11y.img-linked-no-context`). Falls back to `en` when the locale (or its base language) isn't bundled.

```ts
// Headless — set explicitly
lintAccessibility(content, { locale: "de" });
lintStructure(content, { locale: "de" });
lintLinks(content, { locale: "de" });
lintDeliverability(content, { locale: "de" });
lintCompatibility(content, { locale: "de" });
lintLocalization(content, { contentLocale: "de", locale: "de" });

// Editor — linter automatically follows the editor locale
init({ locale: "de" });
```

::: warning Editor mode ignores `lint.locale`
In editor mode the linter locale is **forced** to the editor's `locale` from `init({ locale })`. Setting `lint.locale` has no effect — it's overwritten on the way through.

Headless callers (`lintTemplate(...)` or `lintAccessibility(...)` / `lintStructure(...)` / `lintLinks(...)` / `lintDeliverability(...)` / `lintCompatibility(...)` / `lintLocalization(...)` directly) keep full control.
:::

::: tip Vague-text dictionaries are cross-locale
The dictionary is a union of every registered locale, so a German-locale email with an English `Click here` button still flags `a11y.link-vague-text` / `a11y.button-vague-label`, and a German `Jetzt kaufen` alt on an English-locale linked image still satisfies `a11y.img-linked-no-context`'s action-hint check. The `locale` option doesn't gate matching — it only drives message text.
:::

## `contentLocale`

Selects the template language version linted by `lintTemplate`, defaulting to `content.settings.locale`. `locale` still selects message language. In the editor, `contentLocale` follows the active template language and `locale` follows the UI. Vague-text dictionaries remain a union across languages; `contentLocale` does not change them. An unknown content locale throws `SdkError` with code `unknown_locale`.

`customBlocks?: CustomBlockDefinition[]` identifies custom `text` and `textarea` fields for localization checks (omitted: no custom text discovery). `mergeTagSyntax?: SyntaxPresetName | SyntaxPreset` selects merge-tag syntax for those checks; it defaults to Liquid.

## `localization`

Enabled by default for non-default versions. Set `localization: false` to suppress these checks, or use `localization.rules` with full rule ids to override severity (`"error"`, `"warning"`, `"info"`, `"off"`). `lintLocalization(content, options?)` and `LOCALIZATION_RULES` are exported for targeted checks; prefer `lintTemplate` to lint the projection and all categories.

| Rule | Default | Meaning |
| --- | --- | --- |
| `localization.untranslated` | `warning` | A nonempty default text field has no translation |
| `localization.stale` | `warning` | A translated field's source hash no longer matches the default |
| `localization.merge-tags-differ` | `warning` | The translated text's merge-tag multiset differs from the default |

Hidden blocks and their descendants are excluded. The default language produces no localization findings. See [Missing values](/guide/localized-templates#missing-values), [Out-of-date values](/guide/localized-templates#out-of-date-values) and [Merge tags](/guide/localized-templates#merge-tags). The CLI's `validate --locale` treats a merge-tag mismatch as blocking even at warning severity.

## `accessibility`

| Default | `{}` (linter enabled, defaults for every knob) |
|---|---|

Configuration for `lintAccessibility`. Set to `false` to disable the entire accessibility linter without enumerating its rules.

```ts
// Turn off the whole accessibility linter
lintAccessibility(content, { accessibility: false });
```

### `accessibility.rules`

| Default | `{}` |
|---|---|

Per-rule severity override for accessibility rules. Set a rule to `'off'` to disable it entirely. Set to a different severity to bend the default classification:

```ts
lintAccessibility(content, {
  accessibility: {
    rules: {
      "a11y.img-missing-alt": "warning",   // soften
      "a11y.text-all-caps": "off",         // disable
      "a11y.missing-preheader": "warning", // promote info → warning
    },
  },
});
```

Override keys use the full prefixed rule ID (`a11y.*`) — the same ID that appears on `LintIssue.ruleId`, so a value copied from an emitted issue pastes straight in. See the [accessibility rule catalog](./accessibility/rule-catalog) for default severities.

### `accessibility.thresholds`

| Default | See below |
|---|---|

Numeric knobs that some accessibility rules consult.

| Threshold | Default | Used by |
|---|---|---|
| `altMaxLength` | `125` | `a11y.img-alt-too-long` |
| `minFontSize` | `14` | `a11y.text-too-small` |
| `allCapsMinLength` | `20` | `a11y.text-all-caps` |
| `minTouchTargetPx` | `44` | `a11y.button-touch-target` |

Override one without losing the others — partial merging is built in:

```ts
lintAccessibility(content, {
  accessibility: { thresholds: { minFontSize: 16 } },
});
```

The `DEFAULT_A11Y_THRESHOLDS` constant is also exported if you need to reference the baseline programmatically.

## `structure`

| Default | `{}` |
|---|---|

Configuration for `lintStructure`. Set to `false` to disable the entire structure linter.

```ts
lintStructure(content, { structure: false });
```

### `structure.rules`

Per-rule severity override for structure rules:

```ts
lintStructure(content, {
  structure: {
    rules: {
      "structure.empty-column": "info",    // demote warning → info
    },
  },
});
```

Keys use the `structure.*` prefix. See the [structure rule catalog](./structure/rule-catalog) for default severities.

## `links`

| Default | `{}` |
|---|---|

Configuration for `lintLinks`. Set to `false` to disable the entire links linter.

```ts
lintLinks(content, { links: false });
```

### `links.rules`

Per-rule severity override for link rules:

```ts
lintLinks(content, {
  links: {
    rules: {
      "link.localhost-or-staging": "error", // promote to error before send
    },
  },
});
```

Keys use the `link.*` prefix. See the [links rule catalog](./links/rule-catalog) for default severities.

### `links.nonProductionHosts`

| Default | `['localhost', '127.0.0.1', '0.0.0.0', '*.local', '*.staging.*', '*.dev.*']` |
|---|---|

Glob-style patterns matched against the URL host. `*` matches any run of characters (including `.`) — so `*.staging.*` matches `app.staging.example.com` and `*.local` matches `acme.local` or `a.b.c.local`. Patterns are anchored, so `*.local` does NOT match `acme.local-tools`. Case-insensitive.

```ts
lintLinks(content, {
  links: { nonProductionHosts: ["*.preview.*"] },
});

// Or silence the rule without disabling it:
lintLinks(content, { links: { nonProductionHosts: [] } });
```

`DEFAULT_NON_PRODUCTION_HOSTS` is exported as the baseline. See the [links overview](./links/) for more.

## `deliverability`

| Default | `{}` |
|---|---|

Configuration for `lintDeliverability`. Set `deliverability: false` to disable this category.

```ts
lintDeliverability(content, { deliverability: false, compatibility: false });
```

### `deliverability.rules`

Keys are full `deliverability.*` rule IDs. `"off"` disables one rule; other severities override its default. See the [deliverability rule catalog](./deliverability/rule-catalog).

```ts
lintDeliverability(content, {
  deliverability: { rules: { "deliverability.low-text": "off" } },
});
```

### `deliverability.thresholds.minTextLength`

Default `200` visible characters. `deliverability.low-text` fires below this threshold when an image-producing block exists. A partial override preserves other defaults:

```ts
lintDeliverability(content, {
  deliverability: { thresholds: { minTextLength: 250 } },
});
```

`DEFAULT_DELIVERABILITY_THRESHOLDS` exports the baseline.

### `deliverability.shortenerHosts`

Replaces `DEFAULT_SHORTENER_HOSTS`. Spread the default to extend it:

```ts
import { DEFAULT_SHORTENER_HOSTS, lintDeliverability } from "@templatical/quality";

const issues = lintDeliverability(content, {
  deliverability: { shortenerHosts: [...DEFAULT_SHORTENER_HOSTS, "go.example.com"] },
});
```

## `compatibility`

Enabled by default. Set `compatibility: false` to disable client compatibility checks. Full `compat.*` rule IDs in `compatibility.rules` accept severity overrides, including `"off"`. `compatibility.thresholds.maxHtmlBytes` defaults to `92_160` bytes (90 KiB) for `lintCompiledHtml`; it does not affect pass-through scanning. See the [compatibility catalog](./compatibility/rule-catalog).
