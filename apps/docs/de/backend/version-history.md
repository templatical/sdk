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
    list: (templateId) =>
      fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
    get: (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}`)
        .then((r) => r.json())
        .then((v) => v.content),
    create: false,
    restore: (templateId, versionId) =>
      fetch(`/api/templates/${templateId}/versions/${versionId}/restore`, {
        method: 'POST',
      }).then((r) => r.json()),
  },
});
```

**Standardmäßig weggelassen.** Ohne Provider wird das Steuerelement nicht gerendert und keine seiner UI heruntergeladen. Derselbe Schlüssel und derselbe Typ funktionieren bei `initCloud()`, sodass ein Wechsel zu Cloud bedeutet, den Schlüssel zu löschen (um den Verlauf von Cloud zu übernehmen) oder ihn genau so zu lassen, wie er ist (um Ihren eigenen zu behalten).

Eine Version gehört zu einer Vorlagen-ID, deshalb erscheint das Steuerelement erst, sobald `create()` oder `load()` eine angehängt hat. Siehe [Speichern & Laden](/de/backend/templates).

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
  list(templateId: string, params?: VersionHistoryListParams): Promise<TemplateVersion[]>;
  get(templateId: string, versionId: string): Promise<TemplateContent>;
  create:  false | ((templateId: string, content: TemplateContent, meta?: { label?: string }) => Promise<TemplateVersion>);
  restore: false | ((templateId: string, versionId: string) => Promise<Template>);
}
```

`list` und `get` sind die Operationen und lassen sich nicht abschalten. `create` und `restore` nehmen jeweils `false` statt einer Funktion entgegen — dieselbe Form, die [gespeicherte Blöcke](/de/backend/saved-blocks) und [Vorlagen](/de/backend/templates) verwenden, und aus demselben Grund: Eine Mutation abzuschalten sollte eine Entscheidung sein, die Sie *aussprechen*, und nie etwas, das entsteht, weil Sie eine Methode vergessen haben.

Der Editor rendert die Reihenfolge von `list()` unverändert und sortiert nie um. Die Reihenfolge bestimmt Ihr Speicher.

## Ihr `save` zeichnet die Versionen auf, nicht der Editor

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

Das ist das Einzige an diesem Entwurf, das sich nicht aus der Form des Vertrags ergibt, und es ist Absicht: Drosselung, Aufbewahrung und Deduplizierung sind Entscheidungen, die nur die Seite treffen kann, die den Speicher bezahlt. Ein Editor, der pro Autosave-Takt eine Version aufzeichnet, würde den Verlauf auf fremder Festplatte in ein Tastenprotokoll verwandeln.

`create` existiert für Versionen, die eine *Person* anfordert — ein benannter Prüfpunkt vor einer riskanten Änderung. **Der Editor ruft es nie von sich aus auf.** Die Regel gilt wörtlich: Nichts, was der Editor tut — auch das Wiederherstellen nicht —, zeichnet hinter Ihrem Rücken eine Version auf.

Bleibt eine Gefahr, die der Editor durch Nachfragen löst statt durch Schreiben: Ein bestätigtes Wiederherstellen verwirft alles, was Sie nicht gespeichert haben. Siehe [Wiederherstellen](#wiederherstellen).

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

Mit `restore: false` ist der Verlauf durchsuch- und vorschaubar, und die Schaltfläche „Wiederherstellen“ wird gar nicht erst gerendert.

### Ungespeicherte Änderungen

Das Abbrechen einer Vorschau stellt Ihre Arbeit wieder her; ein bestätigtes Wiederherstellen nicht — die Sicherung wird verworfen, alles Ungespeicherte existierte danach also nirgends mehr.

Deshalb fragt „Wiederherstellen“ bei ungespeicherten Änderungen zuerst nach und bietet an, sie **vor dem Wiederherstellen zu speichern**. Die Arbeit gelangt dann auf dem gewöhnlichen Weg in den Verlauf, über Ihr `templates.save` — von der Nutzerin oder dem Nutzer ausgelöst, und nur, sofern Ihr `save` überhaupt Versionen aufzeichnet.

Ohne `templates`-Provider oder mit einem, dessen `save` auf `false` steht, wird das Angebot nicht gemacht: Die Rückfrage sagt dann, dass die Änderungen verloren gehen, weil es keinen Ort für sie gibt. Ohne ungespeicherte Änderungen gibt es nichts zu verlieren, und „Wiederherstellen“ läuft sofort durch.

## Die Vorschau sofort halten

Sobald eine Vorschau offen ist, wechselt der Sprung zu einer anderen Version die Arbeitsfläche unmittelbar. Das gilt nur, wenn der Inhalt bereits vorliegt — genau dafür ist das optionale Feld `content` an jedem Eintrag da:

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

`content` ist ein **Cache-Hinweis, nie ein Ersatz für `get`**. Es wird pro Eintrag ausgewertet, sodass „die jüngsten Versionen mitliefern und ältere weglassen“ ein unterstützter Mittelweg ist und kein Behelf. Fehlt es, ruft der Editor für diese Version einmal `get` auf und merkt sich das Ergebnis — es wartet also nur der erste Besuch.

`get` bleibt erforderlich, weil der Editor den Inhalt einer Version immer beschaffen können muss. Optimierungen dürfen nicht zur Pflicht werden.

Der Adapter von Templatical Cloud liefert `content` bei jedem Eintrag mit, eine Cloud-Sitzung wartet also nie.

## Was Nutzende sehen

- **Das Verlaufs-Steuerelement** sitzt im Header neben den Umschaltern für Ansichtsgröße und Vorschau: Pfeile, um älter und neuer zu blättern, und ein Aufklappmenü mit allen Versionen samt relativem Zeitstempel, ihrer Bezeichnung, falls vorhanden, und einem *auto*-Abzeichen für die beim Speichern aufgezeichneten.
- **Das Vorschaubanner** erscheint, solange eine frühere Version auf der Arbeitsfläche liegt, mit „Abbrechen“ und „Wiederherstellen“.
- **Abbrechen** stellt genau das wieder her, woran Sie gearbeitet haben, einschließlich ungespeicherter Änderungen. Autosave pausiert für die Dauer einer Vorschau, damit eine Vorschau-Version nie mit Ihrer Arbeit verwechselt und darüber gespeichert wird.
- **Wiederherstellen** fragt bei ungespeicherten Änderungen zuerst nach — siehe [Ungespeicherte Änderungen](#ungespeicherte-anderungen).

## Seitenweises Laden

`VersionHistoryListParams` ist reserviert und derzeit leer. Der Editor ruft `list` immer ohne Parameter auf; es existiert, damit seitenweises Laden dort landen kann, ohne jede Implementierung zu brechen — derselbe Präzedenzfall, den [gespeicherte Blöcke](/de/backend/saved-blocks) mit `SavedBlocksListParams` geschaffen haben.

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
history.versions.value;                      // TemplateVersion[]
history.peekContent(v);                      // TemplateContent | null — kein Roundtrip
await history.resolveContent(v);             // der Hinweis oder get(), zwischengespeichert
await history.restore(v.id);
```

## Templatical Cloud

Cloud implementiert denselben Vertrag, ohne dass Sie etwas konfigurieren: Das Verlaufs-Steuerelement erscheint, sobald eine Vorlage angelegt oder geladen wurde. Sein `list` liefert jeden Eintrag **samt Inhalt**, sodass das Durchblättern des Verlaufs nie wartet, und beide Mutationen sind aktiv — es gibt keine Stufe, die den Verlauf auflisten, aber nicht daraus wiederherstellen kann. Die automatischen Versionen stammen aus Clouds eigenem `templates.save`, gedrosselt auf höchstens eine pro Minute, genau wie [der Vertrag es vorsieht](#ihr-save-zeichnet-die-versionen-auf-nicht-der-editor).

`initCloud()` nimmt keinen `versionHistory`-Schlüssel an: Eine Version ist an eine Vorlagen-ID gebunden, die Cloud ausgestellt hat. Ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Siehe [Versionsverlauf auf Cloud](/de/cloud/version-history).
