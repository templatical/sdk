---
title: Hosted builders
description: How Templatical compares to hosted email builders such as Unlayer, BeeFree, and Stripo, and which importer to open for an existing template.
---

# Hosted builders

Templatical is an SDK you mount in your product. Storage, send, and accounts stay yours. Unlayer, BeeFree, Stripo, Topol, Chamaileon, and Easy Email Pro are hosted products: their dashboard, their storage, their terms.

Commercial embedding is free. You may not repackage Templatical as a competing email-editor product. [License FAQ](/license-faq).

## Comparison

| | Templatical | Hosted builder |
|---|---|---|
| Where authors work | Your app | Their site or iframe |
| Template storage | Your backend (`templates` on `init()`) | Theirs |
| Send | Your ESP or API | Often theirs |
| Output | JSON you keep; MJML via `@templatical/renderer`; HTML via any MJML library | Their HTML / their JSON |
| License | FSL-1.1-MIT on the editor; MIT on renderer, types, quality, importers | Vendor ToS |

## Importers

Each converter maps a native export onto Templatical JSON. Unmapped pieces become an `html` block or are skipped. The report on each runbook is the record of that.

| Source | Runbook |
|---|---|
| Unlayer | [From Unlayer](/guide/migration-from-unlayer) |
| BeeFree | [From BeeFree](/guide/migration-from-beefree) |
| Stripo | [From Stripo](/guide/migration-from-stripo) |
| Topol | [From Topol](/guide/migration-from-topol) |
| Chamaileon | [From Chamaileon](/guide/migration-from-chamaileon) |
| Easy Email Pro | [From Easy Email Pro](/guide/migration-from-easy-email-pro) |
| MJML | [From MJML](/guide/migration-from-mjml) |
| HTML | [From HTML](/guide/migration-from-html) |

MJML and HTML are the catch-alls when the native format is not in that list. The Agent Skill can run an import and then refine in the live editor — [Agent Skill](/guide/agent-skill).
