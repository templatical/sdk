# Optionen

`lintTemplate`, `lintAccessibility`, `lintStructure` und `lintLinks` akzeptieren alle dieselbe `LintOptions`-Struktur. Jedes Feld ist optional.

```ts
interface LintOptions {
  disabled?: boolean;
  locale?: string;
  accessibility?: false | AccessibilityLintOptions;
  structure?: false | StructureLintOptions;
  links?: false | LinksLintOptions;
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

type Severity = "error" | "warning" | "info" | "off";
```

Dasselbe Objekt steuert auch die `init({ lint })`-Konfiguration des Editors — jede Option hier wirkt sich über das geteilte `useTemplateLint`-Composable auf jeden Linter aus.

Schweregrad-Overrides und tool-spezifische Stellschrauben (`thresholds`, `nonProductionHosts`) sind unter ihrem jeweiligen Linter namensraum-getrennt, sodass jeder Linter nur die für ihn relevante Konfiguration sieht.

## `disabled`

| Standard | `false` |
|---|---|

Bei `true`:

- Der Editor **lädt `@templatical/quality` nicht nach** — sein Chunk wird nie geladen.
- Der Issues-Sidebar-Tab wird **nicht registriert**.
- Die Canvas-Badges erzeugen **kein DOM**.

Sinnvoll, wenn ein Mandant ausdrücklich verzichtet hat oder das Standard-OSS-Bundle möglichst klein bleiben soll. Es gibt kein Soft-Disable — `disabled: true` ist eine vollständige, pro Instanz nicht rückgängig zu machende Abschaltung.

::: tip Jeden Linter einzeln zu deaktivieren hat denselben Effekt
Der Editor behandelt `{ accessibility: false, structure: false, links: false }` wie `{ disabled: true }`: kein Chunk-Download, kein Sidebar-Tab, keine Canvas-Badges. Wenn jeder Linter bereits aus ist, brauchen Sie das globale Flag nicht zusätzlich.
:::

## `locale`

| Standard (headless) | `'en'` |
|---|---|
| Editor | folgt immer `init({ locale })` |

Steuert die Nachrichtentemplates des Linters (eine Datei pro Locale pro Linter) und wird von den lokal-aware Barrierefreiheits-Regeln genutzt (`a11y.link-vague-text`, `a11y.button-vague-label`, `a11y.img-linked-no-context`). Fällt auf `en` zurück, wenn die Locale (oder ihre Basissprache) nicht gebündelt ist.

```ts
// Headless — explizit setzen
lintAccessibility(content, { locale: "de" });
lintStructure(content, { locale: "de" });
lintLinks(content, { locale: "de" });

// Editor — Linter folgt automatisch der Editor-Locale
init({ locale: "de" });
```

::: warning Im Editor-Modus wird `lint.locale` ignoriert
Im Editor-Modus wird die Linter-Locale **erzwungen** auf den `locale`-Wert aus `init({ locale })`. `lint.locale` zu setzen, hat keinen Effekt — es wird auf dem Weg überschrieben.

Headless-Aufrufer (`lintTemplate(...)` oder `lintAccessibility(...)` / `lintStructure(...)` / `lintLinks(...)` direkt) behalten volle Kontrolle.
:::

::: tip Vague-Text-Dictionaries sind sprachübergreifend
Das Dictionary ist eine Vereinigung aller registrierten Locales — eine deutschsprachige E-Mail mit englischem `Click here`-Button schlägt `a11y.link-vague-text` / `a11y.button-vague-label` trotzdem aus, und ein deutsches `Jetzt kaufen`-Alt auf einem verlinkten Bild in englischer Locale erfüllt den Action-Hint-Check von `a11y.img-linked-no-context`. Die `locale`-Option gated das Matching nicht — sie steuert nur den Nachrichtentext.
:::

## `accessibility`

| Standard | `{}` (Linter aktiv, Defaults für jede Stellschraube) |
|---|---|

Konfiguration für `lintAccessibility`. Setzen Sie auf `false`, um den gesamten Barrierefreiheits-Linter zu deaktivieren, ohne Regeln einzeln aufzählen zu müssen.

```ts
// Gesamten Barrierefreiheits-Linter abschalten
lintAccessibility(content, { accessibility: false });
```

### `accessibility.rules`

| Standard | `{}` |
|---|---|

Schweregrad-Override pro Regel für Barrierefreiheits-Regeln. Setzen Sie eine Regel auf `'off'`, um sie komplett zu deaktivieren. Setzen Sie sie auf einen anderen Schweregrad, um die Standardklassifikation zu verbiegen:

```ts
lintAccessibility(content, {
  accessibility: {
    rules: {
      "a11y.img-missing-alt": "warning",   // herabstufen
      "a11y.text-all-caps": "off",         // deaktivieren
      "a11y.missing-preheader": "warning", // info → warning hochstufen
    },
  },
});
```

Override-Schlüssel verwenden die volle, mit Präfix versehene Regel-ID (`a11y.*`) — dieselbe ID, die auf `LintIssue.ruleId` erscheint. Werte aus einem ausgegebenen Issue lassen sich direkt einsetzen. Standardschweregrade pro Regel: [Barrierefreiheit-Katalog](./accessibility/rule-catalog).

### `accessibility.thresholds`

| Standard | Siehe unten |
|---|---|

Numerische Stellschrauben, die einige Barrierefreiheits-Regeln konsultieren.

| Threshold | Standard | Verwendet von |
|---|---|---|
| `altMaxLength` | `125` | `a11y.img-alt-too-long` |
| `minFontSize` | `14` | `a11y.text-too-small` |
| `allCapsMinLength` | `20` | `a11y.text-all-caps` |
| `minTouchTargetPx` | `44` | `a11y.button-touch-target` |

Einen Wert überschreiben, ohne die anderen zu verlieren — partielles Merging ist eingebaut:

```ts
lintAccessibility(content, {
  accessibility: { thresholds: { minFontSize: 16 } },
});
```

Die Konstante `DEFAULT_A11Y_THRESHOLDS` wird ebenfalls exportiert, falls Sie die Baseline programmatisch referenzieren wollen.

## `structure`

| Standard | `{}` |
|---|---|

Konfiguration für `lintStructure`. Setzen Sie auf `false`, um den gesamten Struktur-Linter zu deaktivieren.

```ts
lintStructure(content, { structure: false });
```

### `structure.rules`

Schweregrad-Override pro Regel für Struktur-Regeln:

```ts
lintStructure(content, {
  structure: {
    rules: { "structure.empty-column": "info" }, // warning → info
  },
});
```

Schlüssel verwenden das `structure.*`-Präfix. Siehe [Struktur-Regelkatalog](./structure/rule-catalog).

## `links`

| Standard | `{}` |
|---|---|

Konfiguration für `lintLinks`. Setzen Sie auf `false`, um den gesamten Links-Linter zu deaktivieren.

```ts
lintLinks(content, { links: false });
```

### `links.rules`

Schweregrad-Override pro Regel für Link-Regeln:

```ts
lintLinks(content, {
  links: {
    rules: { "link.localhost-or-staging": "error" }, // vor Versand hochstufen
  },
});
```

Schlüssel verwenden das `link.*`-Präfix. Siehe [Link-Regelkatalog](./links/rule-catalog).

### `links.nonProductionHosts`

| Standard | `['localhost', '127.0.0.1', '0.0.0.0', '*.local', '*.staging.*', '*.dev.*']` |
|---|---|

Glob-Muster, die gegen den URL-Host abgeglichen werden. `*` matcht eine beliebige Zeichenfolge (auch über `.` hinweg) — `*.staging.*` matcht also `app.staging.example.com` und `*.local` matcht `acme.local` oder `a.b.c.local`. Muster sind verankert; `*.local` matcht damit NICHT `acme.local-tools`. Groß-/Kleinschreibung wird ignoriert.

```ts
lintLinks(content, {
  links: { nonProductionHosts: ["*.preview.*"] },
});

// Oder die Regel still schalten, ohne sie zu deaktivieren:
lintLinks(content, { links: { nonProductionHosts: [] } });
```

`DEFAULT_NON_PRODUCTION_HOSTS` wird als Baseline exportiert. Mehr in der [Links-Übersicht](./links/).
