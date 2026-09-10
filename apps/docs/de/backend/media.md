---
title: Medien
description: Hinterlegen Sie die Bildauswahl des Editors mit Ihrer eigenen Galerie, DAM oder CMS — oder nutzen Sie den mitgelieferten browserlokalen Speicher.
---

# Medien

Der Editor übernimmt die Auswahl: Durchsuchen an Bildfeldern, Video-Thumbnails und Bildfeldern benutzerdefinierter Blöcke, Drag-and-Drop-Upload, Zuschnitt, Ordner, Suche. **Der Speicher liegt bei Ihnen.**

`onRequestMedia` ist eine eigene Schnittstelle — eine UI-Überschreibung für ein Host-Widget (Bynder, Cloudinary, ein eigenes Modal). Das ist nicht dieser Speicher. Sind beide gesetzt, hat der Callback Vorrang und das eingebaute Modal öffnet sich nie. Siehe [Bilder](/de/guide/images).

## Schnellstart

Der mitgelieferte browserlokale Provider braucht kein Backend:

```js
import { init, createLocalStorageMediaProvider } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  media: createLocalStorageMediaProvider(),
});
```

Einträge landen im `localStorage` unter `templatical:media`. `create` speichert die Datei als Data-URL — ein Modell in Demo-Größe. `localStorage`-Kontingente liegen typischerweise bei etwa 5 MB, und ein paar große Bilder füllen das. Ordner, Ersetzen, Import, Verwendung, häufig verwendet und Kontingent sind `false`. Für alles jenseits von Demos, Prototypen und einem einzelnen Gerät liefern Sie einen Provider.

## Der Vertrag

`media` akzeptiert jedes Objekt, das `MediaProvider` implementiert. `list` ist eine Methode; jedes andere Mitglied ist **entweder eine Funktion oder `false`**:

```ts
interface MediaProvider {
  list(params?: MediaListParams): Promise<MediaListPage>;

  create: false | ((input: MediaCreateInput) => Promise<MediaAsset>);
  update: false | ((id: string, patch: MediaAssetPatch) => Promise<MediaAsset>);
  delete: false | ((ids: string[]) => Promise<void>);
  folders: false | MediaFoldersProvider;
  replace: false | ((id: string, file: File) => Promise<MediaAsset>);
  importFromUrl:
    | false
    | ((url: string, folderId?: string | null, templateId?: string) => Promise<MediaAsset>);
  checkUsage: false | ((ids: string[]) => Promise<Record<string, MediaUsageInfo>>);
  frequentlyUsed: false | (() => Promise<MediaAsset[]>);
  storage: false | (() => Promise<MediaStorageInfo | null>);
}

interface MediaFoldersProvider {
  list(): Promise<MediaFolder[]>; // FLACH; die Oberfläche baut den Baum über parentId
  create: false | ((input: MediaFolderInput) => Promise<MediaFolder>);
  update: false | ((id: string, patch: { name: string }) => Promise<MediaFolder>);
  delete: false | ((id: string) => Promise<void>);
  move: false | ((ids: string[], folderId: string | null) => Promise<MediaAsset[]>);
}
```

`false` bedeutet, dass die aktuelle Person diese Aktion nicht ausführen darf; der Editor blendet das Bedienelement aus.

`list` kann nicht `false` sein: ohne es hätte die Auswahl nichts zu zeigen. Suche, Ordner, Kategorie und Cursor werden bei jedem Listing mitgeschickt — Galerien wachsen über eine Antwort hinaus. Ein Provider, der alles auf einmal zurückgibt, lässt `nextCursor` weg.

`delete` und `checkUsage` sind gesammelt: Das Raster ist Mehrfachauswahl. `folders` ist verschachtelt, sodass eine Galerie ohne Ordner einmal `folders: false` schreibt; `folders.list()` gibt ein **flaches** Array zurück, und die Oberfläche baut den Baum über `parentId`.

Der Zuschnitt geschieht im Client. Einen Zuschnitt persistieren Sie, indem Sie `create` oder `replace` mit der entstandenen `File` aufrufen. Es gibt keine Crop-Methode am Provider und keinen Fortschritts-Callback: `create` nimmt eine `File` und löst mit dem Asset auf.

Bestätigen setzt immer `asset.url` ein. Das Raster verwendet `thumbnailUrl`, ersatzweise `url`. Auf `MediaAsset` gibt es keine Conversion-Menge (`small` / `medium` / `large`) — gehört ein Derivat in die E-Mail, setzen Sie diese URL auf `url`.

### Die Datenstruktur

```ts
interface MediaAsset {
  id: string;              // vom Provider zugewiesen, von create() zurückgegeben
  url: string;             // landet auf dem Block
  alt?: string;
  filename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  size?: number;           // Bytes
  thumbnailUrl?: string;   // Raster; fällt auf url zurück
  folderId?: string | null;
  canUpdate?: boolean;     // optional — fehlt = erlaubt; false verbietet
  canDelete?: boolean;
  createdAt?: string;      // optional — nur Anzeige, ohne Einfluss auf die Reihenfolge
  updatedAt?: string;
}

interface MediaListParams {
  search?: string;
  cursor?: string;
  folderId?: string | null;
  category?: MediaCategory;   // "images" | "documents" | "videos" | "audio"
  templateId?: string;        // wenn eine Vorlage geladen ist; Cloud ignoriert
}

interface MediaListPage {
  items: MediaAsset[];
  nextCursor?: string;
}

interface MediaCreateInput {
  file: File;
  folderId?: string | null;
  alt?: string;
  filename?: string;
  templateId?: string;
}
```

- **Die `id` kommt vom Provider.** Der Editor erzeugt nie eine eigene, sondern verwendet, was `create()` zurückgibt.
- **`templateId` ist opportunistisch.** Wird bei `list` / `create` / `importFromUrl` übergeben, wenn eine Vorlage geladen ist; auf einer leeren Arbeitsfläche weggelassen. Medien sind nicht daran gebunden. Cloud ignoriert es; ein CMS, das eine Galerie pro Vorlage abgrenzt, liest es hier.
- **Die Reihenfolge kommt vom Provider.** Der Editor stellt die Reihenfolge von `list()` dar und sortiert nie um.
- **Zeitstempel dienen nur der Anzeige.** Lassen Sie beide weg, entfällt die Angabe.
- **`maxFileSize` / `mimeTypes`** am Provider sind eine clientseitige Vorprüfung, keine Sicherheitsgrenze — das Backend muss zusätzlich durchsetzen.

```ts
interface MediaOptions {
  maxFileSize?: number; // Bytes
  mimeTypes?: Partial<Record<MediaCategory, string[]>>;
  onCreated?: (asset: MediaAsset) => void;
  onUpdated?: (asset: MediaAsset) => void;
  onDeleted?: (asset: MediaAsset) => void;
}
```

`MediaProvider` erweitert `MediaOptions`, sodass ein Objekt Speicher und Events trägt.

## Berechtigungen steuern

**Eine ganze Fähigkeit vorenthalten**, indem Sie `false` statt einer Funktion übergeben. Der Editor blendet aus, was er nicht kann — keine Upload-Zone und kein Drop, wenn `create` aus ist, kein Bearbeiten bei `update: false`, kein Löschen bei `delete: false`, kein Ordnerbaum bei `folders: false`.

```ts
const media: MediaProvider = {
  list: ({ search, cursor, templateId }) =>
    myCms.page({ search, cursor, templateId }),
  create: ({ file }) => myCms.upload(file),
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};
```

**Einen einzelnen Eintrag ausnehmen**, indem Sie `canUpdate` / `canDelete` mitliefern. Fehlt der Wert, ist die Aktion erlaubt — setzen Sie sie also nur bei den Ausnahmen. Die beiden Hebel greifen nur in einer Richtung zusammen: `canUpdate: true` kann ein vom Provider als `false` übergebenes `update` nicht wieder aktivieren.

### Eine schreibgeschützte Bibliothek

Setzen Sie jede Mutation auf `false`, erhalten Sie eine kuratierte Galerie, die Nutzer durchsehen, durchsuchen und auswählen, aber nie verändern können:

```ts
const media: MediaProvider = {
  list: async () => {
    const res = await fetch('/api/media');
    return json(res);
  },
  create: false,
  update: false,
  delete: false,
  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};
```

Das Auswählen funktioniert weiterhin — es kopiert `{ url, alt }` auf die Arbeitsfläche, und den Provider erreicht dabei nichts. Drop nicht: Drop braucht `create`. `list` ist das einzige Mitglied, das sich nicht abschalten lässt.

::: warning Keine Sicherheitsgrenze
Ein ausgeblendetes Element verhindert, dass der Editor die Aktion anbietet — es hält niemanden auf, der es darauf anlegt. Berechtigungen müssen zusätzlich serverseitig erzwungen werden: Die Provider-Methoden laufen im Browser der Nutzenden — auch dafür, wer ein Asset in einer im Team geteilten Bibliothek lesen, ändern oder löschen darf.
:::

## Fehlerbehandlung

Jede Methode kann ablehnen. Der Editor meldet den Fehler über `onError` und lässt seine Liste im Speicher unverändert — ein fehlgeschlagenes Löschen lässt ein Asset also nicht aus der Oberfläche verschwinden. Das Modal bleibt offen. Provider-Meldungen sind für die Person lesbar: Sie landen wortgleich in der Oberfläche.

Ein fehlgeschlagenes `create` stellt nichts voran. `importFromUrl` behält einen Inline-Fehler am Feld.

## Im Editor

Die Oberfläche ist eine **Auswahl**. Es gibt keine Leiste und kein „Medien verwalten"-Chrome.

- **Durchsuchen** — ein Bildfeld (und das Video-Thumbnail und ein Bildfeld eines benutzerdefinierten Blocks) zeigt eine Durchsuchen-Schaltfläche, sobald `media` **oder** `onRequestMedia` konfiguriert ist. Mit einem `media`-Provider und ohne Callback öffnet der Klick das Bibliotheks-Modal. Mit `onRequestMedia` läuft der Callback stattdessen — das Modal wird nie gemountet. Bildfelder und das Video-Thumbnail übergeben `accept: ["images"]`; benutzerdefinierte Blöcke können andere Kategorien übergeben. Das Modal zwingt `list({ category })` auf diese Menge und blendet andere Tabs aus.
- **Bestätigen** — Bestätigen oder Doppelklick übernimmt **ein** in der Vorschau gezeigtes Asset, das zu `accept` passt, als `{ url: asset.url, alt: asset.alt }`. Mehrfachauswahl gilt nur für gesammeltes Löschen und Verschieben. Schließen, Escape oder Backdrop gibt `null` zurück.
- **Drop** — eine Bilddatei auf einen Bildblock oder ein Bildfeld ziehen:

  | Konfiguration | Drop |
  | --- | --- |
  | `onRequestMedia` | ja — `context.files` |
  | Provider, `create` ist eine Funktion | ja — `provider.create({ file, templateId? })` |
  | Provider, `create: false` | nein |
  | keines von beiden | nein |

  Die Drop-Zone filtert zuvor auf MIME-Typen `image/`. Größe und Typ danach sind `MediaOptions`, dann der Server. Geben Sie keine `blob:`-URL zurück: `URL.createObjectURL(file)` ist sitzungslokal und bricht den Export.
- **Verzögertes Laden** — lassen Sie `media` weg, wird keine Bibliotheks-Oberfläche geladen. `onRequestMedia` allein mountet das Modal nie.

## Standardmäßig deaktiviert

Lassen Sie `media` weg, bleiben Bildfelder URL-only, sofern Sie nicht `onRequestMedia` übergeben haben.

## Events

```ts
media: {
  // ...list, create, update, delete, …
  onCreated: (asset) => {},
  onUpdated: (asset) => {},
  onDeleted: (asset) => {},
}
```

Jedes löst aus, sobald die zugehörige Mutation auflöst, mit dem gespeicherten Asset:

- **`onCreated`** nach `create` oder `importFromUrl`. Ein Drop ruft `create` auf und löst dies aus, ohne das Modal zu öffnen und ohne eine Listenzeile voranzustellen — die URL landet auf dem Block.
- **`onUpdated`** nach `update` oder `replace`.
- **`onDeleted`** nach `delete`.

Es gibt keine medienbezogene Liste auf Editor-Ebene. Die eigene Listing des Modals (wenn es offen ist) stellt bei Erfolg voran, ersetzt und filtert; ein Drop berührt diese Listing nie.

::: tip `onDeleted` trägt das Asset, keine ID
`delete` löst zu nichts auf, daher erhält der Handler den Eintrag, den das Modal unmittelbar vor dem Entfernen aus seiner geladenen Listing erfasst hat.
:::

::: tip Ein Löschen außerhalb der geladenen Listing löst kein Event aus
Der erfasste Eintrag muss bereits in der Listing des Modals vorhanden sein. Das Löschen einer ID, die diese Listing nie gehalten hat, löscht weiterhin erfolgreich; es gibt dann aber nichts, das an `onDeleted` übergeben werden könnte, weshalb es nicht auslöst.
:::

Eine Handler-Funktion, die einen Fehler wirft, wird abgefangen und an `onError` gemeldet — sie lässt das auslösende Erstellen, Aktualisieren oder Löschen nie fehlschlagen.

## Headless-Nutzung

Es gibt kein `useMedia` in `@templatical/core`. Der Medienzustand ist an das Modal gebunden; die Provider-Methoden **sind** die Headless-API. Rufen Sie sie aus Ihrer eigenen Oberfläche auf, oder steuern Sie die Zustandsmaschine des mitgelieferten Modals:

```ts
import { useMediaLibrary } from '@templatical/media-library';

const {
  items,          // Ref<MediaAsset[]>
  isLoading,      // Ref<boolean>
  hasMore,        // Ref<boolean>
  loadItems,      // () => Promise<void>
  loadMore,       // () => Promise<void>
  uploadFile,     // (file: File) => Promise<MediaAsset | null>
  confirmDelete,  // () => Promise<void>
} = useMediaLibrary({
  provider,
  onError: (error) => {
    /* behandeln */
  },
});
```

Die Liste bleibt nach jedem erfolgreichen Aufruf synchron — beim Erstellen vorangestellt, beim Aktualisieren ersetzt, beim Löschen entfernt — und Fehler werden an `onError` gemeldet, ohne die Liste bei einem Fehlschlag zu verändern. Eine veraltete `list`- / `loadMore`-Antwort wird verworfen.

**Sie nutzen Templatical Cloud?** Cloud implementiert diesen Vertrag ohne jede Konfiguration — siehe [Medienbibliothek auf Cloud](/de/cloud/media-library).

## Eigene Implementierung

Eine minimale REST-Implementierung:

```ts
import { init } from '@templatical/editor';
import type { MediaProvider } from '@templatical/editor';

const json = async (res: Response) => {
  if (!res.ok) throw new Error(`Medienanfrage fehlgeschlagen: ${res.status}`);
  return res.json();
};

const media: MediaProvider = {
  list: async (params) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.folderId) query.set('folderId', params.folderId);
    if (params?.category) query.set('category', params.category);
    if (params?.templateId) query.set('templateId', params.templateId);
    const res = await fetch(`/api/media?${query}`);
    return json(res);
  },

  create: async (input) => {
    const body = new FormData();
    body.append('file', input.file);
    if (input.folderId) body.append('folderId', input.folderId);
    if (input.templateId) body.append('templateId', input.templateId);
    const res = await fetch('/api/media', { method: 'POST', body });
    return json(res);
  },

  update: async (id, patch) => {
    const res = await fetch(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return json(res);
  },

  delete: async (ids) => {
    const res = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Löschen fehlgeschlagen: ${res.status}`);
  },

  folders: false,
  replace: false,
  importFromUrl: false,
  checkUsage: false,
  frequentlyUsed: false,
  storage: false,
};

await init({ container: '#editor', media });
```

Eine CMS-Galerie, die listet und hochlädt und sonst nichts, hat dieselbe Form wie das Berechtigungsbeispiel oben. Geteilte und vorlagenspezifische Galerien führen Sie in `list({ templateId })` zusammen.
