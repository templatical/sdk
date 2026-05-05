# Erste Schritte

## Installation

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

## In den Editor einbinden

Übergeben Sie `accessibility` an `init()` oder `initCloud()`:

```ts
import { init } from "@templatical/editor";

const editor = init({
  container: "#editor",
  locale: "de",
  accessibility: {
    rules: {
      "img-missing-alt": "warning", // Standard 'error' abschwächen
      "text-all-caps": "off", // komplett deaktivieren
    },
    thresholds: {
      minFontSize: 16,
    },
  },
});
```

Der Sidebar-Tab und die Inline-Canvas-Badges erscheinen automatisch, sobald der optionale Peer aufgelöst wird. Bei `accessibility.disabled === true` lädt der Editor das Paket nie per Lazy-Load – kein Chunk-Download, keine UI.

## Wie geht's weiter?

- Im [Regelkatalog](./rule-catalog) jede Prüfung nachschlagen.
- Schweregrade, Schwellwerte und das `disabled`-Flag in den [Optionen](./options) anpassen.
- In [Schweregrad & Korrekturen](./severity-and-fixes) lesen, wie Auto-Fix-Patches im Editor angewendet werden.
- Außerhalb des Editors linten? Siehe [Headless-Nutzung](./headless-usage) für CI-Validierung.
