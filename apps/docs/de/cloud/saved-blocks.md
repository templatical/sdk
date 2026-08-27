---
title: Gespeicherte Blöcke
description: Templatical Cloud als eine Implementierung des Speicher-Vertrags für gespeicherte Blöcke.
---

# Gespeicherte Blöcke

Gespeicherte Blöcke sind ein [offener Vertrag](/de/backend/saved-blocks). Templatical Cloud implementiert ihn genauso, wie Ihr eigenes Backend es täte.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nichts zu konfigurieren — diese Funktion ist standardmäßig an. Cloud stellt den Provider bereit, und die Bibliotheksleiste erscheint in der Seitenleiste.

## Der Adapter

| Methode | Cloud |
| --- | --- |
| `list` | Alle gespeicherten Blöcke des Projekts, in der Reihenfolge, die Cloud liefert |
| `create` | Speichert einen Block mit Namen und optionaler Kategorie |
| `update` | Benennt um oder ändert die Kategorie |
| `delete` | Entfernt ihn aus dem Projekt |

**Eine Bibliothek pro Projekt**, geteilt von allen Beteiligten — ein Block, den eine Kollegin speichert, liegt beim nächsten Öffnen im Browser aller anderen. Genau das hat kein OSS-Gegenstück: nicht der Speicher, sondern die Tatsache, dass er bereits geteilt ist.

Alle vier sind aktiv. Clouds Bibliothek ist an die Planfunktion `saved_modules` gebunden.

## Eigene Implementierung

Das geht, und dies ist einer von nur zwei Providern, die `initCloud()` als vollständigen Ersatz annimmt — `testEmail` ist der andere. Der Schlüssel hat denselben Typ wie bei `init()`, dazu eine dritte Form, die nur an diesem Einstiegspunkt existiert: Clouds Bibliothek behalten und eigene Event-Handler hinzufügen.

```ts
await initCloud({ container, auth });                             // Clouds Bibliothek
await initCloud({ container, auth, savedBlocks: { onCreated } }); // Clouds Bibliothek, plus Ihre Events
await initCloud({ container, auth, savedBlocks: mine });          // Ihre eigene, auf Cloud
await initCloud({ container, auth, savedBlocks: false });         // aus
```

Cloud unterscheidet sie an `list`, nie daran, ob der Wert ein Objekt ist: Alles mit einem funktionierenden `list` ersetzt Clouds Speicher vollständig, und alles andere — `true`, `false`, ein reines Events-Objekt — behält Clouds eigenen Speicher und leitet dessen Events an ihn weiter.

Das lässt sich gefahrlos mischen, weil Cloud die Bibliothek nie eigenständig nutzt: Ein gespeicherter Block wird auf die Arbeitsfläche kopiert und sonst nirgends gelesen — es gibt also keinen zweiten Speicher, der widersprechen könnte.

Ein Provider, den Sie übergeben, ist **nicht** plangebunden — die Planfunktion lizenziert Clouds *Speicher*, nicht die Oberfläche des Editors. Ein reines Events-Objekt bleibt plangebunden, denn Clouds eigener Speicher erledigt die Arbeit weiterhin.

## Events

```ts
savedBlocks: {
  onCreated: (block) => {},
  onUpdated: (block) => {},
  onDeleted: (block) => {},
}
```

Dieselben Events wie im [offenen Vertrag](/de/backend/saved-blocks#events), ausgelöst unabhängig davon, ob der dahinterliegende Speicher Clouds eigener ist oder Ihr eigener.

## Headless-Nutzung

Die REST-Methoden behalten ihre ursprüngliche `module`-Benennung — `listModules`, `createModule`, `updateModule`, `deleteModule`. Siehe [Headless-API](/de/cloud/headless-api#gespeicherte-blocke).
