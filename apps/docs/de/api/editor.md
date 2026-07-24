---
title: Editor-API
description: Vollständige Referenz für die init()-Funktion, TemplaticalEditorConfig und die TemplaticalEditor-Instanz.
---

# Editor-API

Der Haupteinstiegspunkt ist die `init()`-Funktion aus `@templatical/editor`.

## `init(config)`

Erstellt und hängt den Editor in ein Container-Element ein. Gibt ein Promise zurück, das aufgelöst wird, sobald der Editor bereit ist.

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  content: savedTemplate,
  onChange(content) {
    // Automatisch speichern oder Zustand aktualisieren
  },
});
```

**Rückgabewert:** [`TemplaticalEditor`](#templaticaleditor)

## `unmount()`

Zerstört die Editor-Instanz und räumt Event-Listener auf.

```ts
import { unmount } from "@templatical/editor";

unmount();
```

## TemplaticalEditorConfig

| Property            | Type                                                              | Required | Beschreibung                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`         | `string \| HTMLElement`                                           | Yes      | CSS-Selektor oder DOM-Element, in das der Editor eingehängt wird. Im Standardmodus (Shadow DOM) muss es ein Element sein, das einen Shadow Root aufnehmen kann — `<div>` wird empfohlen. Siehe [Anforderungen an das Container-Element](#anforderungen-an-das-container-element) unten                                            |
| `shadowDom`         | `boolean`                                                         | No       | Mountet innerhalb eines Shadow DOM zur CSS-Isolation von der Host-Seite. Standardwert `true`. Auf `false` setzen, um stattdessen im Light DOM zu mounten (z. B. für `document.querySelector`-Zugriff auf Editor-Interna oder Firefox-<101 / Safari-<16.4-Unterstützung). Siehe [Shadow DOM](/de/guide/shadow-dom) für Kompromisse |
| `content`           | `TemplateContent`                                                 | No       | Anfänglicher Template-Inhalt. Standardmäßig ein leeres Template                                                                                                                                                                                                                                                                   |
| `onChange`          | `(content: TemplateContent) => void`                              | No       | Wird aufgerufen, wenn sich der Template-Inhalt ändert (entprellt)                                                                                                                                                                                                                                                                 |
| `onSave`            | `(content: TemplateContent) => void`                              | No       | Wird aufgerufen, wenn der Benutzer eine Speicheraktion auslöst                                                                                                                                                                                                                                                                    |
| `onError`           | `(error: Error) => void`                                          | No       | Wird aufgerufen, wenn ein Fehler auftritt                                                                                                                                                                                                                                                                                         |
| `onRequestMedia`    | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | No       | Wird aufgerufen, wenn der Benutzer ein Bild auswählen möchte. Gibt `{ url, alt? }` oder `null` zurück                                                                                                                                                                                                                             |
| `resolveImageUrl`   | `(src: string) => string \| null \| Promise<string \| null>`      | No       | Reiner Anzeige-Resolver für Bild-`src`-Werte: bildet einen kanonischen src auf eine Vorschau-URL für die Leinwand ab. Inhalt und `toMjml()`-Ausgabe behalten den kanonischen Wert. `null` zurückgeben, um den src unverändert zu verwenden. Wird einmal pro bestätigtem src aufgerufen (entprellt), pro src zwischengespeichert. Siehe [Bilder](/de/guide/images#reine-anzeige-aufloesung-von-bild-urls) |
| `mergeTags`         | `MergeTagsConfig`                                                 | No       | Merge-Tag-Konfiguration. Siehe [Merge-Tags](/de/guide/merge-tags)                                                                                                                                                                                                                                                                 |
| `displayConditions` | `DisplayConditionsConfig`                                         | No       | Konfiguration für Anzeigebedingungen. Siehe [Anzeigebedingungen](/de/guide/display-conditions)                                                                                                                                                                                                                                    |
| `customBlocks`      | `CustomBlockDefinition[]`                                         | No       | Definitionen für benutzerdefinierte Blocktypen. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks)                                                                                                                                                                                                                        |
| `paletteBlocks`     | `string[]`                                                        | No       | Allowlist + Reihenfolge für die Block-Palette. Nur die aufgeführten Typen erscheinen, in dieser Reihenfolge; nicht aufgeführte integrierte Blöcke werden ausgeblendet. Integrierte Blöcke über ihren reinen Typ (`'image'`), benutzerdefinierte über den `custom:`-präfixierten Typ (`'custom:qrcode'`). Siehe [Block-Palette anpassen](#block-palette-anpassen) |
| `htmlBlockPreview`  | `boolean \| { enabled: boolean }`                                 | No       | Rendert den Inhalt jedes HTML-Blocks als Live-Vorschau in der Leinwand — in einem sandboxed `<iframe>` ohne Skriptausführung — statt des statischen Platzhalters. Standardmäßig `false`. Nur Vorschau; der MJML-/HTML-Export rendert HTML-Blöcke unabhängig davon. Siehe [HTML-Blöcke in der Vorschau](#html-bloecke-in-der-vorschau) |
| `blockDefaults`     | `BlockDefaults`                                                   | No       | Standard-Property-Überschreibungen für neue Blöcke. Siehe [Standardwerte](/de/guide/defaults)                                                                                                                                                                                                                                     |
| `templateDefaults`  | `TemplateDefaults`                                                | No       | Standardeinstellungen für leere Templates. Siehe [Standardwerte](/de/guide/defaults)                                                                                                                                                                                                                                              |
| `fonts`             | `FontsConfig`                                                     | No       | Schriftart-Konfiguration. Siehe [Benutzerdefinierte Schriftarten](/de/guide/fonts)                                                                                                                                                                                                                                                |
| `colors`            | `ColorsConfig`                                                    | No       | Farbwähler-Palette. `presets` werden als anklickbares Raster in jedem Farbwähler gerendert; `allowCustom: false` beschränkt Autoren darauf. Siehe [Vordefinierte Farben](#vordefinierte-farben)                                                                                                                                   |
| `theme`             | `ThemeOverrides`                                                  | No       | Überschreibungen für Farb-Tokens. Unterstützt einen `dark`-Schlüssel für Dark-Mode-Überschreibungen. Siehe [Theming](/de/guide/theming)                                                                                                                                                                                           |
| `uiTheme`           | `'light' \| 'dark' \| 'auto'`                                     | No       | UI-Farbschema. `'auto'` folgt den Systemeinstellungen. Standardwert ist `'auto'`                                                                                                                                                                                                                                                  |
| `locale`            | `string`                                                          | No       | Locale-Code (z. B. `'en'`, `'de'`, `'pt-BR'`, `'es'`, `'ca'`). Standardwert ist `'en'`                                                                                                                                                                                                                                                                       |
| `branding`          | `boolean`                                                         | No       | Zeigt den "Powered by Templatical"-Footer. Standardwert `true`. Auf `false` setzen, um ihn auszublenden                                                                                                                                                                                                                           |
| `smallScreenNotice` | `boolean`                                                         | No       | Zeigt auf Viewports schmaler als ~768px einen Hinweis „Bitte größeren Bildschirm verwenden" anstelle des Editors. Standardwert `true`. Der Drag-and-Drop-Editor ist ein Desktop-Werkzeug und lässt sich auf einem Smartphone nicht sinnvoll darstellen. Auf `false` setzen, um den Editor bei jeder Breite zu rendern, wenn Sie kleine Bildschirme selbst behandeln |

### Anforderungen an das Container-Element

Das Standard-Mount (Shadow DOM) ruft `attachShadow()` auf Ihrem Container auf, und die HTML-Spezifikation erlaubt Shadow Roots nur für eine feste Menge von Elementen. Verwenden Sie eines davon:

`<article>`, `<aside>`, `<blockquote>`, `<body>`, `<div>` (empfohlen), `<footer>`, `<h1>`–`<h6>`, `<header>`, `<main>`, `<nav>`, `<p>`, `<section>`, `<span>` sowie jedes von Ihnen definierte Custom Element.

**Nicht erlaubt:** `<table>`, `<tr>`, `<td>`, `<form>`, `<input>`, `<button>`, `<select>`, Listenelemente (`<ul>`, `<ol>`, `<li>`), `<iframe>`, ersetzte Elemente (`<img>`, `<video>` usw.). Die Übergabe eines dieser Elemente wirft eine `DOMException` aus `attachShadow()`.

Wenn Ihre Integration ein nicht unterstütztes Element verwenden muss (z. B. Mount in eine `<form>`-Zelle eines CMS-Layouts), übergeben Sie `shadowDom: false` — das Light-DOM-Mount akzeptiert jedes Element. Der Kompromiss ist die Host-CSS-Isolation, auf die Sie verzichten.

### Block-Palette anpassen

Standardmäßig listet die Seitenleisten-Palette jeden integrierten Blocktyp auf. Übergeben Sie `paletteBlocks`, um die Palette auf eine bestimmte Menge zu beschränken und ihre Reihenfolge zu steuern — nützlich, um nicht verwendete Blocktypen (`video`, `table`, …) auszublenden oder einen häufig genutzten [benutzerdefinierten Block](/de/guide/custom-blocks) über die integrierten Blöcke zu stellen.

```ts
const editor = await init({
  container: "#editor",
  customBlocks: [qrCodeDefinition],
  paletteBlocks: [
    "section",
    "title",
    "paragraph",
    "image",
    "custom:qrcode", // ein benutzerdefinierter Block, zwischen integrierten Blöcken
    "button",
  ],
});
```

- **Strikte Allowlist + Reihenfolge.** Es werden nur die aufgeführten Typen angezeigt, in genau dieser Reihenfolge. Jeder nicht aufgeführte integrierte Block (hier `divider`, `video`, `social`, `menu`, `table`, `spacer`, `html`) wird aus der Palette ausgeblendet.
- **Integrierte Blöcke über ihren reinen Typ** (`"section"`, `"image"`, …) und **benutzerdefinierte Blöcke über ihren `custom:`-präfixierten Typ** (`"custom:qrcode"`) referenzieren, sodass beide frei vermischt werden können.
- **Unbekannte Einträge werden übersprungen.** Ein Tippfehler, ein nicht registrierter benutzerdefinierter Block oder `countdown` außerhalb eines Cloud-Plans wird mit einer Warnung in der Konsole protokolliert und nicht in die Palette aufgenommen.
- **Das Filtern der Palette wirkt sich nie auf das Rendering aus.** Das Ausblenden eines Blocktyps entfernt ihn nur aus der Palette — vorhandener Inhalt, der diesen Typ bereits verwendet, wird weiterhin korrekt gerendert. `paletteBlocks` steuert, was Benutzer _einfügen_ können, nicht, was der Editor _anzeigen_ kann.

Lassen Sie `paletteBlocks` weg (oder übergeben Sie ein leeres Array), um die vollständige Standard-Palette anzuzeigen.

### HTML-Blöcke in der Vorschau {#html-bloecke-in-der-vorschau}

Standardmäßig zeigt ein HTML-Block in der Leinwand eine Platzhalterkarte an, anstatt sein Markup zu rendern — der Inhalt wird erst beim Export realisiert. Setzen Sie `htmlBlockPreview`, um den Inhalt jedes HTML-Blocks stattdessen live in der Leinwand zu rendern:

```ts
const editor = await init({
  container: "#editor",
  htmlBlockPreview: true, // Kurzform für { enabled: true }
});
```

- **Standardmäßig aus.** Lassen Sie die Option weg (oder übergeben Sie `false` / `{ enabled: false }`), um den statischen Platzhalter beizubehalten.
- **In einem sandboxed `<iframe>` gerendert.** Der Inhalt wird unverändert in einem `<iframe sandbox="allow-same-origin">` **ohne** `allow-scripts` angezeigt — Skripte und Inline-Event-Handler werden nie ausgeführt, und die Styles des Fragments können nicht in den Rest des Editors gelangen. So wird verhindert, dass beliebiges oder von Mitarbeitenden erstelltes HTML im Origin Ihrer App ausgeführt wird.
- **Nur Vorschau.** Diese Einstellung steuert die Editor-Leinwand, nicht die Ausgabe — `renderToMjml()` / `editor.toMjml()` rendern HTML-Blöcke unabhängig davon.

### Vordefinierte Farben {#vordefinierte-farben}

Jeder Farbwähler im Editor — Block-Symbolleisten, Template-Einstellungen, Rich-Text-Farbe, Farbfelder benutzerdefinierter Blöcke — öffnet ein Popover mit einem Farbrad und einem Hex-Eingabefeld. Übergeben Sie `colors`, um diesem Popover eine Reihe vordefinierter Farben hinzuzufügen und optional die freien Eingabefelder zu entfernen:

```ts
const editor = await init({
  container: "#editor",
  colors: {
    presets: ["#0b5cff", "#111827", "#6b7280", "#ffffff"],
    allowCustom: false,
  },
});
```

- **`presets`** — Hex-Zeichenketten, die als anklickbares Raster gerendert werden. Ein Klick übernimmt die Farbe; die vordefinierte Farbe, die dem aktuellen Wert entspricht, wird als ausgewählt markiert. Ergänzt das Farbrad und das Hex-Eingabefeld. Jeder Eintrag muss eine `#rgb`- oder `#rrggbb`-Hex-Zeichenkette sein — 4-/8-stellige Alpha-Hex-Werte und andere Formate werden übersprungen und mit einer Konsolenwarnung protokolliert, die die betreffenden Einträge auflistet.
- **`allowCustom`** — standardmäßig `true`. Auf `false` gesetzt (zusammen mit `presets`) werden das Farbrad und das Hex-Eingabefeld ausgeblendet, sodass Autoren nur aus der Palette wählen können — nützlich beim Einbetten des Editors als White-Label- / Brand-Kit-Werkzeug. In diesem gesperrten Modus beginnt die Palette mit einem „Keine Farbe“-Feld, das den nicht gesetzten (geerbten) Zustand wiederherstellt, da die Schaltfläche zum Löschen des Hex-Eingabefelds ausgeblendet ist. Wird mit einer Warnung ignoriert, wenn keine `presets` konfiguriert sind, da der Farbwähler sonst keine Möglichkeit hätte, eine Farbe festzulegen.

## TemplaticalEditor

Das von `init()` zurückgegebene Objekt.

### `getContent()`

Gibt den aktuellen Template-Inhalt als `TemplateContent`-Objekt zurück.

```ts
const content = editor.getContent();
// { blocks: [...], settings: { width: 600, ... } }
```

### `setContent(content)`

Ersetzt den Editor-Inhalt.

```ts
import { createDefaultTemplateContent } from "@templatical/types";

editor.setContent(createDefaultTemplateContent());
```

### `setTheme(theme)`

Wechselt das UI-Farbschema zur Laufzeit, ohne den Editor neu zu initialisieren.

```ts
editor.setTheme("dark");
editor.setTheme("light");
editor.setTheme("auto"); // folgt der Systemeinstellung
```

**Parameter:** `theme: 'light' | 'dark' | 'auto'`

### `unmount()`

Zerstört diese Editor-Instanz.

### `toMjml()`

Rendert den aktuellen Inhalt in MJML-Markup. Gibt ein `Promise<string>` zurück, da das Auflösen benutzerdefinierter Blöcke asynchrone Arbeit erfordern kann (der Liquid-Renderer des Editors wird bei Bedarf geladen).

```ts
const mjml = await editor.toMjml();
```

Wirft einen klaren Fehler, wenn `@templatical/renderer` nicht installiert ist. Der Renderer ist eine optionale Peer-Abhängigkeit – installieren Sie ihn nur, wenn Sie MJML-Export aus dem Browser benötigen. Siehe [Installation](/de/getting-started/installation) für Details.

Um MJML zu HTML zu kompilieren, verwenden Sie eine beliebige MJML-Bibliothek (z. B. [mjml](https://www.npmjs.com/package/mjml) für Node.js).

::: tip Cloud-Editor
Der Cloud-Editor stellt `toMjml()` **nicht** zur Verfügung – das Cloud-Backend übernimmt die MJML-Konvertierung serverseitig mit zusätzlicher Verarbeitung (signierte Bild-URLs, Asset-Umschreibung). Verwenden Sie den OSS-Editor (`init`, nicht `initCloud`), wenn Sie clientseitigen MJML-Export wünschen.
:::

### `renderCustomBlock(block)`

Rendert einen einzelnen benutzerdefinierten Block in seine HTML-Darstellung. Nützlich für Headless-Aufrufer, die `@templatical/renderer`s `renderCustomBlock`-Option von außerhalb der Editor-Instanz steuern möchten – etwa beim direkten Aufruf des Renderers mit eigener Konfiguration.

```ts
const html = await editor.renderCustomBlock(customBlock);
```

## Core-Composables

Für fortgeschrittene Anwendungsfälle können Sie die Composables aus `@templatical/core` direkt verwenden.

### `useEditor(options)`

Das Kern-Composable, das den gesamten Editor-Zustand verwaltet: den Block-Baum, Template-Einstellungen, Block-Auswahl, Viewport-Modus sowie alle Mutationsmethoden. Dies ist das, was `init()` intern verwendet. Verwenden Sie es direkt, wenn Sie eine vollständig benutzerdefinierte Editor-Oberfläche auf der Templatical-State-Engine aufbauen.

```ts
import { useEditor } from "@templatical/core";

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: "New text" });
editor.setViewport("mobile");
```

### `useHistory(options)`

Verfolgt Inhalts-Snapshots und stellt Undo/Redo bereit. Wird mit der Content-Ref des Editors verbunden und erfasst den Zustand nach jeder Mutation. Eine konfigurierbare maximale Verlaufsgröße verhindert unbegrenztes Speicherwachstum.

```ts
import { useHistory } from "@templatical/core";

const history = useHistory({
  content: editor.content,
  setContent: editor.setContent,
  isRemoteOperation: () => false, // Aufzeichnung bei Remote-/Kollaborations-Updates überspringen
  maxSize: 50,
});

history.undo();
history.redo();
```

### `useBlockActions(options)`

Komfortmethoden auf höherer Ebene für gängige Block-Operationen: einen Block erstellen und in einem Schritt einfügen, einen bestehenden Block duplizieren (Deep Clone mit neuer ID) und Löschen mit automatischer Auswahl-Bereinigung.

```ts
import { useBlockActions } from "@templatical/core";

const actions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
});

const newBlock = actions.createAndAddBlock("text");
actions.duplicateBlock(existingBlock);
actions.deleteBlock(blockId);
actions.updateBlockProperty(blockId, "content", "<p>Updated</p>");
```

### `useAutoSave(options)`

Überwacht den Editor-Inhalt und ruft Ihren Speicher-Callback mit konfigurierbarer Entprellung (Debounce) auf. Enthält Pause/Resume zum vorübergehenden Deaktivieren von Speichervorgängen (z. B. während Massenoperationen) sowie eine `flush()`-Methode für sofortiges Speichern.

```ts
import { useAutoSave } from "@templatical/core";

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 1000,
  enabled: true, // boolean oder () => boolean
});

autoSave.flush(); // Sofort speichern
autoSave.cancel(); // Ausstehenden entprellten Speichervorgang abbrechen
autoSave.pause(); // Auto-Save pausieren
autoSave.resume(); // Fortsetzen
autoSave.destroy(); // Überwachung beenden und aufräumen
```

### `useConditionPreview()`

Verwaltet den Vorschauzustand für Anzeigebedingungen im Editor. Ermöglicht das Ein-/Ausschalten einzelner Blöcke, um zu simulieren, wie bedingter Inhalt aussieht, wenn unterschiedliche Bedingungen erfüllt sind.

```ts
import { useConditionPreview } from "@templatical/core";

const preview = useConditionPreview(editor);

preview.isHidden(blockId); // Prüfen, ob ein Block in der Vorschau ausgeblendet ist
preview.toggleBlock(blockId); // Sichtbarkeit eines Blocks umschalten
preview.reset(); // Alle Blöcke auf sichtbar zurücksetzen
preview.hasHiddenBlocks; // ComputedRef<boolean>
```

### `useDataSourceFetch(options)`

Übernimmt das Abrufen externer Daten für benutzerdefinierte Blöcke mit Datenquellen. Verwaltet den Ladezustand und die Fehlerbehandlung für den `onFetch`-Callback.

```ts
import { useDataSourceFetch } from "@templatical/core";

const dataFetch = useDataSourceFetch({
  definition: computed(() => customBlockDefinition),
  block: computed(() => customBlock),
  onUpdate: (fieldValues, fetched) => {
    updateBlock(block.id, { fieldValues, dataSourceFetched: fetched });
  },
});

dataFetch.isFetching; // Ref<boolean>
dataFetch.fetchError; // Ref<boolean>
dataFetch.hasDataSource; // ComputedRef<boolean>
dataFetch.needsFetch; // ComputedRef<boolean>
await dataFetch.fetch(); // Abruf auslösen
```
