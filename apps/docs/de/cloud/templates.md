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

Anders als bei `init()`, wo Autosave aus bleibt, bis es ein Ziel zum Speichern gibt, hat eine Cloud-Sitzung immer eines — deshalb ist es standardmäßig **an**. Die Taktung sind dieselben 2000 ms wie bei beiden Einstiegspunkten; nur der An/Aus-Standard unterscheidet sich. Schlüssel und Typ sind identisch:

```js
await initCloud({ container, auth, autoSave: { debounce: 5000 } }); // langsamer
await initCloud({ container, auth, autoSave: false });              // aus
```

## Eigene Implementierung

Innerhalb von `initCloud()` geht das nicht.

Die ID, die Clouds Speicher ausstellt, verankert Kommentare, Versionsverlauf, Zusammenarbeit, KI-Umformulierung, Bewertung und den serverseitigen Export. Ein Speicher, für den Cloud nie IDs ausgestellt hat, lässt sich deshalb nicht an Funktionen anschließen, die Cloud hostet. `initCloud({ templates })` steht daher nicht im Konfigurationstyp, und ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Bringen Sie Ihren eigenen mit [`init()`](/de/backend/templates) mit — dort gehört Ihnen der ganze Satz: Templates, Versionsverlauf, Kommentare, Rendering.

## Headless-Nutzung

Die REST-Oberfläche besteht aus `getTemplate`, `createTemplate` und `updateTemplate` auf dem `ApiClient` — siehe [Headless-API](/de/cloud/headless-api#templates).
