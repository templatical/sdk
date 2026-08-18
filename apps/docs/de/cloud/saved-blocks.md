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

## Was der Cloud-Adapter tut

| Methode | Cloud |
| --- | --- |
| `list` | Alle gespeicherten Blöcke des Projekts, in der Reihenfolge, die Cloud liefert |
| `create` | Speichert einen Block mit Namen und optionaler Kategorie |
| `update` | Benennt um oder ändert die Kategorie |
| `delete` | Entfernt ihn aus dem Projekt |

**Eine Bibliothek pro Projekt**, geteilt von allen Beteiligten — ein Block, den eine Kollegin speichert, liegt beim nächsten Öffnen im Browser aller anderen. Genau das hat kein OSS-Gegenstück: nicht der Speicher, sondern die Tatsache, dass er bereits geteilt ist.

Alle vier sind aktiv. Clouds Bibliothek ist an die Planfunktion `saved_modules` gebunden.

## Eigene Implementierung

Das geht — dies ist einer von nur zwei Providern, die `initCloud()` annimmt. Der Schlüssel hat denselben Typ wie bei `init()`:

```ts
await initCloud({ container, auth });                     // Clouds Bibliothek
await initCloud({ container, auth, savedBlocks: mine });  // Ihre eigene, auf Cloud
await initCloud({ container, auth, savedBlocks: false }); // aus
```

Das lässt sich gefahrlos mischen, weil Cloud die Bibliothek nie eigenständig nutzt: Ein gespeicherter Block wird auf die Arbeitsfläche kopiert und sonst nirgends gelesen — es gibt also keinen zweiten Speicher, der widersprechen könnte.

Ein Provider, den Sie übergeben, ist **nicht** plangebunden — die Planfunktion lizenziert Clouds *Speicher*, nicht die Oberfläche des Editors.

## Headless

Die REST-Methoden behalten ihre ursprüngliche `module`-Benennung — `listModules`, `createModule`, `updateModule`, `deleteModule`. Siehe [Headless-API](/de/cloud/headless-api#gespeicherte-blocke).
