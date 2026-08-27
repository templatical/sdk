---
title: Templates
description: Templatical Cloud als eine Implementierung des Speichern-und-Laden-Vertrags.
---

# Templates

Speichern und Laden ist ein [offener Vertrag](/de/backend/templates). Templatical Cloud implementiert ihn genauso, wie Ihr eigenes Backend es täte.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
await editor.create({ name: 'Frühjahrskampagne' });
```

Nichts zu konfigurieren. Cloud stellt den Provider bereit, sodass der gesamte Lebenszyklus — das Namensfeld im Header, die Speichern-Schaltfläche, der Speicherstatus, `Cmd`/`Strg`+`S`, Autosave und der Schutz vor ungespeicherten Änderungen — ohne einen einzigen Schlüssel und ohne eigenen Speicher funktioniert.

## Der Adapter

| Methode | Cloud |
| --- | --- |
| `load` | Lädt eine gespeicherte Vorlage per ID, begrenzt auf das Projekt des Tokens |
| `create` | Speichert eine neue Vorlage und stellt die ID aus, an der alles Weitere hängt |
| `save` | Persistiert Inhalt und Namen und legt automatisch eine Version an |

Cloud liefert `createdAt` / `updatedAt` noch nicht, daher zeigt der Header auf dieser Stufe keinen [Zeitstempel](/de/backend/templates#der-zeitstempel). Die Felder werden gelesen, sobald die API sie sendet — ohne Änderung am SDK.

Beide Mutationen sind aktiv — keine Cloud-Stufe kann eine Vorlage öffnen, aber nicht speichern. Pläne begrenzen die **Anzahl** der Vorlagen pro Projekt: eine Mengenbegrenzung, keine Funktionsbegrenzung.

## Automatische Versionen

Clouds `save` schreibt die Version im selben Aufruf, gedrosselt auf höchstens eine pro Minute. Deshalb funktioniert der [Versionsverlauf](/de/cloud/version-history) ohne weitere Konfiguration. Ein Speichervorgang, der nur die Vorlage umbenennt, legt nichts an.

## Autosave

Anders als bei `init()`, wo Autosave aus bleibt, bis es ein Ziel zum Speichern gibt, hat eine Cloud-Sitzung immer eines — deshalb ist `templates.autoSave` standardmäßig **an**. `changeDebounce` hat denselben Standard von 2000 ms wie bei beiden Einstiegspunkten; nur der An/Aus-Standard unterscheidet sich. Die Schlüssel und ihr Typ sind identisch zu denen von `init()`:

```js
await initCloud({ container, auth, templates: { autoSave: false } }); // aus
await initCloud({ container, auth, changeDebounce: 5000 });           // langsamer
```

::: tip `onChange` allein mit `templates.autoSave: false` takten
Cloud stellt immer sein eigenes `templates` bereit, es gibt hier also keine Konfiguration ohne `templates` wie bei `init()`. Speichern Sie nichts, während Sie `onChange` weiterhin mit `changeDebounce` takten, indem Sie `templates: { autoSave: false }` setzen — statt `templates` wegzulassen.
:::

## Eigene Implementierung

Konfiguration und Events, innerhalb von `initCloud()` — nie der Speicher.

Die ID, die Clouds Speicher ausstellt, verankert Kommentare, Versionsverlauf, Zusammenarbeit, KI-Umformulierung, Bewertung und den serverseitigen Export. Ein Speicher, für den Cloud nie IDs ausgestellt hat, lässt sich deshalb nicht an Funktionen anschließen, die Cloud hostet, sodass der Schlüssel `templates` von `initCloud()` [`TemplatesOptions`](/de/backend/templates#events) akzeptiert — `autoSave`, `unsavedChangesGuard`, `nameField`, `onSaved`, `onCreated` und `onLoaded` — statt eines vollständigen Providers:

```ts
await initCloud({
  container: '#editor',
  auth: { url: '/api/token' },
  templates: {
    unsavedChangesGuard: false,
    nameField: false,
    onSaved:   (template, { trigger }) => {},
    onCreated: (template) => {},
    onLoaded:  (template) => {},
  },
});
```

::: tip Rendering und Test-E-Mails speichern ebenfalls
`toMjml()`, `toHtml()` und der Versand einer Test-E-Mail speichern die Vorlage jeweils zuerst, sodass `onSaved` mit `trigger: "api"` auch für eine Aktion ausgelöst wird, die der Nutzer nicht als Speichern wahrgenommen hat. Binden Sie die Navigation an `trigger === "manual"`, statt an das Fehlen von `"autosave"`.
:::

Einen vollständigen Provider zu übergeben ist unproblematisch: `load`, `create` und `save` werden mit einer Konsolenwarnung ignoriert, die sie namentlich nennt, während der Rest des Objekts den Editor trotzdem erreicht. Ein `templates`-Provider aus einer OSS-Integration braucht beim Umzug zu Cloud keine Änderung — lassen Sie den Schlüssel genau so, wie er ist.

Bringen Sie Ihren eigenen Speicher mit [`init()`](/de/backend/templates) mit — dort gehört Ihnen der ganze Satz: Templates, Versionsverlauf, Kommentare, Rendering.

## Headless-Nutzung

Die REST-Oberfläche besteht aus `getTemplate`, `createTemplate` und `updateTemplate` auf dem `ApiClient` — siehe [Headless-API](/de/cloud/headless-api#templates).
