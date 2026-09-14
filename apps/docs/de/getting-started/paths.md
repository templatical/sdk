---
title: Einstiegspunkte
description: Welche Dokumentationsseite zuerst — Editor einbinden, Backend anbinden, Vorlage per Prompt erzeugen, oder JSON zu versandfertigem HTML kompilieren.
---

# Einstiegspunkte

Kommerzielle Nutzung ist kostenlos. Die [Lizenz-FAQ](/de/license-faq) erklärt die Einschränkung für konkurrierende Editor-Produkte.

## Editor einbinden

`@templatical/editor` in Ihr Produkt mounten. Beliebiges Framework, oder keines.

- [Schnellstart](/de/getting-started/quick-start) — Mounten, JSON speichern, MJML zu HTML kompilieren
- [Installation](/de/getting-started/installation) — Pakete, CDN, React / Vue / Svelte / Angular
- [Einbetten](/de/getting-started/embedding) — Container-Höhe, Stacking, `position: fixed`

## Speicher und Versand anbinden

Speichern, Versionen, Kommentare, gespeicherte Blöcke, Medien, Test-E-Mail und HTML-Export sind Schlüssel an `init()`. Fehlt ein Schlüssel, fehlt die zugehörige Oberfläche.

- [Backend anbinden](/de/backend/) — die Verträge
- [Funktionen für Autoren](/de/getting-started/author-features) — was man im Editor tatsächlich sieht

## Vorlage per Prompt erzeugen

Ihr Coding-Agent schreibt und validiert JSON. Kein Templatical-Konto.

- [Agent Skill](/de/guide/agent-skill)
- [Template Tools](/de/api/template-tools) — dieselben validate- / render- / import- / live-Befehle aus einer Shell

## JSON zu versandfertigem HTML

Der Editor speichert JSON. `@templatical/renderer` erzeugt MJML. Jede MJML-Bibliothek kompiliert HTML. Versand über das, was Sie schon nutzen.

- [So funktioniert das Rendering](/de/getting-started/how-rendering-works)
- [Renderer-API](/de/api/renderer-typescript)
- [Template Tools](/de/api/template-tools) `render --format html`

## Gehosteten Builder verlassen

Unlayer, BeeFree, Stripo und die anderen sind Produkte mit eigenem Konto. Importer legen deren Export auf Templatical-JSON.

- [Gehostete Builder](/de/getting-started/hosted-builders)
