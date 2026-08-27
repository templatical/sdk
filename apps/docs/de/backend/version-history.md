---
title: Versionsverlauf
description: Frühere Versionen einer Vorlage durchsehen, in der Vorschau ansehen und wiederherstellen — über Ihren eigenen Speicher oder den von Templatical Cloud.
---

# Versionsverlauf

Geben Sie dem Editor einen Ort, an dem er Versionen lesen kann, und er zeigt im Header ein Verlaufs-Steuerelement: durch frühere Stände blättern, eine Version auf der Arbeitsfläche in der Vorschau ansehen und sie wiederherstellen.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  templates: myTemplatesProvider,
  versionHistory: {
    list: async (templateId) => {
      const res = await fetch(`/api/templates/${templateId}/versions`);
      return { versions: await res.json() };
    },

    get: async (templateId, versionId) => {
      const res = await fetch(
        `/api/templates/${templateId}/versions/${versionId}`,
      );
      const version = await res.json();
      return version.content;
    },

    create: false,

    restore: async (templateId, versionId) => {
      const res = await fetch(
        `/api/templates/${templateId}/versions/${versionId}/restore`,
        { method: 'POST' },
      );
      return res.json();
    },
  },
});
```

**Standardmäßig weggelassen.** Ohne Provider wird das Steuerelement nicht gerendert, und keiner seiner UI-Teile wird geladen.

Versionen sind an eine Vorlagen-ID gebunden, deshalb erscheint das Steuerelement erst, sobald `create()` oder `load()` eine angehängt hat. Siehe [Speichern & Laden](/de/backend/templates).

## Der Vertrag

```ts
interface TemplateVersion {
  id: string;
  createdAt: string;
  isAutomatic?: boolean;
  label?: string;
  author?: { id?: string; name?: string };
  content?: TemplateContent;
}

interface VersionHistoryProvider {
  list(templateId: string, params?: VersionHistoryListParams): Promise<VersionHistoryListResult>;
  get(templateId: string, versionId: string): Promise<TemplateContent>;
  create:  false | ((templateId: string, content: TemplateContent, meta?: { label?: string }) => Promise<TemplateVersion>);
  restore: false | ((templateId: string, versionId: string) => Promise<Template>);
}
```

`list` und `get` lassen sich nicht abschalten — der Editor muss eine Version immer anzeigen und ihren Inhalt beschaffen können. `create` und `restore` nehmen jeweils `false` statt einer Funktion entgegen und sind **erforderlich**, nicht optional: Ein `false` erklärt die Aktion für nicht verfügbar, und der Editor blendet sie aus, statt sie zu deaktivieren. Mit `restore: false` bleibt der Verlauf durchsuchbar, ohne Schaltfläche; mit `create: false` zeichnet nur Ihr `save` Versionen auf.

Der Editor rendert die Reihenfolge von `list()` unverändert und sortiert nie um. Die Reihenfolge bestimmt Ihr Speicher.

::: warning Keine Sicherheitsgrenze
Diese Flags leben im Browser der Nutzenden. Sie formen die Oberfläche; Ihre API schützen sie nicht. Ein Wiederherstellen überschreibt die aktuelle Vorlage — setzen Sie serverseitig durch, wer es aufrufen darf, und wer den Inhalt einer Version lesen darf, denn das ist ein früherer Stand eines Dokuments, auf das jemand heute vielleicht keinen Zugriff mehr hat.
:::

## Versionen aufzeichnen

**Der Editor zeichnet nie von sich aus eine Version auf.** Das `TemplatesProvider.save`, das Sie bereitstellen, entscheidet, ob ein Speichern auch eine Version aufzeichnet:

```ts
const templates = {
  load: (id) => db.templates.get(id),
  create: (input) => db.templates.insert(input),
  save: async (id, patch) => {
    const template = await db.templates.update(id, patch);
    // Ihre Entscheidung, Ihr Speicher, Ihre Drosselung.
    if (patch.content) await db.versions.insert({ id, content: patch.content });
    return template;
  },
};
```

`create` existiert für Versionen, die eine *Person* anfordert — ein benannter Prüfpunkt vor einer riskanten Änderung. Der Editor ruft es nie von sich aus auf. Die Regel gilt wörtlich: Nichts, was der Editor tut — auch das Wiederherstellen nicht —, zeichnet hinter Ihrem Rücken eine Version auf.

::: tip Warum der Editor sich heraushält
Drosselung, Aufbewahrung und Deduplizierung sind Entscheidungen, die nur die Seite treffen kann, die den Speicher bezahlt. Ein Editor, der pro Autosave-Takt eine Version aufzeichnet, würde den Verlauf auf fremder Festplatte in ein Tastenprotokoll verwandeln.
:::

Die eine Gefahr, die bleibt — ein Wiederherstellen verwirft ungespeicherte Arbeit —, löst der Editor durch Nachfragen statt durch Schreiben. Siehe [Wiederherstellen](#wiederherstellen).

## Wiederherstellen

Wiederherstellen ist **nur anfügend**: Es fügt einen Eintrag hinzu, statt einen zu überschreiben. Das Rückgängigmachen bleibt schlüssig, und zwei verschiedene Backends können sich hinterher nicht darüber uneinig sein, wie der Verlauf aussieht.

Ein Speicher ohne atomaren Restore-Endpunkt setzt es in einer Zeile zusammen:

```ts
restore: async (templateId, versionId) => {
  const content = await versions.get(templateId, versionId);
  return templates.save(templateId, { content });
},
```

Zwei Roundtrips und ein etwas größeres Fehlerfenster — und weil Ihr `save` eine Version aufzeichnet, ist es ganz nebenbei nur anfügend.

Mit `restore: false` bleibt der Verlauf durchsuch- und vorschaubar, und die Schaltfläche „Wiederherstellen“ wird nicht gerendert.

### Ungespeicherte Änderungen

Das Abbrechen einer Vorschau stellt Ihre Arbeit wieder her; ein bestätigtes Wiederherstellen nicht — die Sicherung wird verworfen, alles Ungespeicherte existierte danach also nirgends mehr.

„Wiederherstellen“ fragt daher bei ungespeicherten Änderungen zuerst nach und bietet an, sie **vor dem Wiederherstellen zu speichern**. Die Arbeit gelangt dann auf dem gewöhnlichen Weg in den Verlauf, über Ihr `templates.save` — von der Nutzerin oder dem Nutzer ausgelöst, und nur, sofern Ihr `save` überhaupt Versionen aufzeichnet.

Ohne `templates`-Provider oder mit einem, dessen `save` auf `false` steht, wird das Angebot nicht gemacht: Die Rückfrage sagt dann, dass die Änderungen verloren gehen, weil es keinen Ort für sie gibt. Ohne ungespeicherte Änderungen gibt es nichts zu verlieren, und „Wiederherstellen“ läuft sofort durch.

## Der `content`-Hinweis

Sobald eine Vorschau offen ist, wechselt der Sprung zu einer anderen Version die Arbeitsfläche unmittelbar — sofern der Inhalt bereits vorliegt. Genau dafür ist das optionale Feld `content` an jedem Eintrag da:

```ts
list: async (templateId) => {
  const rows = await db.versions.forTemplate(templateId);
  return rows.map((row, index) => ({
    id: row.id,
    createdAt: row.createdAt,
    isAutomatic: row.automatic,
    // Die jüngsten mitliefern; der Rest darf einen Roundtrip kosten.
    ...(index < 20 ? { content: row.content } : {}),
  }));
},
```

Es ist ein **Cache-Hinweis, nie ein Ersatz für `get`**, und wird pro Eintrag ausgewertet — die jüngsten Versionen mitliefern und ältere weglassen ist ein unterstützter Mittelweg. Fehlt es, ruft der Editor für diese Version einmal `get` auf und merkt sich das Ergebnis, es wartet also nur der erste Besuch.

`get` bleibt erforderlich: Der Editor muss den Inhalt einer Version immer beschaffen können, ob der Hinweis da ist oder nicht.

## Im Editor

- **Das Verlaufs-Steuerelement** sitzt im Header neben den Umschaltern für Ansichtsgröße und Vorschau: Pfeile, um älter und neuer zu blättern, und ein Aufklappmenü mit allen Versionen samt relativem Zeitstempel, ihrer Bezeichnung, falls vorhanden, und einem *auto*-Abzeichen für die beim Speichern aufgezeichneten.
- **Das Vorschaubanner** erscheint, solange eine frühere Version auf der Arbeitsfläche liegt, mit „Abbrechen“ und „Wiederherstellen“.
- **Abbrechen** stellt genau das wieder her, woran Sie gearbeitet haben, einschließlich ungespeicherter Änderungen. Autosave pausiert für die Dauer einer Vorschau, damit eine Vorschau-Version nie mit Ihrer Arbeit verwechselt und darüber gespeichert wird.
- **Wiederherstellen** fragt bei ungespeicherten Änderungen zuerst nach — siehe [Ungespeicherte Änderungen](#ungespeicherte-anderungen).

## Seitenweises Laden

`list` nimmt `{ limit?, cursor? }` entgegen und liefert einen Umschlag:

```ts
type VersionHistoryListResult = { versions: TemplateVersion[]; nextCursor?: string };
```

Der Editor lädt eine Seite und ruft `list` ohne Parameter auf — er sendet weder `limit` noch `cursor` und ignoriert `nextCursor`. Ein Speicher, der den ganzen Verlauf auf einmal zurückgibt, lässt `nextCursor` weg und ist fertig.

Der Umschlag existiert, damit späteres seitenweises Laden keine brechende Änderung ist: Ein Cursor hat von Anfang an einen Platz. Nur das Parameter-Objekt zu reservieren hätte die Anfrage abgedeckt und die Antwort mit einer neuen Form zurückgelassen. `useVersionHistory` stellt `nextCursor` für Headless-Aufrufer bereit, die tatsächlich blättern — siehe [Headless-Nutzung](#headless-nutzung).

## Events

```ts
versionHistory: {
  list, get, create, restore,
  onCreated:   (version) => {},
  onRestored:  (template) => {},
}
```

`onCreated` löst aus, sobald `create()` auflöst, mit der aufgezeichneten `TemplateVersion`. `onRestored` löst aus, sobald `restore()` auflöst, mit dem resultierenden `Template` statt der `TemplateVersion`, aus der wiederhergestellt wurde — die aufrufende Seite kennt deren ID bereits, denn genau die wurde `restore(templateId, versionId)` übergeben.

Eine Handler-Funktion, die einen Fehler wirft, wird abgefangen und an `onError` gemeldet — sie lässt das auslösende Erstellen oder Wiederherstellen nie fehlschlagen.

## Headless-Nutzung

`useVersionHistory` aus `@templatical/core` ist der reaktive Zustand für sich allein, ohne den Editor:

```ts
import { useVersionHistory } from '@templatical/core';

const history = useVersionHistory({
  provider: myVersionHistoryProvider,
  getTemplateId: () => currentTemplateId,
  onError: (error) => console.error(error),
});

await history.load();
history.versions.value;                      // TemplateVersion[] — diese Seite
history.nextCursor.value;                    // string | undefined — als { cursor } zurückgeben
history.peekContent(v);                      // TemplateContent | null — kein Roundtrip
await history.resolveContent(v);             // der Hinweis oder get(), zwischengespeichert
await history.restore(v.id);
```

**Sie nutzen Templatical Cloud?** Cloud implementiert diesen Vertrag ohne jede Konfiguration — siehe [Versionsverlauf auf Cloud](/de/cloud/version-history).
