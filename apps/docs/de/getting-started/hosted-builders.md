---
title: Gehostete Builder
description: Templatical im Vergleich zu gehosteten E-Mail-Buildern wie Unlayer, BeeFree und Stripo, und welcher Importer zu einem bestehenden Template gehört.
---

# Gehostete Builder

Templatical ist ein SDK, das Sie in Ihr Produkt mounten. Speicher, Versand und Konten bleiben bei Ihnen. Unlayer, BeeFree, Stripo, Topol, Chamaileon und Easy Email Pro sind gehostete Produkte: deren Dashboard, deren Speicher, deren Bedingungen.

Kommerzielles Einbinden ist kostenlos. Templatical darf nicht als konkurrierendes E-Mail-Editor-Produkt weiterverkauft werden. [Lizenz-FAQ](/de/license-faq).

## Vergleich

| | Templatical | Gehosteter Builder |
|---|---|---|
| Wo Autoren arbeiten | Ihre App | Deren Website oder Iframe |
| Template-Speicher | Ihr Backend (`templates` an `init()`) | Deren |
| Versand | Ihr ESP oder Ihre API | Oft deren |
| Ausgabe | JSON, das Sie behalten; MJML über `@templatical/renderer`; HTML über jede MJML-Bibliothek | Deren HTML / deren JSON |
| Lizenz | FSL-1.1-MIT für den Editor; MIT für Renderer, Types, Quality, Importer | Anbieter-ToS |

## Importer

Jeder Konverter legt einen nativen Export auf Templatical-JSON. Nicht abgebildete Teile werden ein `html`-Block oder entfallen. Der Report in jedem Runbook ist die Aufzeichnung davon.

| Quelle | Runbook |
|---|---|
| Unlayer | [Von Unlayer](/de/guide/migration-from-unlayer) |
| BeeFree | [Von BeeFree](/de/guide/migration-from-beefree) |
| Stripo | [Von Stripo](/de/guide/migration-from-stripo) |
| Topol | [Von Topol](/de/guide/migration-from-topol) |
| Chamaileon | [Von Chamaileon](/de/guide/migration-from-chamaileon) |
| Easy Email Pro | [Von Easy Email Pro](/de/guide/migration-from-easy-email-pro) |
| MJML | [Von MJML](/de/guide/migration-from-mjml) |
| HTML | [Von HTML](/de/guide/migration-from-html) |

MJML und HTML sind die Auffangbecken, wenn das native Format nicht in der Liste steht. Der Agent Skill kann einen Import ausführen und danach im Live-Editor nacharbeiten — [Agent Skill](/de/guide/agent-skill).
