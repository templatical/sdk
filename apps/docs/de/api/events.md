---
title: Ereignisse
description: Editor-Event-Callbacks — onChange, onSave, onError sowie Handler für Medien- und Merge-Tag-Anfragen.
---

# Ereignisse

Der Editor kommuniziert mit Ihrer Anwendung über Callback-Funktionen, die in der Konfiguration übergeben werden.

## Inhalts-Ereignisse

### `onChange`

Wird aufgerufen, wann immer sich der Template-Inhalt ändert. Der Callback erhält das vollständige `TemplateContent`-Objekt. Änderungen werden intern entprellt.

```ts
const editor = await init({
  container: '#editor',
  onChange(content) {
    // An Ihr Backend speichern
    fetch('/api/templates/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
  },
});
```

### `onSave`

Wird aufgerufen, wenn der Benutzer explizit einen Speichervorgang auslöst (z. B. über ein Tastenkürzel). Verwenden Sie dies für sofortige Speichervorgänge im Gegensatz zum entprellten `onChange`.

```ts
const editor = await init({
  container: '#editor',
  onSave(content) {
    saveTemplate(content);
    showNotification('Template saved');
  },
});
```

### `onError`

Wird aufgerufen, wenn innerhalb des Editors ein Fehler auftritt.

```ts
const editor = await init({
  container: '#editor',
  onError(error) {
    console.error('Editor error:', error.message);
    reportToSentry(error);
  },
});
```

## Anfrage-Ereignisse

### `onRequestMedia`

Wird aufgerufen, wenn der Benutzer klickt, um ein Bild auszuwählen (z. B. in den Einstellungen des Bild-Blocks). Geben Sie ein `MediaResult`-Objekt zurück oder `null`, wenn der Benutzer abbricht. Wenn `alt` angegeben ist, füllt der Editor den Alt-Text des Bildes automatisch aus.

```ts
import type { MediaResult } from '@templatical/types';

const editor = await init({
  container: '#editor',
  async onRequestMedia(context?): Promise<MediaResult | null> {
    const image = await openMediaPicker();
    if (!image) return null;
    return { url: image.url, alt: image.alt };
  },
});
```

Wenn Sie `onRequestMedia` nicht bereitstellen, zeigt der Editor ein Texteingabefeld an, in dem Benutzer Bild-URLs direkt eingeben oder einfügen können.

### `mergeTags.onRequest`

Wird aufgerufen, wenn der Benutzer klickt, um ein Merge-Tag in einen Title- oder Paragraph-Block einzufügen. Gibt ein `Promise` zurück, das sich zu einem `MergeTag`-Objekt oder `null` auflöst, wenn der Benutzer abbricht.

```ts
import type { MergeTag } from '@templatical/types';

const editor = await init({
  container: '#editor',
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}' },
      { label: 'Email', value: '{{email}}' },
    ],
    async onRequest(): Promise<MergeTag | null> {
      // Zeigen Sie Ihre eigene Picker-UI an und geben Sie das ausgewählte Tag zurück
      const tag = await showMergeTagPicker();
      return tag; // oder null, falls abgebrochen
    },
  },
});
```

Wenn Sie `mergeTags.tags` ohne `onRequest` bereitstellen, verwendet der Editor ein eingebautes Dropdown, das mit Ihren Tags befüllt wird. Der `onRequest`-Callback ermöglicht es Ihnen, dieses Dropdown durch Ihre eigene UI zu ersetzen.

## Muster

### Entprelltes Auto-Save

```ts
let saveTimeout: ReturnType<typeof setTimeout>;

const editor = await init({
  container: '#editor',
  onChange(content) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToBackend(content);
    }, 2000);
  },
  onSave(content) {
    clearTimeout(saveTimeout);
    saveToBackend(content);
  },
});
```

### Dirty-State-Tracking

```ts
let isDirty = false;

const editor = await init({
  container: '#editor',
  onChange() {
    isDirty = true;
    updateSaveButton();
  },
  onSave(content) {
    saveToBackend(content).then(() => {
      isDirty = false;
      updateSaveButton();
    });
  },
});

window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
  }
});
```
