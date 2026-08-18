---
title: Rendering
description: Wie Templatical Cloud eine Vorlage zu MJML und HTML rendert — und warum es keinen render-Provider annimmt.
---

# Rendering

Rendering ist ein [offener Vertrag](/de/backend/render). Templatical Cloud implementiert ihn — und es ist der eine Provider, den `initCloud()` **nicht** ersetzen lässt.

```ts
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

Nichts zu konfigurieren und nichts zu installieren: kein `@templatical/renderer` auf Ihrer Seite, kein MJML-Compiler, kein Render-Host.

## Der Adapter

| Methode | Cloud |
| --- | --- |
| `toMjml` | Rendert die gespeicherte Vorlage serverseitig zu MJML |
| `toHtml` | Rendert und kompiliert sie in einem Aufruf zu versandfertigem HTML |
| `compileMjml` | Kompiliert MJML, das Sie bereits haben |

## Was Cloud hinzufügt

Zwei Dinge, die ein Browser zur Renderzeit nicht leisten kann:

- ein **Countdown-Block** wird zu einem serverseitig erzeugten animierten GIF;
- ein **Video-Block** erhält einen zusammengesetzten Play-Button über dem Vorschaubild.

Alles andere ist identisch, denn Cloud führt den *veröffentlichten* `@templatical/renderer` mit genau diesen zwei eingespeisten Funktionen aus. Nichts anderes kann abweichen.

## Einschränkungen

- **Cloud rendert die gespeicherte Vorlage**, jeder `toMjml()`- / `toHtml()`-Aufruf speichert also zuerst. Eine Sitzung, die nie eine Vorlage erzeugt hat, erhält eine klare Ablehnung statt eines Exports von nichts.
- **Rendering ist nicht plangebunden.** Jeder Plan rendert die Schriften, die auch auf der Arbeitsfläche verwendet werden.

## Eigene Implementierung

Innerhalb von `initCloud()` geht das nicht.

Cloud rendert **auch für den Versand serverseitig**: Test-E-Mail, geplante Sendungen und API-Exporte laufen alle über den eigenen Renderer. Ein Provider würde hier `toMjml()` und `toHtml()` verändern und sonst nichts — was Sie in der Vorschau sehen und exportieren, wäre also nicht mehr das, was Cloud versendet.

Dies ist eine andere Regel als die für [Templates](/de/cloud/templates), [Versionsverlauf](/de/cloud/version-history) und [Kommentare](/de/cloud/comments) — Rendering ist zustandslos und braucht keine Vorlagen-ID.

`initCloud({ render })` steht daher nicht im Konfigurationstyp, und ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Wenn Sie auf Cloud Ihr eigenes MJML brauchen, rufen Sie den Renderer direkt auf — eine schlichte Funktion über den Inhalt, den der Editor ohnehin hält:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(editor.getContent());
```

Das rendert die *aktuelle* Arbeitsfläche statt der gespeicherten Fassung und erzeugt die Browser-Ausgabe statt Clouds Obermenge. Wenn Ihnen die ganze Pipeline gehören soll, nutzen Sie [`init()`](/de/backend/render).

## Headless-Nutzung

Rendern Sie ganz ohne Editor über die [Headless-API](/de/cloud/headless-api#export).
