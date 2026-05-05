# Optionen

Die vollständige `A11yOptions`-Form, alle Felder optional:

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

| Standard | `false` |
|---|---|

Bei `true`:

- Der Editor **importiert `@templatical/quality` nicht per Lazy-Load** – sein Chunk wird nie geladen.
- Der Sidebar-Tab für Barrierefreiheit wird **nicht registriert**.
- Die Inline-Canvas-Badges erzeugen **kein DOM**.

Verwenden Sie das, wenn ein Mandant sich explizit ausklingt oder wenn Sie das OSS-Default-Bundle minimal halten wollen. Es gibt kein Soft-Disable – `disabled: true` ist eine vollständige, pro Instanz unumkehrbare Abschaltung.

## `locale`

| Standard (Headless) | `'en'` |
|---|---|
| Editor | folgt stets `init({ locale })` |

Steuert die Meldungstexte, die der Linter zurückgibt (`messages/{locale}.ts`), und wird von den lokalisierungsabhängigen Regeln verwendet (`link-vague-text`, `button-vague-label`). Fällt auf `en` zurück, wenn die Locale (oder ihre Basissprache) nicht mitgeliefert wird.

```ts
// Headless – explizit setzen
lintAccessibility(content, { locale: "de" });

// Editor – Linter folgt automatisch der Editor-Locale
init({ locale: "de" });
```

::: warning Editor-Modus ignoriert `accessibility.locale`
Im Editor-Modus wird die Linter-Locale auf das `locale` aus `init({ locale })` **erzwungen**. `accessibility.locale` zu setzen hat keine Wirkung – es wird auf dem Weg überschrieben.

Headless-Aufrufer (`lintAccessibility(...)` direkt) behalten die volle Kontrolle.
:::

::: tip Vague-Text-Wörterbücher sind sprachenübergreifend
Das Wörterbuch ist eine Vereinigung aller registrierten Locales – ein deutschsprachiges E-Mail-Template mit einem englischen `Click here`-Button löst also weiterhin `link-vague-text` / `button-vague-label` aus. Die `locale`-Option steuert das Matching nicht; sie steuert nur den Meldungstext.
:::

## `rules`

| Standard | `{}` |
|---|---|

Pro-Regel-Schweregrad-Override. Setzen Sie eine Regel auf `'off'`, um sie ganz zu deaktivieren. Setzen Sie sie auf einen anderen Schweregrad, um die Standard-Klassifikation zu beugen:

```ts
{
  "img-missing-alt": "warning",   // abschwächen
  "text-all-caps": "off",          // deaktivieren
  "missing-preheader": "warning",  // von info → warning hochstufen
}
```

Das Override greift, bevor die Regel läuft – deaktivierte Regeln werden also nicht einmal ausgeführt. Standard-Schweregrade siehe [Regelkatalog](./rule-catalog).

## `thresholds`

| Standard | siehe unten |
|---|---|

Numerische Stellschrauben, die einige Regeln konsultieren:

| Schwellwert | Standard | Verwendet von |
|---|---|---|
| `altMaxLength` | `125` | `img-alt-too-long` |
| `minFontSize` | `14` | `text-too-small` |
| `allCapsMinLength` | `20` | `text-all-caps` |
| `minTouchTargetPx` | `44` | `button-touch-target` |

Einen Wert überschreiben, ohne die anderen zu verlieren – partielles Mergen ist eingebaut:

```ts
lintAccessibility(content, {
  thresholds: { minFontSize: 16 },
});
```
