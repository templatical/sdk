# Optionen

`lintAccessibility` und `lintStructure` akzeptieren dieselbe `LintOptions`-Struktur. Jedes Feld ist optional.

```ts
interface LintOptions {
  disabled?: boolean;
  locale?: string;
  rules?: Record<string, Severity>;
  thresholds?: Partial<LintThresholds>;
}

type Severity = "error" | "warning" | "info" | "off";
```

Dasselbe Objekt steuert auch die `init({ lint })`-Konfiguration des Editors — jede Option hier wirkt sich über das geteilte `useTemplateLint`-Composable auf beide Linter aus.

## `disabled`

| Standard | `false` |
|---|---|

Bei `true`:

- Der Editor **lädt `@templatical/quality` nicht nach** — sein Chunk wird nie geladen.
- Der Issues-Sidebar-Tab wird **nicht registriert**.
- Die Canvas-Badges erzeugen **kein DOM**.

Sinnvoll, wenn ein Mandant ausdrücklich verzichtet hat oder das Standard-OSS-Bundle möglichst klein bleiben soll. Es gibt kein Soft-Disable — `disabled: true` ist eine vollständige, pro Instanz nicht rückgängig zu machende Abschaltung.

## `locale`

| Standard (headless) | `'en'` |
|---|---|
| Editor | folgt immer `init({ locale })` |

Steuert die Nachrichtentemplates des Linters (eine Datei pro Locale pro Linter) und wird von den lokal-aware Barrierefreiheits-Regeln genutzt (`a11y.link-vague-text`, `a11y.button-vague-label`, `a11y.img-linked-no-context`). Fällt auf `en` zurück, wenn die Locale (oder ihre Basissprache) nicht gebündelt ist.

```ts
// Headless — explizit setzen
lintAccessibility(content, { locale: "de" });
lintStructure(content, { locale: "de" });

// Editor — Linter folgt automatisch der Editor-Locale
init({ locale: "de" });
```

::: warning Im Editor-Modus wird `lint.locale` ignoriert
Im Editor-Modus wird die Linter-Locale **erzwungen** auf den `locale`-Wert aus `init({ locale })`. `lint.locale` zu setzen, hat keinen Effekt — es wird auf dem Weg überschrieben.

Headless-Aufrufer (`lintAccessibility(...)` / `lintStructure(...)` direkt) behalten volle Kontrolle.
:::

::: tip Vague-Text-Dictionaries sind sprachübergreifend
Das Dictionary ist eine Vereinigung aller registrierten Locales — eine deutschsprachige E-Mail mit englischem `Click here`-Button schlägt `a11y.link-vague-text` / `a11y.button-vague-label` trotzdem aus, und ein deutsches `Jetzt kaufen`-Alt auf einem verlinkten Bild in englischer Locale erfüllt den Action-Hint-Check von `a11y.img-linked-no-context`. Die `locale`-Option gated das Matching nicht — sie steuert nur den Nachrichtentext.
:::

## `rules`

| Standard | `{}` |
|---|---|

Schweregrad-Override pro Regel. Setze eine Regel auf `'off'`, um sie komplett zu deaktivieren. Setze sie auf einen anderen Schweregrad, um die Standardklassifikation zu verbiegen:

```ts
{
  "a11y.img-missing-alt": "warning",   // herabstufen
  "a11y.text-all-caps": "off",         // deaktivieren
  "a11y.missing-preheader": "warning", // info → warning hochstufen
  "structure.empty-column": "info",    // warning → info herabstufen
}
```

Regel-IDs sind nach Linter namensraum-getrennt: `a11y.*` für Barrierefreiheit, `structure.*` für Struktur. Override-Schlüssel müssen die volle, mit Präfix versehene ID verwenden.

Der Override greift, bevor die Regel läuft — deaktivierte Regeln werden also gar nicht erst ausgeführt. Standardschweregrade pro Regel: [Barrierefreiheit](./accessibility/rule-catalog) · [Struktur](./structure/rule-catalog).

## `thresholds`

| Standard | Siehe unten |
|---|---|

Numerische Stellschrauben, die einige Barrierefreiheits-Regeln konsultieren. (Struktur-Regeln nutzen aktuell keine Thresholds.)

| Threshold | Standard | Verwendet von |
|---|---|---|
| `altMaxLength` | `125` | `a11y.img-alt-too-long` |
| `minFontSize` | `14` | `a11y.text-too-small` |
| `allCapsMinLength` | `20` | `a11y.text-all-caps` |
| `minTouchTargetPx` | `44` | `a11y.button-touch-target` |

Einen Wert überschreiben, ohne die anderen zu verlieren — partielles Merging ist eingebaut:

```ts
lintAccessibility(content, {
  thresholds: { minFontSize: 16 },
});
```

Die Konstante `DEFAULT_A11Y_THRESHOLDS` wird ebenfalls exportiert, falls du die Baseline programmatisch referenzieren willst.
