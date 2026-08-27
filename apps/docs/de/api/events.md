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

## Template-Ereignisse

Ein `templates`-Provider trägt Events über `load` / `create` / `save` hinaus — `onSaved`, `onCreated` und `onLoaded` —, die ausgelöst werden, sobald sich der Editor stabilisiert hat: die Vorlage übernommen, `isDirty` zurückgesetzt, `isSaving`/`isLoading` false.

```ts
const editor = await init({
  container: '#editor',
  templates: {
    load, create, save,
    onSaved(template, { trigger }) {
      if (trigger === 'manual') navigate('/templates');
    },
  },
});
```

Das zweite Argument von `onSaved` benennt, welche Aktion das Speichern ausgelöst hat, sodass ein Handler auf ein vom Nutzer angestoßenes Speichern reagieren kann, ohne bei jedem Autosave-Tick ebenfalls zu reagieren. Die vollständige Referenz finden Sie unter [`TemplatesOptions`](/de/backend/templates#events).

## Kommentar-Ereignisse

Ein `comments`-Provider trägt Events über `list` / `create` / `update` / `delete` / `setResolved` hinaus — `onCreated`, `onUpdated`, `onDeleted`, `onResolved` und `onUnresolved` —, die ausgelöst werden, sobald der Editor die Änderung übernommen hat, gleich ob sie aus einem lokalen Schreibvorgang stammt oder über `subscribe` eingetroffen ist.

```ts
const editor = await init({
  container: '#editor',
  user: { id: 'u_7', name: 'Ada Lovelace' },
  comments: {
    ...myCommentsProvider,
    onCreated(comment, { origin }) {
      if (origin === 'remote') incrementUnread();
    },
  },
});
```

Das zweite Argument jedes Handlers trägt `origin` — `'local'` für einen Schreibvorgang, den dieser Editor selbst ausgeführt hat, `'remote'` für einen, der über `subscribe` eingetroffen ist. Die vollständige Referenz, einschließlich welcher der beiden Handler `onResolved` / `onUnresolved` auslöst, finden Sie unter [Events](/de/backend/comments#events).

## Ereignisse für gespeicherte Blöcke

Ein `savedBlocks`-Provider trägt Events über `list` / `create` / `update` / `delete` hinaus — `onCreated`, `onUpdated` und `onDeleted` —, die ausgelöst werden, sobald der Editor die Änderung in seiner eigenen Liste übernommen hat.

```ts
const editor = await init({
  container: '#editor',
  savedBlocks: {
    ...mySavedBlocksProvider,
    onDeleted(block) {
      logRemoval(block.id);
    },
  },
});
```

`onDeleted` erhält den entfernten `SavedBlock` selbst, keine ID — `delete` löst zu nichts auf, daher übergibt der Editor den Eintrag, den er vor dem Entfernen erfasst hat. Die vollständige Referenz finden Sie unter [Events](/de/backend/saved-blocks#events).

## Versionsverlauf-Ereignisse

Ein `versionHistory`-Provider trägt Events über `list` / `get` / `create` / `restore` hinaus — `onCreated` und `onRestored` —, die ausgelöst werden, sobald `create()` oder `restore()` auflöst.

```ts
const editor = await init({
  container: '#editor',
  versionHistory: {
    ...myVersionHistoryProvider,
    onRestored(template) {
      navigate(`/templates/${template.id}`);
    },
  },
});
```

`onRestored` erhält das resultierende `Template`, zu dem `restore()` auflöst, nicht die `TemplateVersion`, aus der wiederhergestellt wurde. Die vollständige Referenz finden Sie unter [Events](/de/backend/version-history#events).

## Test-E-Mail-Ereignisse

Ein `testEmail`-Provider trägt ein Event über `send` hinaus — `onSent` —, das ausgelöst wird, sobald ein Versand auflöst, mit derselben Nutzlast, die `send` erhalten hat.

```ts
const editor = await init({
  container: '#editor',
  testEmail: {
    ...myTestEmailProvider,
    onSent(payload) {
      trackEvent('test_email_sent', { recipient: payload.recipient });
    },
  },
});
```

Wird bei einem abgelehnten Versand nicht aufgerufen — das zeigt stattdessen die eigene Inline-Fehlermeldung des Dialogs. Die vollständige Referenz finden Sie unter [Events](/de/backend/test-email#events).

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

Der Editor warnt bereits beim Schließen des Tabs, sofern ein `templates`-Provider konfiguriert ist — abschaltbar über `templates: { unsavedChangesGuard: false }`. `onDirtyChange` brauchen Sie für einen clientseitigen Router, den `beforeunload` nicht sieht.
