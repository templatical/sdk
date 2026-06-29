---
title: Bilder
description: Behandeln Sie Bildeingaben, integrieren Sie benutzerdefinierte Medien-Picker und konfigurieren Sie die Eigenschaften von Bildblöcken.
---

# Bilder

Wenn ein Benutzer einen Bildblock hinzufügt, zeigt der Editor ein Textfeld an, in das er eine Bild-URL einfügen kann. Die Symbolleiste des Bildblocks stellt Felder für `src`, `alt`, `width`, `align` und eine optionale `linkUrl` bereit.

<img src="/images/image-fields.png" alt="Felder des Bildblocks" style="max-width: 360px;" />

## Benutzerdefinierter Medien-Picker

Wenn der Callback `onRequestMedia` bereitgestellt wird, erscheint eine Durchsuchen-Schaltfläche neben der URL-Eingabe.

<img src="/images/image-picker.png" alt="Schaltfläche des Medien-Pickers" style="max-width: 360px;" />

Der Editor ruft diese Funktion auf, wenn der Benutzer auf die Schaltfläche klickt. Geben Sie ein `MediaResult`-Objekt zurück oder `null`, wenn der Benutzer abbricht. Wenn `alt` angegeben ist, füllt der Editor automatisch den Alternativtext des Bildes aus.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  async onRequestMedia() {
    // Öffnen Sie Ihr eigenes Modal, Ihren Datei-Browser oder Asset-Manager
    const image = await openMyMediaModal();
    if (!image) return null;

    return { url: image.url, alt: image.alt };
  },
});
```

Die Typsignatur:

```ts
interface MediaResult {
  url: string;
  alt?: string;
}

interface MediaRequestContext {
  /** Medienkategorien, die der Editor anfordert (z. B. `['images']`). */
  accept?: MediaCategory[];
  /**
   * Dateien, die direkt auf einen Bildblock oder ein Bildfeld gezogen wurden.
   * Nur bei Drag-and-Drop-Anfragen vorhanden; nicht, wenn der Benutzer auf
   * „Medien durchsuchen“ klickt.
   */
  files?: File[];
}

onRequestMedia?: (context?: MediaRequestContext) => Promise<MediaResult | null>;
```

## Per Drag-and-Drop hochladen

Benutzer können eine Bilddatei von ihrem Computer direkt auf einen Bildblock (leer oder gefüllt), das Bildfeld in der Seitenleiste oder das Bildfeld eines benutzerdefinierten Blocks ziehen. Dabei ruft der Editor **denselben** `onRequestMedia`-Handler auf — jedoch mit der abgelegten Datei in `context.files`:

```ts
const editor = await init({
  container: '#editor',
  async onRequestMedia(context) {
    // Eine Datei wurde abgelegt — laden Sie sie hoch und geben Sie die URL zurück.
    if (context?.files?.length) {
      const url = await uploadToMyBackend(context.files[0]);
      return { url };
    }

    // Keine Datei — der Benutzer hat auf „Medien durchsuchen“ geklickt.
    const image = await openMyMediaModal();
    return image ? { url: image.url, alt: image.alt } : null;
  },
});
```

Der Editor lädt selbst nichts hoch — er übergibt Ihnen die `File` und verwendet die zurückgegebene URL, genau wie beim „Medien durchsuchen“-Pfad. Einige Hinweise:

- **Eine Datei pro Drop.** `files` ist aus Gründen der Vorwärtskompatibilität ein Array, aber der Editor sendet derzeit eine einzelne Datei (`files[0]`).
- **Nur Bilder.** Der Editor filtert abgelegte Dateien vor dem Aufruf auf Bild-MIME-Typen.
- **Kein Handler, kein Drop.** Ist `onRequestMedia` nicht gesetzt, erscheint kein Drop-Hinweis und Drops werden ignoriert.
- **Keine `blob:`-URL zurückgeben.** `URL.createObjectURL(file)` ist sitzungslokal und bricht den Export. Laden Sie die Datei hoch und geben Sie eine dauerhafte URL (oder eine `data:`-URL) zurück.

Bei [Cloud-Editoren](/de/cloud/media-library) werden abgelegte Dateien automatisch in Ihre Templatical-Medienbibliothek hochgeladen — kein `onRequestMedia` nötig (ein eigener Handler hat weiterhin Vorrang).

## Eigenschaften des Bildblocks

Der Typ `ImageBlock` definiert alle konfigurierbaren Eigenschaften:

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `src` | `string` | Quell-URL des Bildes |
| `alt` | `string` | Alternativtext für Barrierefreiheit |
| `width` | `number \| 'full'` | Bildbreite in Pixeln oder `'full'` für 100% |
| `align` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |
| `linkUrl` | `string` (optional) | Umschließt das Bild mit einem Link |
| `linkOpenInNewTab` | `boolean` (optional) | Öffnet den Link in einem neuen Tab |
| `placeholderUrl` | `string` (optional) | Vorschaubild zur Entwurfszeit, wenn `src` ein Merge-Tag verwendet |

### Placeholder-URL

Wenn das `src`-Feld ein Merge-Tag enthält (z. B. <code v-pre>{{product.image}}</code>), wird das eigentliche Bild im Editor nicht gerendert. Verwenden Sie `placeholderUrl`, um ein Platzhalterbild im Editor bereitzustellen. Dieser Wert ist in der exportierten Ausgabe nicht enthalten.

## Best Practices

- **Verwenden Sie absolute URLs** -- Relative Pfade werden in E-Mail-Clients nicht aufgelöst. Verwenden Sie immer `https://`-URLs.
- **Bevorzugen Sie PNG oder JPG** -- SVG und WebP haben begrenzte Unterstützung in E-Mail-Clients. Verwenden Sie PNG für Grafiken mit Transparenz und JPG für Fotos.
- **Halten Sie Dateigrößen angemessen** -- Große Bilder verlangsamen das Laden für die Empfänger.
- **Legen Sie immer Alternativtext fest** -- Viele E-Mail-Clients (insbesondere Outlook) blockieren Bilder standardmäßig. Empfänger sehen den Alternativtext, bis sie sich entscheiden, Bilder zu laden.
- **Explizite Breite festlegen** -- E-Mail-Clients rendern Bilder möglicherweise in ihrer Originalgröße, wenn keine Breite angegeben ist, wodurch Ihr Layout auf kleinen Bildschirmen zerstört wird.
