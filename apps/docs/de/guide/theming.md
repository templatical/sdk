---
title: Theming
description: Passen Sie das Erscheinungsbild des Editors mit CSS-Variablen, Theme-Überschreibungen, Dark Mode und benutzerdefinierten Schriftarten an.
---

# Theming

Templatical wird mit einem ausgefeilten Standard-Theme ausgeliefert. Es gibt zwei Wege, jede Farbe, jeden Radius, Schatten oder jede Schriftart zu überschreiben:

1. **CSS-Variablen auf dem Container** (`--tpl-user-*`) — der empfohlene Ansatz. Funktioniert sowohl im Shadow-DOM (Standard) als auch im Light-DOM-Modus. Reines CSS — kein JS-Umweg.
2. **`ThemeOverrides`-Konfiguration** (JSON) — Farben zur `init()`-Zeit übergeben. Nützlich, wenn Farben aus Laufzeitdaten kommen (Nutzerpräferenz, Multi-Tenant-Branding).

Beide Ansätze lassen sich kombinieren — die `ThemeOverrides`-Konfiguration hat Vorrang, weil sie als Inline-Stile angewendet wird, die klassengebundene Variablen schlagen.

## CSS-Variablen auf dem Container

Setzen Sie `--tpl-user-*`-Variablen auf den Container, den Sie an `init()` übergeben (oder auf einen beliebigen Vorfahren). Sie werden über die [Shadow-Grenze](./shadow-dom) hinweg in das Editor-Root vererbt und überschreiben die eingebauten Standardwerte:

```html
<div
  id="editor"
  style="
    --tpl-user-primary: oklch(65% 0.2 280);
    --tpl-user-primary-hover: oklch(58% 0.2 280);
    --tpl-user-primary-light: oklch(94% 0.05 280);
    --tpl-user-radius: 14px;
  "
></div>
```

Oder in einem Stylesheet:

```css
#editor {
  --tpl-user-primary: oklch(65% 0.2 280);
  --tpl-user-primary-hover: oklch(58% 0.2 280);
  --tpl-user-primary-light: oklch(94% 0.05 280);
  --tpl-user-radius: 14px;
}
```

Die Vererbung benutzerdefinierter CSS-Eigenschaften überquert Shadow Roots, sodass die Variablen, die Sie auf der Host-Seite setzen, den Editor unabhängig vom Mount-Modus erreichen. Sie benötigen keine getrennten Codepfade für `shadowDom: true` vs. `shadowDom: false`.

### Tokens für den Light-Modus

Jedes Token folgt derselben Form: Deklarieren Sie `--tpl-user-<name>` auf dem Container, um den SDK-Standard zu überschreiben.

| Überschreibungsvariable      | Zweck                                      |
| ---------------------------- | ------------------------------------------ |
| `--tpl-user-bg`              | Haupt-Hintergrund                          |
| `--tpl-user-bg-elevated`     | Erhöhte Oberflächen (Panels, Dropdowns)    |
| `--tpl-user-bg-hover`        | Hintergrund im Hover-Zustand               |
| `--tpl-user-bg-active`       | Hintergrund im Aktiv-/Gedrückt-Zustand     |
| `--tpl-user-border`          | Standard-Rahmenfarbe                       |
| `--tpl-user-border-light`    | Dezenter Rahmen (Trenner, Separatoren)     |
| `--tpl-user-text`            | Primärer Text                              |
| `--tpl-user-text-muted`      | Sekundärer Text                            |
| `--tpl-user-text-dim`        | Deaktivierter oder Hinweistext             |
| `--tpl-user-primary`         | Primäre Markenfarbe (Schaltflächen, Links) |
| `--tpl-user-primary-hover`   | Primärer Hover-Zustand                     |
| `--tpl-user-primary-light`   | Primärer getönter Hintergrund              |
| `--tpl-user-secondary`       | Sekundäre Akzentfarbe                      |
| `--tpl-user-secondary-hover` | Sekundärer Hover-Zustand                   |
| `--tpl-user-secondary-light` | Sekundärer getönter Hintergrund            |
| `--tpl-user-success`         | Erfolgszustand-Farbe                       |
| `--tpl-user-success-light`   | Erfolg getönter Hintergrund                |
| `--tpl-user-warning`         | Warn-Farbe                                 |
| `--tpl-user-warning-light`   | Warnung getönter Hintergrund               |
| `--tpl-user-danger`          | Gefahren-/Fehlerfarbe                      |
| `--tpl-user-danger-light`    | Gefahr getönter Hintergrund                |
| `--tpl-user-canvas-bg`       | Canvas-Bereich hinter dem E-Mail-Template  |
| `--tpl-user-radius`          | Standard-Rahmenradius (`10px`)             |
| `--tpl-user-radius-sm`       | Kleiner Rahmenradius (`7px`)               |
| `--tpl-user-radius-lg`       | Großer Rahmenradius (`14px`)               |
| `--tpl-user-font-family`     | UI-Schriftartstack                         |
| `--tpl-user-shadow-sm`       | Dezenter Schatten                          |
| `--tpl-user-shadow`          | Standardschatten                           |
| `--tpl-user-shadow-md`       | Mittlerer Schatten                         |
| `--tpl-user-shadow-lg`       | Großer Schatten                            |
| `--tpl-user-shadow-xl`       | Extra-großer Schatten                      |
| `--tpl-user-overlay`         | Modal-Hintergrund-Overlay                  |
| `--tpl-user-ring`            | Fokus-Ring                                 |
| `--tpl-user-transition`      | Spring-Easing-Übergang                     |

### Tokens für den Dark-Modus

Der Dark-Modus verwendet einen parallelen `--tpl-user-dark-*`-Namensraum, sodass Sie Light und Dark unabhängig voneinander gestalten können:

```css
#editor {
  /* Light-Überschreibungen */
  --tpl-user-primary: oklch(65% 0.2 280);

  /* Dark-Überschreibungen */
  --tpl-user-dark-primary: oklch(75% 0.16 280);
  --tpl-user-dark-bg: oklch(18% 0.005 280);
  --tpl-user-dark-text: oklch(94% 0.005 280);
}
```

Ersetzen Sie `--tpl-user-` durch `--tpl-user-dark-` in jedem Token-Namen aus der obigen Tabelle, um den Dark-Modus anzusprechen. Der Editor aktiviert den Dark-Modus über `data-tpl-theme="dark"` auf seinem Root und liest die Dark-Namespace-Defaults; Ihre `--tpl-user-dark-*`-Überschreibungen klinken sich dort ein.

Der Dark-Modus ist über die `uiTheme`-Konfiguration optional — setzen Sie `'dark'` oder `'auto'`, um ihn zu aktivieren. Siehe [Dark Mode](#dark-mode) unten.

## ThemeOverrides-Konfiguration

Verwenden Sie das `theme`-Feld von `init()`, wenn Sie Theme-Überschreibungen programmatisch anwenden müssen (Multi-Tenant-Branding, Benutzerpräferenz-Umschalter usw.):

```ts
import { init } from "@templatical/editor";

const editor = await init({
  container: "#editor",
  theme: {
    primary: "#6d28d9",
    primaryHover: "#5b21b6",
    primaryLight: "#ede9fe",
    bg: "#fafafa",
    text: "#1a1a1a",
  },
});
```

`ThemeOverrides` wird als Inline-Stil auf dem `.tpl`-Root des Editors angewendet, gewinnt also gegen die klassengebundenen Standardwerte und gegen alle `--tpl-user-*`-Variablen, die Sie auf dem Container gesetzt haben.

### Verfügbare Konfigurationsschlüssel

Die JSON-Schlüssel spiegeln die CSS-Variablennamen (camelCase statt kebab-case). Alle Schlüssel sind optional — nicht gesetzte Schlüssel fallen auf `--tpl-user-*` oder den eingebauten Standardwert zurück.

| Token            | Zweck                                     |
| ---------------- | ----------------------------------------- |
| `bg`             | Haupt-Hintergrund                         |
| `bgElevated`     | Erhöhte Oberflächen                       |
| `bgHover`        | Hintergrund im Hover-Zustand              |
| `bgActive`       | Hintergrund im Aktiv-/Gedrückt-Zustand    |
| `border`         | Standard-Rahmenfarbe                      |
| `borderLight`    | Dezenter Rahmen                           |
| `text`           | Primärer Text                             |
| `textMuted`      | Sekundärer Text                           |
| `textDim`        | Deaktivierter oder Hinweistext            |
| `primary`        | Primäre Markenfarbe                       |
| `primaryHover`   | Primärer Hover-Zustand                    |
| `primaryLight`   | Primärer getönter Hintergrund             |
| `secondary`      | Sekundäre Akzentfarbe                     |
| `secondaryHover` | Sekundärer Hover-Zustand                  |
| `secondaryLight` | Sekundärer getönter Hintergrund           |
| `success`        | Erfolgszustand-Farbe                      |
| `successLight`   | Erfolg getönter Hintergrund               |
| `warning`        | Warn-Farbe                                |
| `warningLight`   | Warnung getönter Hintergrund              |
| `danger`         | Gefahren-/Fehlerfarbe                     |
| `dangerLight`    | Gefahr getönter Hintergrund               |
| `canvasBg`       | Canvas-Bereich hinter dem E-Mail-Template |

### TypeScript-Typ

```ts
import type { ThemeOverrides } from "@templatical/types";
```

## Dark Mode

Der Editor unterstützt ein dunkles Theme für sein UI-Chrome (Kopfbereich, Sidebars, Toolbar, Modale). Der Dark-Modus ist unabhängig vom Canvas-Dark-Vorschau-Schalter, der simuliert, wie E-Mails in Dark-Mode-Clients der Empfänger aussehen.

### Aktivierung

Setzen Sie `uiTheme` in der Init-Konfiguration. Der Standardwert ist `'auto'`, der über `prefers-color-scheme` der Systempräferenz des Nutzers folgt.

```ts
const editor = await init({
  container: "#editor",
  uiTheme: "dark", // 'light' | 'dark' | 'auto'
});
```

### Laufzeit-Umschalter

Theme ohne Neuinitialisierung umschalten:

```ts
editor.setTheme("dark");
editor.setTheme("light");
editor.setTheme("auto"); // Systempräferenz folgen
```

### Dark-Überschreibungen via `ThemeOverrides`

Passen Sie die Dark-Palette separat mit dem `dark`-Schlüssel innerhalb von `theme` an:

```ts
const editor = await init({
  container: "#editor",
  uiTheme: "auto",
  theme: {
    // Light-Mode-Überschreibungen
    primary: "#6d28d9",
    primaryHover: "#5b21b6",
    // Dark-Mode-Überschreibungen
    dark: {
      primary: "#a78bfa",
      primaryHover: "#c4b5fd",
      bg: "#1e1e2e",
      bgElevated: "#2a2a3c",
    },
  },
});
```

**Prioritätskette.** Wenn der Dark-Modus aktiv ist, werden nur `theme.dark`-Überschreibungen als Inline-Stile angewendet. Nicht gesetzte Dark-Tokens fallen über `--tpl-user-dark-*` (wenn auf dem Container gesetzt) auf die eingebauten Dark-Standardwerte zurück.

| Szenario                                      | Was gilt                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Light-Modus, keine Überschreibungen           | Eingebaute Light-Standardwerte                                                                  |
| Light-Modus, `--tpl-user-*` auf Container     | Container-Überschreibungen + verbleibende Light-Standardwerte                                   |
| Light-Modus, `theme`-Konfiguration            | `theme`-Überschreibungen + Container-`--tpl-user-*` + verbleibende Light-Standardwerte          |
| Dark-Modus, keine Überschreibungen            | Eingebaute Dark-Standardwerte                                                                   |
| Dark-Modus, `--tpl-user-dark-*` auf Container | Container-Überschreibungen + verbleibende Dark-Standardwerte                                    |
| Dark-Modus, `theme.dark`-Konfiguration        | `theme.dark`-Überschreibungen + Container-`--tpl-user-dark-*` + verbleibende Dark-Standardwerte |

### TypeScript-Typen

```ts
import type { ThemeOverrides, UiTheme } from "@templatical/types";

// UiTheme = 'light' | 'dark' | 'auto'
// ThemeOverrides enthält einen `dark?: Omit<ThemeOverrides, 'dark'>` Schlüssel
```

## Warum zwei Überschreibungs-Oberflächen?

CSS-Variablen auf dem Container sind einfacher, wenn:

- Theme-Farben statisch oder zur Build-Zeit bekannt sind.
- Sie möchten, dass dieselben Theme-Tokens sowohl auf den Editor als auch auf Ihre umgebende UI angewendet werden (setzen Sie sie auf einen gemeinsamen Wrapper).
- Sie CSS Modules, Tailwind oder ein anderes Stilsystem verwenden, das bereits mit CSS-Variablen arbeitet.

`ThemeOverrides`-JSON ist einfacher, wenn:

- Theme-Farben aus Laufzeitdaten kommen (Benutzerkonto-Präferenzen, Multi-Tenant-Branding).
- Sie in einem Framework arbeiten, das nicht natürlich ein einzelnes gestyltes Container-Element bereitstellt.
- Sie eine einzige typisierte API-Oberfläche möchten und Variablennamen nicht von Hand schreiben wollen.

Beide Oberflächen lassen sich kombinieren: Container-Variablen liefern den Standard, `ThemeOverrides` flickt spezifische Tokens darüber. Die `theme`-Konfigurationsoption des Editors gewinnt immer, weil sie als Inline-Stil angewendet wird.

## Eigene UI an das Editor-Theme anpassen

Wenn Sie möchten, dass Ihr umgebendes Chrome (z. B. eine Wrapper-Toolbar oder Statusleiste) die Palette des Editors erbt, setzen Sie die Überschreibungsvariablen auf einen Wrapper, der sowohl Ihre UI als auch den Editor enthält, und referenzieren Sie sie aus beiden:

```html
<div
  class="my-app"
  style="--tpl-user-primary: #6d28d9; --tpl-user-bg: #fafafa;"
>
  <header class="my-app__header">…</header>
  <div id="editor"></div>
</div>
```

```css
.my-app__header {
  background: var(--tpl-user-bg);
  color: var(--tpl-user-primary);
}
```

Im Shadow-DOM-Modus (dem Standard) bleiben die internen `--tpl-*`-Variablen des Editors innerhalb des Shadow Root und sind für Host-CSS nicht sichtbar. Ihr Host-CSS liest aus den `--tpl-user-*`-Variablen, die Sie selbst gesetzt haben, sodass beide synchron bleiben.

Siehe den [Shadow-DOM-Leitfaden](./shadow-dom) für die Mechanik, wie Variablen die Grenze überqueren.
