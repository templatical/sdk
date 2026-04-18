---
title: Editor-API
description: Vollständige Referenz für die init()-Funktion, TemplaticalEditorConfig und die TemplaticalEditor-Instanz.
---

# Editor-API

Der Haupteinstiegspunkt ist die `init()`-Funktion aus `@templatical/editor`.

## `init(config)`

Erstellt und hängt den Editor in ein Container-Element ein. Gibt ein Promise zurück, das aufgelöst wird, sobald der Editor bereit ist.

```ts
import { init } from '@templatical/editor';
import '@templatical/editor/style.css';

const editor = await init({
  container: '#editor',
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
import { unmount } from '@templatical/editor';

unmount();
```

## TemplaticalEditorConfig

| Property | Type | Required | Beschreibung |
|----------|------|----------|-------------|
| `container` | `string \| HTMLElement` | Yes | CSS-Selektor oder DOM-Element, in das der Editor eingehängt wird |
| `content` | `TemplateContent` | No | Anfänglicher Template-Inhalt. Standardmäßig ein leeres Template |
| `onChange` | `(content: TemplateContent) => void` | No | Wird aufgerufen, wenn sich der Template-Inhalt ändert (entprellt) |
| `onSave` | `(content: TemplateContent) => void` | No | Wird aufgerufen, wenn der Benutzer eine Speicheraktion auslöst |
| `onError` | `(error: Error) => void` | No | Wird aufgerufen, wenn ein Fehler auftritt |
| `onRequestMedia` | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | No | Wird aufgerufen, wenn der Benutzer ein Bild auswählen möchte. Gibt `{ url, alt? }` oder `null` zurück |
| `mergeTags` | `MergeTagsConfig` | No | Merge-Tag-Konfiguration. Siehe [Merge-Tags](/de/guide/merge-tags) |
| `displayConditions` | `DisplayConditionsConfig` | No | Konfiguration für Anzeigebedingungen. Siehe [Anzeigebedingungen](/de/guide/display-conditions) |
| `customBlocks` | `CustomBlockDefinition[]` | No | Definitionen für benutzerdefinierte Blocktypen. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks) |
| `blockDefaults` | `BlockDefaults` | No | Standard-Property-Überschreibungen für neue Blöcke. Siehe [Standardwerte](/de/guide/defaults) |
| `templateDefaults` | `TemplateDefaults` | No | Standardeinstellungen für leere Templates. Siehe [Standardwerte](/de/guide/defaults) |
| `fonts` | `FontsConfig` | No | Schriftart-Konfiguration. Siehe [Benutzerdefinierte Schriftarten](/de/guide/fonts) |
| `theme` | `ThemeOverrides` | No | Überschreibungen für Farb-Tokens. Unterstützt einen `dark`-Schlüssel für Dark-Mode-Überschreibungen. Siehe [Theming](/de/guide/theming) |
| `uiTheme` | `'light' \| 'dark' \| 'auto'` | No | UI-Farbschema. `'auto'` folgt den Systemeinstellungen. Standardwert ist `'auto'` |
| `locale` | `string` | No | Locale-Code (z. B. `'en'`, `'de'`). Standardwert ist `'en'` |


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
import { createDefaultTemplateContent } from '@templatical/types';

editor.setContent(createDefaultTemplateContent());
```

### `setTheme(theme)`

Wechselt das UI-Farbschema zur Laufzeit, ohne den Editor neu zu initialisieren.

```ts
editor.setTheme('dark');
editor.setTheme('light');
editor.setTheme('auto'); // folgt der Systemeinstellung
```

**Parameter:** `theme: 'light' | 'dark' | 'auto'`

### `unmount()`

Zerstört diese Editor-Instanz.

### `toMjml()`

Rendert den aktuellen Inhalt in MJML-Markup. Nur verfügbar, wenn `@templatical/renderer` installiert ist.

```ts
const mjml = editor.toMjml?.();
```

Um MJML zu HTML zu kompilieren, verwenden Sie eine beliebige MJML-Bibliothek (z. B. [mjml](https://www.npmjs.com/package/mjml) für Node.js).

## Core-Composables

Für fortgeschrittene Anwendungsfälle können Sie die Composables aus `@templatical/core` direkt verwenden.

### `useEditor(options)`

Das Kern-Composable, das den gesamten Editor-Zustand verwaltet: den Block-Baum, Template-Einstellungen, Block-Auswahl, Viewport-Modus sowie alle Mutationsmethoden. Dies ist das, was `init()` intern verwendet. Verwenden Sie es direkt, wenn Sie eine vollständig benutzerdefinierte Editor-Oberfläche auf der Templatical-State-Engine aufbauen.

```ts
import { useEditor } from '@templatical/core';

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: 'New text' });
editor.setViewport('mobile');
```

### `useHistory(options)`

Verfolgt Inhalts-Snapshots und stellt Undo/Redo bereit. Wird mit der Content-Ref des Editors verbunden und erfasst den Zustand nach jeder Mutation. Eine konfigurierbare maximale Verlaufsgröße verhindert unbegrenztes Speicherwachstum.

```ts
import { useHistory } from '@templatical/core';

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
import { useBlockActions } from '@templatical/core';

const actions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
});

const newBlock = actions.createAndAddBlock('text');
actions.duplicateBlock(existingBlock);
actions.deleteBlock(blockId);
actions.updateBlockProperty(blockId, 'content', '<p>Updated</p>');
```

### `useAutoSave(options)`

Überwacht den Editor-Inhalt und ruft Ihren Speicher-Callback mit konfigurierbarer Entprellung (Debounce) auf. Enthält Pause/Resume zum vorübergehenden Deaktivieren von Speichervorgängen (z. B. während Massenoperationen) sowie eine `flush()`-Methode für sofortiges Speichern.

```ts
import { useAutoSave } from '@templatical/core';

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 1000,
  enabled: true,    // boolean oder () => boolean
});

autoSave.flush();   // Sofort speichern
autoSave.cancel();  // Ausstehenden entprellten Speichervorgang abbrechen
autoSave.pause();   // Auto-Save pausieren
autoSave.resume();  // Fortsetzen
autoSave.destroy(); // Überwachung beenden und aufräumen
```

### `useConditionPreview()`

Verwaltet den Vorschauzustand für Anzeigebedingungen im Editor. Ermöglicht das Ein-/Ausschalten einzelner Blöcke, um zu simulieren, wie bedingter Inhalt aussieht, wenn unterschiedliche Bedingungen erfüllt sind.

```ts
import { useConditionPreview } from '@templatical/core';

const preview = useConditionPreview(editor);

preview.isHidden(blockId);         // Prüfen, ob ein Block in der Vorschau ausgeblendet ist
preview.toggleBlock(blockId);      // Sichtbarkeit eines Blocks umschalten
preview.reset();                   // Alle Blöcke auf sichtbar zurücksetzen
preview.hasHiddenBlocks;           // ComputedRef<boolean>
```

### `useDataSourceFetch(options)`

Übernimmt das Abrufen externer Daten für benutzerdefinierte Blöcke mit Datenquellen. Verwaltet den Ladezustand und die Fehlerbehandlung für den `onFetch`-Callback.

```ts
import { useDataSourceFetch } from '@templatical/core';

const dataFetch = useDataSourceFetch({
  definition: computed(() => customBlockDefinition),
  block: computed(() => customBlock),
  onUpdate: (fieldValues, fetched) => {
    updateBlock(block.id, { fieldValues, dataSourceFetched: fetched });
  },
});

dataFetch.isFetching;              // Ref<boolean>
dataFetch.fetchError;              // Ref<boolean>
dataFetch.hasDataSource;           // ComputedRef<boolean>
dataFetch.needsFetch;              // ComputedRef<boolean>
await dataFetch.fetch();           // Abruf auslösen
```
