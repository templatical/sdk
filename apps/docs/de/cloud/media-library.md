---
title: Medienbibliothek
description: Bilder hochladen, organisieren und verwalten – mit Ordnern und Suche.
---

# Medienbibliothek

Die Cloud-Medienbibliothek stellt ein vollständiges Bildmanagementsystem bereit, das in den Editor integriert ist. Nutzer können Bilder hochladen, organisieren, durchsuchen und einfügen, ohne den Editor zu verlassen.

## Funktionen

- **Upload** – Bilder direkt im Editor per Drag-and-Drop oder Klick hochladen
- **Ordner** – Bilder in einer Ordnerhierarchie organisieren
- **Suche** – Bilder nach Name oder Metadaten finden
- **Bildbearbeitung** – Bilder zuschneiden, skalieren und ersetzen
- **Verwendungs-Tracking** – Vor dem Löschen sehen, welche Templates ein Bild verwenden
- **Import aus URL** – Bilder von externen URLs in die Bibliothek übernehmen
- **Speicherinformationen** – Speicherverbrauch pro Plan überwachen

Die Medienbibliothek ist bei Verwendung von `initCloud()` automatisch verfügbar. Es ist keine zusätzliche Konfiguration erforderlich.

## Eigener Media-Picker

Wenn Sie statt der integrierten Bibliothek Ihren eigenen Media-Picker verwenden möchten, geben Sie den Callback `onRequestMedia` an:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onRequestMedia: async (context) => {
    // Eigenen Media-Picker öffnen
    const selected = await myMediaPicker.open();

    if (!selected) return null;

    return {
      id: selected.id,
      url: selected.url,
      filename: selected.filename,
      width: selected.width,
      height: selected.height,
    };
  },
});
```

## Standalone-SDK der Medienbibliothek

Die Medienbibliothek ist außerdem als eigenständige Komponente für die Verwendung außerhalb des Editors über das Paket `@templatical/media-library` verfügbar:

```js
import { init } from '@templatical/media-library';

const mediaLibrary = init({
  container: '#media-library',
  auth: {
    mode: 'proxy',
    url: '/api/templatical/token',
  },
  onSelect: (item) => {
    console.log('Selected:', item.url);
  },
});
```

## API-Client

Für serverseitige oder programmatische Medien-Operationen:

```js
import { MediaApiClient } from '@templatical/media-library';

const client = new MediaApiClient(authManager);

// Bilder durchsuchen
const response = await client.browseMedia({ folder_id: 'folder-id', search: 'hero', category: 'images' });
// response: { data: MediaItem[], meta: { path, per_page, next_cursor, prev_cursor } }

// Upload
const item = await client.uploadMedia(file, folderId);

// Löschen (akzeptiert ein Array von IDs)
await client.deleteMedia(['item-id-1', 'item-id-2']);

// Vor dem Löschen die Nutzung prüfen (akzeptiert ein Array von IDs)
const usage = await client.checkMediaUsage(['item-id-1']);
```
