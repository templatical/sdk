---
title: Vorlagen speichern & laden
description: Verbinden Sie den Speicher-/Ladezyklus des Editors mit Ihrem eigenen Speicher — inklusive Name, Speichern-Schaltfläche, Autosave und Warnung bei ungespeicherten Änderungen.
---

# Vorlagen speichern & laden

Geben Sie dem Editor einen Ort zum Speichern, und er ergänzt die passende Bedienoberfläche: einen direkt bearbeitbaren Vorlagennamen, eine Speichern-Schaltfläche, eine Statusanzeige, `Cmd`/`Strg`+`S`, optionales Autosave sowie eine Warnung, bevor der Tab mit ungespeicherter Arbeit geschlossen wird.

Das alles übernimmt der Editor. **Die Persistenz liegt bei Ihnen** — drei Methoden gegen Ihre eigene API.

## Schnellstart

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  templates: {
    load: async (id) => {
      const res = await fetch(`/api/templates/${id}`);
      return res.json();
    },

    create: async (input) => {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return res.json();
    },

    save: async (id, patch) => {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      return res.json();
    },
  },
});

// Das Öffnen einer Vorlage erfolgt imperativ — Ihre Anwendung entscheidet, welche.
await editor.load('tpl_123');
```

**Lassen Sie `templates` weg, fehlt die Funktion** — kein Namensfeld, keine Speichern-Schaltfläche, keine Statusanzeige. `create()` / `load()` / `save()` werden dann mit einer erklärenden Fehlermeldung abgelehnt, und Sie speichern den Inhalt selbst über [`onChange`](#speichern-ohne-provider).

## Der Vertrag

```ts
interface Template {
  id: string;
  name?: string;
  content: TemplateContent;
}

type TemplatePatch = Partial<{ name: string; content: TemplateContent }>;

interface TemplatesProvider {
  load(id: string): Promise<Template>;
  create: false | ((input: { name?: string; content: TemplateContent }) => Promise<Template>);
  save:   false | ((id: string, patch: TemplatePatch) => Promise<Template>);
}
```

- **Die `id` kommt aus Ihrem Speicher**, zurückgegeben von `create()`. Der Editor erzeugt nie selbst eine — ein Datenbankschlüssel, ein Slug, eine Dokument-ID, was auch immer Ihr Speicher bereits verwendet.
- **`save` erhält einen Patch**, nicht den bloßen Inhalt. So kann eine Umbenennung ohne Inhalt übertragen werden, und ein künftiges Feld lässt sich ergänzen, ohne Ihre Implementierung zu brechen. Der Editor sendet `name` (sofern die Vorlage einen hat) und `content` gemeinsam, in einem Aufruf.
- **`name` ist optional.** Ohne Namensspalte lassen Sie ihn weg: Der Header zeigt „Unbenannt", und eine Umbenennung findet nie statt.

Jede Methode darf ablehnen. Der Editor meldet den Fehler über `onError`, zeigt ihn im Header an und lässt seinen Zustand unberührt — nichts wird als gespeichert markiert, was es nicht ist.

### Kein `list`, kein `delete`

Der Editor hat keinen Vorlagen-Browser. Die Auswahl, *welche* Vorlage geöffnet wird, gehört in Ihre Anwendung; die Aufgabe des Editors beginnt, sobald Sie ihm eine ID übergeben.

## Erstellen oder Speichern deaktivieren

`create` und `save` sind `false | fn` und **erforderlich**, nicht optional. `load` lässt sich nicht abschalten — ohne es gäbe es nichts zu öffnen.

```ts
templates: {
  load: (id) => fetchTemplate(id),
  create: false,  // editor.create() lehnt ab
  save: false,    // nur lesend: lädt und bearbeitet lokal, speichert nichts
}
```

**`save: false`** verbirgt die Speichern-Schaltfläche und die Statusanzeige und macht den Namen schreibgeschützt: Eine Änderung hätte nirgendwo hin. `Cmd`/`Strg`+`S` und Autosave laufen dann wirkungslos durch, statt einen Fehler zu erzeugen. Eine Vorlage zu laden und lokal zu bearbeiten funktioniert weiterhin.

**`create: false`** bewirkt, dass `editor.create()` ablehnt. Es verbirgt nichts, denn der Editor hat kein eigenes Bedienelement zum Anlegen — erzeugt wird immer über `editor.create()` aus Ihrer Anwendung heraus. Da Sie den Schalter selbst setzen, koppeln Sie ein eigenes Bedienelement für neue Vorlagen an denselben Wert oder fangen den Aufruf mit `try` / `catch` ab.

::: warning Keine Sicherheitsgrenze
Diese Schalter leben im Browser des Nutzers. Sie prägen die Oberfläche; sie schützen Ihre API nicht. Erzwingen Sie Berechtigungen serverseitig.
:::

## Der Header

<!-- prettier-ignore -->
| Position | Inhalt |
| --- | --- |
| links | der Vorlagenname, per Klick bearbeitbar |
| rechts | der Speicherstatus, dann die Speichern-Schaltfläche |

Der Name wird mit `Enter` oder beim Verlassen des Feldes übernommen, mit `Escape` verworfen; ein leerer Wert wird abgelehnt und der vorherige wiederhergestellt — ein geleertes Feld ist weit eher ein Versehen als eine Absicht. Eine Umbenennung ist eine gewöhnliche ungespeicherte Änderung: sie markiert den Editor als geändert und wird beim nächsten Speichern übertragen, im selben Patch wie der Inhalt.

Die Statusanzeige kennt drei Zustände:

| Zustand | Wird gezeigt, wenn |
| --- | --- |
| **Nicht gespeichert** | es Änderungen gibt, von denen der Editor weiß, dass sie nicht gespeichert sind |
| **Gespeichert** | ein Speichern gerade erfolgreich war (für einige Sekunden) |
| **Speichern fehlgeschlagen** | der letzte Versuch abgelehnt wurde — Ihre Fehlermeldung steht im Tooltip |

Die Speichern-Schaltfläche ist deaktiviert, solange keine Vorlage existiert, denn `save()` aktualisiert eine ID. Rufen Sie zuerst `create()` oder `load()` auf.

## Autosave

```ts
await init({
  container: '#editor',
  templates: { /* … */ },
  autoSave: { debounce: 5000 },  // `true` nutzt den Standard 2000
});
```

Die Verzögerung beginnt bei jeder Änderung neu, sodass aus einer Tippfolge ein einziges Speichern wird. Sie pausiert, während der Nutzer durch Undo/Redo navigiert, und überspringt das Speichern vollständig, wenn nichts geändert wurde.

::: warning `autoSave` benötigt einen `templates`-Provider
Ohne ihn gibt es kein Ziel zum Speichern — die Option wird ignoriert und der Editor protokolliert eine Warnung.
:::

## Cmd+S

`Cmd`/`Strg`+`S` bedeutet immer „jetzt speichern":

- mit einem `templates`-Provider wird `save()` aufgerufen;
- ohne ihn wird der `onChange`-Debounce sofort ausgelöst, sodass der Tastendruck auch dann ankommt, wenn Sie über `onChange` speichern.

## Ungespeicherte Änderungen

Zwei Mechanismen, denn keiner deckt den anderen ab:

```ts
await init({
  container: '#editor',
  templates: { /* … */ },
  onDirtyChange: (isDirty) => { hasUnsavedWork.value = isDirty },
  unsavedChangesGuard: true,  // der Standard
});
```

**`unsavedChangesGuard`** ist eine `beforeunload`-Rückfrage, standardmäßig aktiv, sobald ein Provider konfiguriert ist. Sie deckt das Schließen oder Neuladen des Tabs ab. Setzen Sie sie auf `false`, um die Rückfrage selbst zu übernehmen. Ohne Provider warnt der Editor nie — er kann nicht wissen, ob Sie die Änderung bereits gespeichert haben.

**`onDirtyChange`** (und sein abfragbares Gegenstück `editor.isDirty()`) ist das, womit Sie einen clientseitigen Router absichern, denn `beforeunload` löst bei einer Navigation innerhalb der Anwendung nicht aus:

```ts
router.beforeEach((to, from, next) => {
  if (editor.isDirty() && !confirm('Ungespeicherte Änderungen verwerfen?')) return next(false);
  next();
});
```

`onDirtyChange` funktioniert mit und ohne Provider. Beide Schlüssel akzeptiert auch `initCloud()`, zu denselben Bedingungen — Cloud hat immer einen Speicherort, die Rückfrage ist dort also aktiv, sofern Sie sie nicht abschalten.

## Die Instanz-API

```ts
const template = await editor.create({ name: 'Willkommens-E-Mail' });
await editor.load(template.id);
await editor.save();
editor.isDirty();  // boolean
```

- **`create(input?)`** speichert den aktuellen Inhalt als neue Vorlage. Übergeben Sie `content`, um zuvor den Inhalt des Editors zu ersetzen — `create({ content })` lädt und speichert damit in einem Schritt.
- **`load(id)`** holt eine Vorlage und macht sie zum Inhalt des Editors; lokale Änderungen werden verworfen.
- **`save()`** speichert Name und Inhalt der geladenen Vorlage als einen Patch.

Alle drei sind stets im Typ vorhanden und werden mit einer erklärenden Fehlermeldung abgelehnt, wenn kein Provider konfiguriert ist oder der Provider die jeweilige Methode zurückhält. Sichern Sie sie mit `try` / `catch` ab, wenn Sie sie aus einer eigenen Schaltfläche aufrufen. Der Header blendet seine eigenen Speichern-Bedienelemente aus, wenn `save` zurückgehalten wird; `create()` und `load()` haben dagegen überhaupt keine Editor-Oberfläche — ein Bedienelement dafür koppeln Sie selbst.

## Speichern ohne Provider

Ein Provider ist nicht der einzige Weg, eine Vorlage zu behalten. `onChange` löst verzögert bei jeder Inhaltsänderung aus:

```ts
await init({
  container: '#editor',
  onChange: (content) => myStore.save(content),
});
```

`Cmd`/`Strg`+`S` löst diesen Debounce sofort aus, sodass der Tastendruck bei Ihnen ankommt. Dann liegen auch die Speichern-Schaltfläche, der Status und die Rückfrage bei ungespeicherten Änderungen bei Ihnen. Der Provider existiert, damit Sie das nicht bauen müssen; `onChange` existiert für die Fälle, in denen die Oberfläche des Editors nicht das ist, was Sie wollen.

## Referenz

- [`init()`-Optionen](/de/api/editor)
- [Rendering & Export](/de/backend/render) — Bring-your-own-Rendering für MJML/HTML
- [Gespeicherte Blöcke](/de/backend/saved-blocks) — dieselbe Bring-your-own-Storage-Form, für wiederverwendbare Blockgruppen
- [Test-E-Mails](/de/backend/test-email) — Bring-your-own-Versand

**Sie nutzen Templatical Cloud?** Cloud implementiert diesen Vertrag ohne jede Konfiguration — siehe [Templates auf Cloud](/de/cloud/templates).
