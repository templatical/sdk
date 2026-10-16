---
title: Bilder
description: Behandeln Sie Bildeingaben, integrieren Sie benutzerdefinierte Medien-Picker und konfigurieren Sie die Eigenschaften von Bildblöcken.
---

# Bilder

Wenn ein Benutzer einen Bildblock hinzufügt, zeigt der Editor ein Textfeld an, in das er eine Bild-URL einfügen kann. Die Symbolleiste des Bildblocks stellt Felder für `src`, `alt`, `width`, `align` und eine optionale `linkUrl` bereit.

<img src="/images/image-fields.png" alt="Felder des Bildblocks" style="max-width: 360px;" />

## Durchsuchen und auswählen {#browse-and-pick}

Eine Durchsuchen-Schaltfläche erscheint neben der URL-Eingabe, sobald **entweder** ein [`media`](/de/backend/media)-Provider **oder** `onRequestMedia` konfiguriert ist.

<img src="/images/image-picker.png" alt="Schaltfläche des Medien-Pickers" style="max-width: 360px;" />

`media` öffnet das eingebaute Bibliotheks-Modal. `onRequestMedia` ist eine **UI-Überschreibung** (Bynder, Cloudinary-Widget, ein Host-Modal): Der Editor ruft sie auf, statt die Bibliothek zu öffnen, und sie hat Vorrang, wenn beide gesetzt sind. Geben Sie ein `MediaResult` zurück oder `null`, wenn der Benutzer abbricht. Wenn `alt` angegeben ist, füllt der Editor den Alternativtext des Bildes aus.

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

Eine eigene Galerie ist der Schlüssel `media` — siehe [Medien](/de/backend/media).

[Im Playground öffnen](https://play.templatical.com/scenes/media-on-request)

Die Typsignatur:

```ts
interface MediaResult {
  url: string;
  alt?: string;
  /** Die Größe der Datei in px, falls bekannt. Speist die Seitenverhältnis-Sperre des Bildes. */
  width?: number;
  height?: number;
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

type OnRequestMedia = (context?: MediaRequestContext) => Promise<MediaResult | null>;
```

## Per Drag-and-Drop hochladen

Benutzer können eine Bilddatei von ihrem Computer direkt auf einen Bildblock (leer oder gefüllt), das Bildfeld in der Seitenleiste oder das Bildfeld eines benutzerdefinierten Blocks ziehen.

Mit `onRequestMedia` ruft der Editor diesen Handler mit der abgelegten Datei in `context.files` auf:

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

Mit einem `media`-Provider und ohne Callback geht der Drop an `provider.create({ file, templateId? })`, sofern `create` eine Funktion ist. `create: false` blendet den Drop-Hinweis aus: Die Bibliothek bleibt durchsuchbar.

Einige Hinweise:

- **Eine Datei pro Drop.** `files` ist aus Gründen der Vorwärtskompatibilität ein Array, aber der Editor sendet derzeit eine einzelne Datei (`files[0]`).
- **Nur Bilder.** Der Editor filtert abgelegte Dateien vor dem Aufruf auf Bild-MIME-Typen.
- **Keine Auswahl, kein Drop.** Ohne `onRequestMedia` und ohne einen `media`-Provider, dessen `create` eine Funktion ist, erscheint kein Drop-Hinweis und Drops werden ignoriert.
- **Keine `blob:`-URL zurückgeben.** `URL.createObjectURL(file)` ist sitzungslokal und bricht den Export. Laden Sie die Datei hoch und geben Sie eine dauerhafte URL (oder eine `data:`-URL) zurück.

Mit einem `media`-Provider, dessen `create` eine Funktion ist, werden abgelegte Dateien über diesen Provider hochgeladen — kein `onRequestMedia` nötig. Ein eigener Handler hat weiterhin Vorrang.

## Reine Anzeige-Auflösung von Bild-URLs {#reine-anzeige-aufloesung-von-bild-urls}

Manche Integrationen speichern kanonische Bildreferenzen, die nicht direkt anzeigbar sind — zum Beispiel eine offlinefähige Anwendung, deren Vorlagen Bilder über einen einfachen Dateinamen (`logo.png`) referenzieren, anzeigbar nur über kurzlebige `blob:`-URLs aus dem lokalen Speicher. `onRequestMedia` deckt den Medien-Browser-Pfad ab; tippt oder fügt ein Benutzer einen solchen Wert jedoch direkt in das `src`-Feld ein, kann die Arbeitsfläche nichts anzeigen.

Der Callback `resolveImageUrl` schließt diese Lücke. Er bildet einen src-Wert auf eine **Vorschau-URL nur für die Arbeitsfläche** ab — das Inhaltsmodell behält den kanonischen Wert, und `toMjml()` exportiert ihn unverändert:

```ts
const editor = await init({
  container: '#editor',
  async resolveImageUrl(src) {
    const file = await myFileStore.lookup(src);
    return file ? URL.createObjectURL(file) : null;
  },
});
```

Die Typsignatur:

```ts
resolveImageUrl?: (src: string) => string | null | Promise<string | null>;
```

Geben Sie die Vorschau-URL zurück, oder `null` (bzw. den Eingabewert), um den src unverändert zu verwenden.

So ruft der Editor den Callback auf:

- **Einmal pro bestätigtem Wert.** Eingaben im src-Feld werden entprellt, sodass Teilwerte (`lo`, `logo.p`, …) Ihren Resolver nie erreichen.
- **Pro src zwischengespeichert** für die Lebensdauer der Editor-Instanz — derselbe src in mehreren Blöcken wird nur einmal aufgelöst.
- **Fehler werden abgefangen.** Ein geworfener Fehler oder eine abgelehnte Promise wird als „unverändert verwenden" zwischengespeichert; der Editor wiederholt den Aufruf für denselben src nicht. Das gilt auch für *vorübergehende* Fehler: Ein src, dessen Auflösung fehlgeschlagen ist, bleibt unaufgelöst, bis der Editor neu initialisiert wird. Ein Hook zum erneuten Auslösen der Auflösung ist für eine zukünftige Version angedacht.
- **Merge-Tag-srcs werden übersprungen.** Ein src wie <code v-pre>{{product.image}}</code> wird nie an den Resolver übergeben; stattdessen wird die `placeholderUrl` (falls gesetzt) aufgelöst.
- **Video-Thumbnails sind ebenfalls abgedeckt.** Eine explizite Video-`thumbnailUrl` (und die `placeholderUrl` eines Videoblocks) wird auf dieselbe Weise aufgelöst. Automatisch aus einer YouTube-/Vimeo-URL abgeleitete Thumbnails sind bereits echte URLs und werden nie an den Resolver übergeben.
- **Hintergrundbilder sind ebenfalls abgedeckt.** Die `backgroundImage.url` einer Sektion, eines Sektions-Wrappers oder eines Layout-Wrapper-Bands wird auf dieselbe Weise aufgelöst, nur für die Arbeitsfläche. Eine Merge-Tag-Hintergrund-URL wird nie an den Resolver übergeben; die Arbeitsfläche zeigt dafür die Fallback-Farbe des Elements.
- **Bewusst nur für die Anzeige.** Anders als eine `blob:`-URL aus `onRequestMedia` (die im Export landen würde — siehe oben) gelangt eine URL aus `resolveImageUrl` nie in den Vorlageninhalt.

## Eigenschaften des Bildblocks

Der Typ `ImageBlock` definiert alle konfigurierbaren Eigenschaften:

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `src` | `string` | Quell-URL des Bildes |
| `alt` | `string` | Alternativtext für Barrierefreiheit |
| `width` | `number \| 'full'` | Bildbreite in Pixeln oder `'full'` für 100% |
| `height` | `number` (optional) | Bildhöhe in Pixeln. Ohne Angabe wird sie aus der Breite abgeleitet |
| `align` | `'left' \| 'center' \| 'right'` | Horizontale Ausrichtung |
| `borderRadius` | `number` (optional) | Eckenradius in Pixeln. Ohne Angabe oder 0 bleiben die Ecken eckig |
| `decorative` | `boolean` (optional) | Blendet das Bild für Screenreader aus und sendet ein leeres `alt` |
| `linkUrl` | `string` (optional) | Umschließt das Bild mit einem Link |
| `linkOpenInNewTab` | `boolean` (optional) | Öffnet den Link in einem neuen Tab |
| `placeholderUrl` | `string` (optional) | Vorschaubild zur Entwurfszeit, wenn `src` ein Merge-Tag verwendet |
| `naturalWidth` / `naturalHeight` | `number` (optional) | Die eigene Größe der Bilddatei, für die [Seitenverhältnis-Sperre](#aspect-ratio-lock). Wird nie gerendert |

### Höhe

`height` ist optional, und es weglassen ist meist richtig: Die Höhe wird dann aus der Breite abgeleitet und das Bild behält sein Seitenverhältnis. Setzen Sie sie, wenn das Layout eine feste Box braucht -- einen Banner-Platz mit bekannter Größe oder eine Reihe von Bildern, die auf einer Linie liegen müssen.

Werden `width` und `height` gemeinsam gesetzt, wird das Bild auf diese Box **gestreckt**. Es wird nicht beschnitten, denn `object-fit` wird von Outlook und den meisten E-Mail-Clients nicht unterstützt -- die Editor-Leinwand streckt deshalb genauso, statt einen Beschnitt zu versprechen, den der Posteingang nicht liefert. Passen Sie das Verhältnis an das Quellbild an oder skalieren Sie das Asset vor dem Upload.

### Seitenverhältnis-Sperre {#aspect-ratio-lock}

Ist die Größe der Bilddatei bekannt, hat die Zeile „Höhe“ in den Bildeinstellungen einen Verknüpfungsschalter, der die Proportionen des Bildes beibehält. Er ist standardmäßig an. Bei aktiver Sperre setzt eine eingegebene Höhe die Breite (die Höhe mal das Verhältnis der Datei), und die gespeicherte `height` bleibt leer, sodass das Bild auf jedem Bildschirm sein Verhältnis behält. Eine Höhe, die das Bild breiter als seine Spalte machen würde, setzt die Breite auf „Volle Breite“, und das Feld nennt die Höhe, die das Bild dann hat.

Die Größe der Datei ist `naturalWidth` / `naturalHeight` am Block. Eine Auswahl aus der Mediathek füllt sie aus `width` / `height` des Assets oder aus `width` / `height` eines `onRequestMedia`-Ergebnisses. Die Importer für Unlayer und BeeFree füllen sie aus der Quelldatei. Andernfalls misst der Editor das Bild, solange es ausgewählt ist, und speichert die Größe nur mit der Bearbeitung, die sie nutzt. Eine Merge-Tag-`src` benennt keine Datei und erhält daher keine Sperre, außer der Block speichert bereits eine Größe. Ein Bild, das seine gespeicherte `height` streckt, öffnet ohne Sperre; das Einschalten der Sperre entfernt diese Höhe.

::: tip
Eine gespeicherte Höhe unter einer px-Breite staucht das Bild auf jedem Smartphone, das schmaler als diese Breite ist: MJML verkleinert die Breite und behält die angegebene Höhe. Deshalb lässt die Sperre die Höhe auf Automatisch.
:::

### Breite auf Smartphones {#width-on-phones}

Ein Bild mit `'full'` füllt seine Spalte auf jedem Bildschirm. Eine Pixelbreite bleibt auf dem Smartphone erhalten, so wie die mobile Vorschau des Editors sie zeichnet, und schrumpft nur, wenn die Spalte des Smartphones schmaler ist. Ein 120px breites Logo bleibt 120px breit.

Eine Pixelbreite, die den Platz ihrer Spalte erreicht oder überschreitet, wird wie `'full'` gerendert: auf dem Desktop in Spaltenbreite, auf dem Smartphone über die ganze Spalte. Dieser Platz ist die Spalte abzüglich des seitlichen Paddings und Rahmens von Wrapper-Band, Sektion und Bild.

Video-Thumbnails folgen derselben Regel.

::: tip
Wenn die Spalten einer Sektion auf dem Smartphone untereinander rutschen, ist jede Spalte dort breiter als auf dem Desktop. Ein Bild, dessen Breite zwischen beiden liegt, füllt die Spalte auf dem Smartphone, während die mobile Vorschau es in seiner eingestellten Breite zeigt.
:::

### Eckenradius

`borderRadius` rundet die Ecken des Bildes ab, in Pixeln. Ohne Angabe oder bei `0` bleiben die Ecken eckig -- das gilt für jeden bestehenden Block.

Für ein **kreisrundes** Avatar- oder Portraitbild braucht der Block ein quadratisches Quellbild und einen Radius von mindestens der Hälfte seiner gerenderten Größe: Ein 240px-Quadrat benötigt `120`, jeder größere Wert (`999` ist die übliche Kurzform) ergibt denselben Kreis. Ein nicht-quadratisches Bild wird zur Ellipse, da es keinen Beschnitt gibt -- siehe Höhe oben.

Die Unterstützung ist gut, aber nicht vollständig: Apple Mail, iOS Mail, Gmail und Outlook.com setzen es um, Outlook unter Windows ignoriert es und zeigt eckige Ecken. Behandeln Sie es als Progressive Enhancement, nicht als Grundlage eines Layouts.

### Placeholder-URL

Wenn das `src`-Feld ein Merge-Tag enthält (z. B. <code v-pre>{{product.image}}</code>), wird das eigentliche Bild im Editor nicht gerendert. Verwenden Sie `placeholderUrl`, um ein Platzhalterbild im Editor bereitzustellen. Dieser Wert ist in der exportierten Ausgabe nicht enthalten.

## Best Practices

- **Verwenden Sie absolute URLs** -- Relative Pfade werden in E-Mail-Clients nicht aufgelöst. Verwenden Sie immer `https://`-URLs.
- **Bevorzugen Sie PNG oder JPG** -- SVG und WebP haben begrenzte Unterstützung in E-Mail-Clients. Verwenden Sie PNG für Grafiken mit Transparenz und JPG für Fotos.
- **Halten Sie Dateigrößen angemessen** -- Große Bilder verlangsamen das Laden für die Empfänger.
- **Legen Sie immer Alternativtext fest** -- Viele E-Mail-Clients (insbesondere Outlook) blockieren Bilder standardmäßig. Empfänger sehen den Alternativtext, bis sie sich entscheiden, Bilder zu laden.
- **Explizite Breite festlegen** -- E-Mail-Clients rendern Bilder möglicherweise in ihrer Originalgröße, wenn keine Breite angegeben ist, wodurch Ihr Layout auf kleinen Bildschirmen zerstört wird.
- **Höhe nur setzen, wenn sie gebraucht wird** -- Die Breite allein erhält das Seitenverhältnis. Eine Höhe, die nicht zum Verhältnis der Quelle passt, streckt das Bild in jedem Client.
