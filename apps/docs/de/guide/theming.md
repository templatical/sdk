---
title: Theming
description: Passen Sie das Erscheinungsbild des Editors mit Theme-Überschreibungen, Dark Mode, CSS-Variablen und benutzerdefinierten Schriftarten an.
---

# Theming

Templatical wird mit einem ausgefeilten Standard-Theme ausgeliefert. Sie können jedes Farb-Token überschreiben, um es an die Marke Ihres Produkts anzupassen.

## Theme-Überschreibungen

Übergeben Sie ein `ThemeOverrides`-Objekt an `init()`, um die Farbpalette des Editors anzupassen:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  theme: {
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    primaryLight: '#ede9fe',
    bg: '#fafafa',
    text: '#1a1a1a',
  },
});
```

### Verfügbare Tokens

Alle Tokens sind optional. Nicht gesetzte Tokens greifen auf die integrierten Standardwerte zurück.

| Token | Zweck |
|---|---|
| `bg` | Haupt-Hintergrund |
| `bgElevated` | Erhöhte Oberflächen (Panels, Dropdowns) |
| `bgHover` | Hintergrund im Hover-Zustand |
| `bgActive` | Hintergrund im Aktiv-/Gedrückt-Zustand |
| `border` | Standard-Rahmenfarbe |
| `borderLight` | Dezenter Rahmen (Trenner, Separatoren) |
| `text` | Primärer Text |
| `textMuted` | Sekundärer Text |
| `textDim` | Deaktivierter oder Hinweistext |
| `primary` | Primäre Markenfarbe (Schaltflächen, Links) |
| `primaryHover` | Primär-Hover-Zustand |
| `primaryLight` | Primär getönter Hintergrund |
| `secondary` | Sekundäre Akzentfarbe |
| `secondaryHover` | Sekundär-Hover-Zustand |
| `secondaryLight` | Sekundär getönter Hintergrund |
| `success` | Farbe für Erfolgs-Zustand |
| `successLight` | Erfolg getönter Hintergrund |
| `warning` | Farbe für Warn-Zustand |
| `warningLight` | Warnung getönter Hintergrund |
| `danger` | Farbe für Gefahren-/Fehler-Zustand |
| `dangerLight` | Gefahr getönter Hintergrund |
| `canvasBg` | Arbeitsfläche hinter dem E-Mail-Template |

### TypeScript-Typ

```ts
import type { ThemeOverrides } from '@templatical/types';
```

## Dark Mode

Der Editor unterstützt ein dunkles Theme für seine UI-Elemente (Header, Seitenleisten, Symbolleiste, Modals). Der Dark Mode ist unabhängig vom Dunkel-Vorschau-Umschalter der Arbeitsfläche, der simuliert, wie E-Mails in den dunkel-thematisierten E-Mail-Clients der Empfänger aussehen.

### Aktivierung

Setzen Sie `uiTheme` in der init-Konfiguration. Der Standardwert ist `'auto'`, was der Systempräferenz des Benutzers über `prefers-color-scheme` folgt.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  uiTheme: 'dark', // 'light' | 'dark' | 'auto'
});
```

### Laufzeit-Umschaltung

Schalten Sie das Theme zur Laufzeit um, ohne den Editor neu zu initialisieren:

```ts
editor.setTheme('dark');
editor.setTheme('light');
editor.setTheme('auto'); // der Systempräferenz folgen
```

### Dark-Theme-Überschreibungen

Passen Sie die dunkle Palette separat von der hellen Palette an, indem Sie den `dark`-Schlüssel innerhalb von `theme` verwenden:

```ts
const editor = await init({
  container: '#editor',
  uiTheme: 'auto',
  theme: {
    // Überschreibungen für Light Mode
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    // Überschreibungen für Dark Mode
    dark: {
      primary: '#a78bfa',
      primaryHover: '#c4b5fd',
      bg: '#1e1e2e',
      bgElevated: '#2a2a3c',
    },
  },
});
```

**Prioritätskette:** Wenn der Dark Mode aktiv ist, werden nur `theme.dark`-Überschreibungen als Inline-Stile angewendet. Nicht gesetzte dunkle Tokens greifen auf die integrierten dunklen Standardwerte zurück. Die Basis-`theme`-Überschreibungen (hell) werden nur im Light Mode angewendet.

| Szenario | Was gilt |
|---|---|
| Light Mode, keine Überschreibungen | Integrierte helle Standardwerte |
| Light Mode, mit `theme` | `theme`-Überschreibungen + verbleibende helle Standardwerte |
| Dark Mode, keine Überschreibungen | Integrierte dunkle Standardwerte |
| Dark Mode, mit `theme.dark` | `theme.dark`-Überschreibungen + verbleibende dunkle Standardwerte |

### TypeScript-Typen

```ts
import type { ThemeOverrides, UiTheme } from '@templatical/types';

// UiTheme = 'light' | 'dark' | 'auto'
// ThemeOverrides includes a `dark?: Omit<ThemeOverrides, 'dark'>` key
```

## CSS Custom Properties

Jedes Theme-Token wird einer CSS Custom Property zugeordnet, die mit `--tpl-` präfixiert ist. Das `tpl-`-Präfix verhindert Konflikte mit den eigenen CSS-Variablen Ihrer Anwendung und macht den Editor sicher einbettbar auf jeder Seite. Sie können diese Variablen in Ihren eigenen Stylesheets verwenden, um Ihre umgebende UI konsistent mit dem Editor zu halten:

```css
.my-wrapper {
  background: var(--tpl-bg);
  color: var(--tpl-text);
  border: 1px solid var(--tpl-border);
}
```

Jedes Token wird einer CSS-Variable gemäß dem Muster `--tpl-{tokenName}` in Kebab-Case zugeordnet. Zum Beispiel wird `bgElevated` zu `--tpl-bg-elevated`.

Im Dark Mode setzt der Editor `data-tpl-theme="dark"` auf seinem Wurzelelement und weist alle `--tpl-*`-Variablen auf dunkle Werte um. Wenn Sie diese Variablen in Ihrer umgebenden UI referenzieren, werden sie automatisch aktualisiert, wenn der Editor die Themes umschaltet.

