---
title: Medienbibliothek
description: Templatical Cloud als eine Implementierung des Speicher-Vertrags für Medien.
---

# Medienbibliothek

Medien sind ein [offener Vertrag](/de/backend/media). Templatical Cloud implementiert ihn genauso, wie Ihr eigenes Backend es täte.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nichts zu konfigurieren — diese Funktion ist standardmäßig an. Cloud stellt den Provider bereit, und Durchsuchen erscheint an Bildfeldern, Video-Thumbnails und Bildfeldern benutzerdefinierter Blöcke.

## Der Adapter

| Methode | Cloud |
| --- | --- |
| `list` | Projektbibliothek, Suche / Ordner / Kategorie / Cursor werden weitergereicht |
| `create` | Lädt die Datei ins Projekt hoch |
| `update` | Dateiname und Alternativtext |
| `delete` | Gesammeltes Entfernen |
| `folders` | Verschachtelte Ordner; Cloud flacht eine Baum-Antwort auf die flache Liste des Vertrags ab |
| `replace` | Ersetzt die Datei an Ort und Stelle |
| `importFromUrl` | Übernimmt eine entfernte URL in die Bibliothek |
| `checkUsage` | Vorlagen, die die Assets referenzieren |
| `frequentlyUsed` | Zuletzt verwendet für die aktuelle Person |
| `storage` | Kontingent-Ring; `null`, bis die Plan-Konfiguration geladen ist |

**Eine Bibliothek pro Projekt**, geteilt von allen Beteiligten. Cloud **ignoriert `templateId`**: Der Speicher ist projektskopiert.

Jede Methode ist eine Funktion. `storage`, `maxFileSize` und `mimeTypes` sind **lebende Getter** über die Plan-Konfiguration — sie füllen sich nach der Konstruktion, sodass ein Schnappschuss beim Setup das Kontingent für die ganze Sitzung auf `null` festnageln würde.

Wenn Clouds Speicher im Spiel ist, werden `maxFileSize` / `mimeTypes` an einem reinen Events-Objekt ignoriert (Clouds Plan besitzt diese Limits). Nur `onCreated` / `onUpdated` / `onDeleted` werden weitergereicht.

## Eigene Implementierung

Das geht, und `initCloud()` nimmt dies als vollständigen Ersatz an, genauso wie `savedBlocks` und `testEmail`. Der Schlüssel hat denselben Typ wie bei `init()`, dazu eine dritte Form, die nur an diesem Einstiegspunkt existiert: Clouds Bibliothek behalten und eigene Event-Handler hinzufügen.

```ts
await initCloud({ container, auth });                        // Clouds Bibliothek
await initCloud({ container, auth, media: { onCreated } });  // Clouds Bibliothek, plus Ihre Events
await initCloud({ container, auth, media: mine });           // Ihre eigene, auf Cloud
await initCloud({ container, auth, media: false });          // aus — nur URL-Feld
```

<!-- prettier-ignore -->
| `media` | Speicher |
| --- | --- |
| weggelassen | Cloud |
| `false` | aus |
| Optionen (`{ onCreated }`) | Cloud, plus diese Handler |
| vollständiger Provider | Ihrer, **nicht** plangebunden |

Cloud unterscheidet sie an `list`, nie daran, ob der Wert ein Objekt ist: Alles mit einem funktionierenden `list` ersetzt Clouds Speicher vollständig, und alles andere — `false`, ein reines Events-Objekt — behält Clouds eigenen Speicher und leitet dessen Events an ihn weiter.

Ein Provider, den Sie übergeben, ist **nicht** plangebunden — der Plan lizenziert Clouds *Speicher*, nicht die Oberfläche des Editors. Ein reines Events-Objekt nutzt weiterhin Clouds Speicher.

Ein missgebildetes Objekt, das `create` (oder andere Mutationen) hat, aber kein funktionierendes `list`, fällt auf Clouds Speicher zurück, mit einer Warnung, die die ignorierten Methoden nennt.

## UI-Überschreibung

`onRequestMedia` ist ein Host-Widget (Bynder, Cloudinary, ein eigenes Modal). Das ist nicht der Speicher. Sind beide gesetzt, hat der Callback Vorrang und Clouds Modal öffnet sich nie. Rückgabe ist `{ url, alt? }` — siehe [Bilder](/de/guide/images).

```ts
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  onRequestMedia: async (context) => {
    const selected = await myMediaPicker.open(context);
    if (!selected) return null;
    return { url: selected.url, alt: selected.alt };
  },
});
```

## Standalone

Dieselbe Oberfläche, ohne Bestätigen, über `@templatical/media-library`. Übergeben Sie einen `provider` — Cloud ist `createCloudMediaProvider` aus `@templatical/core/cloud`:

```ts
import { init } from '@templatical/media-library';
import { createCloudMediaProvider } from '@templatical/core/cloud';

const mediaLibrary = await init({
  container: '#media-library',
  provider: createCloudMediaProvider(authManager),
  onSelect: (asset) => {
    console.log('Selected:', asset.url);
  },
});
```

`onSelect` ist optional. `accept` grenzt Kategorien ein; weglassen bedeutet jede Kategorie.

## Headless-Nutzung

Für serverseitige oder programmatische Medien-Operationen wird `MediaApiClient` aus `@templatical/core/cloud` exportiert. `createCloudMediaProvider` bildet die Antwort auf `MediaProvider` ab.

```ts
import { MediaApiClient } from '@templatical/core/cloud';

const client = new MediaApiClient(authManager);

const response = await client.browseMedia({ folderId: 'folder-id', search: 'hero', category: 'images' });
const item = await client.uploadMedia(file, folderId);
await client.deleteMedia(['item-id-1', 'item-id-2']);
const usage = await client.checkMediaUsage(['item-id-1']);
```
