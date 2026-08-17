---
title: Ereignisse
description: Editor-Event-Callbacks — onChange, onDirtyChange, onError sowie Handler für Medien- und Merge-Tag-Anfragen.
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

### `onDirtyChange`

Wird aufgerufen, sobald der Editor ungespeicherte Änderungen erhält oder verliert. Nutzen Sie es für Ihren eigenen Speichern-Button oder um einen clientseitigen Routenwechsel abzusichern — der eingebaute Schutz deckt das Schließen des Tabs ab, `beforeunload` greift bei SPA-Navigation jedoch nie.

```ts
const editor = await init({
  container: '#editor',
  onDirtyChange(isDirty) {
    setRouteGuard(isDirty);
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

Wird aufgerufen, wenn der Benutzer klickt, um ein Bild auszuwählen (z. B. in den Einstellungen des Bild-Blocks), **oder eine Bilddatei auf einen Bildblock bzw. ein Bildfeld zieht**. Geben Sie ein `MediaResult`-Objekt zurück oder `null`, wenn der Benutzer abbricht. Wenn `alt` angegeben ist, füllt der Editor den Alt-Text des Bildes automatisch aus.

Bei Drag-and-Drop landet die abgelegte Datei in `context.files` — laden Sie sie hoch und geben Sie die gehostete URL zurück. Siehe [Per Drag-and-Drop hochladen](/de/guide/images#per-drag-and-drop-hochladen) für das vollständige Muster.

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
});
```

### Dirty-State-Tracking

```ts
const editor = await init({
  container: '#editor',
  onDirtyChange(isDirty) {
    updateSaveButton(isDirty);
  },
});
```

Der Editor warnt bereits beim Schließen des Tabs, sofern ein `templates`-Provider konfiguriert ist — abschaltbar über `unsavedChangesGuard: false`. `onDirtyChange` brauchen Sie für einen clientseitigen Router, den `beforeunload` nicht sieht.
