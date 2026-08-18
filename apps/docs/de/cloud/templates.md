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

## Was der Cloud-Adapter tut

| Methode | Cloud |
| --- | --- |
| `load` | Lädt eine gespeicherte Vorlage per ID, begrenzt auf das Projekt des Tokens |
| `create` | Speichert eine neue Vorlage und stellt die ID aus, an der alles Weitere hängt |
| `save` | Persistiert Inhalt und Namen und legt automatisch eine Version an |

Beide Mutationen sind aktiv: Vorlagenspeicherung ist genau das, wofür der Plan bezahlt wird — es gibt also keine Cloud-Stufe, die eine Vorlage öffnen, aber nicht speichern kann. Was ein Plan sehr wohl begrenzt, ist die **Anzahl** der Vorlagen pro Projekt — eine Mengenbegrenzung, keine Funktionsbegrenzung.

## Jeder Speichervorgang legt eine Version an

Clouds `save` schreibt die Version im selben Aufruf, gedrosselt auf höchstens eine pro Minute. Das ist der Grund, warum der [Versionsverlauf](/de/cloud/version-history) auf Cloud ohne weitere Konfiguration funktioniert, und es ist genau das, was [der Vertrag](/de/backend/version-history#ihr-save-zeichnet-die-versionen-auf-nicht-der-editor) für jede Implementierung vorsieht: Wer den Speicher besitzt, bestimmt die Aufbewahrung. Ein Speichervorgang, der nur die Vorlage umbenennt, legt nichts an.

## Autosave ist standardmäßig an

Anders als bei `init()`, wo Autosave aus bleibt, bis es ein Ziel zum Speichern gibt, hat eine Cloud-Sitzung immer eines — deshalb ist es standardmäßig an. Schlüssel und Typ sind auf beiden Einstiegspunkten identisch:

```js
await initCloud({ container, auth, autoSave: { debounce: 5000 } }); // langsamer
await initCloud({ container, auth, autoSave: false });              // aus
```

## Eigene Implementierung

Innerhalb von `initCloud()` geht das nicht.

Die ID, die Clouds Speicher ausstellt, verankert Kommentare, Versionsverlauf, Zusammenarbeit, KI-Umformulierung, Bewertung und den serverseitigen Export. Ein Speicher, für den Cloud nie IDs ausgestellt hat, lässt sich deshalb nicht an Funktionen anschließen, die Cloud hostet. `initCloud({ templates })` steht daher nicht im Konfigurationstyp, und ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Bringen Sie Ihren eigenen mit [`init()`](/de/backend/templates) mit — dort gehört Ihnen der ganze Satz: Templates, Versionsverlauf, Kommentare, Rendering.

## Headless

Die REST-Oberfläche besteht aus `getTemplate`, `createTemplate` und `updateTemplate` auf dem `ApiClient` — siehe [Headless-API](/de/cloud/headless-api#templates).
