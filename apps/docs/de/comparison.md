---
title: Vergleich
description: Wie Templatical im Vergleich zu Beefree SDK, Unlayer und GrapesJS + MJML abschneidet — ehrliche Stärken, Schwächen und wann welches Tool die richtige Wahl ist.
---

# Wie Templatical im Vergleich abschneidet

Wenn du einen einbettbaren E-Mail-Editor auswählst, hast du wahrscheinlich **Beefree SDK**, **Unlayer** und **GrapesJS + MJML** auf der Liste. Diese Seite ist ein gerader, faktengeprüfter Vergleich — damit du das passende Werkzeug für dein Team wählst, inklusive der Fälle, in denen ein anderes Produkt besser passt als Templatical.

Jede Aussage ist am Ende der Seite mit einer Quelle belegt. Sollte etwas veraltet sein, [öffne ein Issue](https://github.com/templatical/sdk/issues) und wir korrigieren es.

## Auf einen Blick

|  | **Templatical** | Beefree SDK | Unlayer | GrapesJS + MJML |
|---|---|---|---|---|
| **Lizenz** | FSL-1.1-MIT (wird nach 2 Jahren MIT) | Closed Source | Wrapper MIT, Editor closed | BSD-3-Clause |
| **Selbst hostbar** | ✅ Vollständig | ❌ Nur als iframe | ❌ Nur als iframe | ✅ Vollständig |
| **Ausgabeformat** | MJML (nativ) | Proprietäres JSON → HTML via Cloud-API | Proprietäres JSON → HTML via Cloud-API | MJML (über Plugin) |
| **Framework** | Aus jedem Framework einbindbar (Vue+TipTap-Canvas) | iframe-SDK (jeder Host) | React-First-Wrapper, iframe innen | Vanilla JS, React-Wrapper verfügbar |
| **Block-/Modul-Bibliothek** | 14 typisierte Blocktypen | E-Mail + Page + Popup + Document-Builder | E-Mail + Page + Popup + Document-Builder | ~20 MJML-Komponenten |
| **API für eigene Blöcke** | ✅ Offene API | Nur in bezahlten Tarifen (Superpowers, $2.500/Monat) | Nur in bezahlten Tarifen (Scale, $750/Monat) | ✅ Offene Plugin-API |
| **KI-Umschreibung / Generierung** | ✅ Cloud (oder OSS-Code selbst hosten) | Bezahlter Tarif (Schreibassistent, Bildgenerierung, Alt-Text) | Bezahlter Tarif (Scale+ Schreibassistent) | ❌ |
| **Echtzeit-Zusammenarbeit** | ✅ Cloud (oder OSS-Code selbst hosten) | Bezahlter Tarif ($2.500/Monat) | Nur auf Team-Ebene (kein Block-Locking) | ❌ |
| **Kommentare / Review** | ✅ Cloud (oder OSS-Code selbst hosten) | Bezahlter Tarif | Nur Audit-Tab | ❌ |
| **Merge-Tags** | ✅ Eingebaut | ✅ Eingebaut | ✅ Eingebaut (Smart Tags ab Scale+) | ❌ Selbst implementieren |
| **Anzeigebedingungen** | ✅ Eingebaut | ✅ Eingebaut | ⚠️ Laut Reviews eingeschränkt | ❌ |
| **Eingebauter Dunkelmodus** | ✅ | ⚠️ Nur Editor-UI | ⚠️ Nur Editor-UI | ❌ |
| **Zweisprachige i18n (en/de)** | ✅ Eingebaut, mit Schlüssel-Paritätstests | ✅ Editor-UI in 21 Sprachen | ⚠️ Lokalisierung erst ab Launch+ | ⚠️ Community |
| **TypeScript** | ✅ Strict, Ende-zu-Ende | Type-Defs nur am SDK | Wrapper-Types, Editor undurchsichtig | ✅ Core ist TS |
| **Embed-Preisuntergrenze (kostenpflichtig)** | Kostenlos / Self-Host | $350–$5.000+/Monat | $250–$2.000+/Monat | Kostenlos |

## Warum diese Zeilen wichtig sind

Das Interessante an dieser Tabelle ist nicht eine einzelne Zeile — es ist, wo die Zeilen sich **häufen**.

**Eigene Blöcke, Echtzeit-Zusammenarbeit, KI-Umschreibung, Kommentare, vollständiges Theming.** Bei Beefree schalten diese Funktionen ab dem **Superpowers**-Tarif ($2.500/Monat) frei — Beefrees eigene Preisseite listet eigene Blöcke und Echtzeit-Co-Editing als Superpowers-und-höher-Funktionen. Bei Unlayer schalten eigene Blöcke ab **Scale** ($750/Monat) frei und eigenes CSS ab **Optimize** ($2.000/Monat). Bei GrapesJS existieren mehrere dieser Funktionen out of the box gar nicht und du baust sie selbst.

In Templatical sind alle fünf Teil des Open-Source-SDKs oder als lesbarer Code in [`@templatical/core/cloud`](https://github.com/templatical/sdk/tree/main/packages/core/src/cloud) verfügbar.

Konkret:

- 🧩 **[Eigene Blöcke mit API-gestützten Datenquellen](/de/guide/custom-blocks)** — deine Domänen-Entitäten (Deals, Kontakte, Produkte) werden zu first-class Drag-and-Drop-Blöcken, mit Inhalten, die zur Preview-Zeit live aus deiner API geladen werden.
- 🏷️ **[Merge-Tags mit pluggable Syntax](/de/guide/merge-tags)** — Handlebars, Liquid, JS-Literale oder eigene Syntax — mit automatischer lesbarer Label-Ersetzung direkt im Editor-Canvas.
- 👁️ **[Anzeigebedingungen](/de/guide/display-conditions)** — Blöcke je nach Empfängerattributen ein-/ausblenden mit Live-Preview im Editor.
- 🎨 **[Vollständiges Theming über Design-Tokens](/de/guide/theming)** — 27 OKLch-Tokens, eigene Schriften, Dark Mode. Kein CSS-Hacking, kein bezahlter Tarif.
- 📐 **[Template- & Block-Defaults](/de/guide/defaults)** — Marke einmal definieren; neue Templates und Blöcke übernehmen sie automatisch.
- 👥 **[Echtzeit-Zusammenarbeit mit Block-Level-Locking](/de/cloud/collaboration)** *(Cloud, auch OSS-Code)* — Multi-User-Co-Editing ohne Konflikte.
- ✨ **[KI-Umschreibung & KI-Chat](/de/cloud/ai)** *(Cloud, auch OSS-Code)* — eigenen LLM-Key mitbringen, die Implementierung ist offener Code.

Das ist der praktische Effekt von "Open Source" jenseits des Lizenz-Badges.

## Templatical

**Open-Source, MJML-Ausgabe, vollständig typisiert, selbst hostbarer E-Mail-Editor — mit optionalen Cloud-Funktionen, die entweder als gemanagter Tarif oder als lesbarer OSS-Code zum Selbst-Hosten verfügbar sind.**

Drei bewusste Entscheidungen prägen das Design:

1. **JSON rein, MJML raus.** Templates sind portables JSON (versionierbar, diff-bar, KI-freundlich). Die Ausgabe ist MJML — also [universelle E-Mail-Client-Kompatibilität](https://documentation.mjml.io/) ohne Abhängigkeit von einer Render-API eines Anbieters.
2. **Überall einbettbar.** Der Canvas ist Vue 3 + TipTap, aber du bindest ihn über eine Vanilla-`init()`-Funktion ein — mit erstklassigen Beispielen für React, Vue, Svelte, Angular und reines JS.
3. **Cloud-Funktionen sind offener Code.** KI-Umschreibung, Echtzeit-Zusammenarbeit mit Block-Locking, Kommentare, Bewertung, Snapshots — alles liegt im Subpfad [`@templatical/core/cloud`](https://github.com/templatical/sdk/tree/main/packages/core/src/cloud) unter FSL-1.1-MIT. Nutze den gemanagten Cloud-Tarif oder betreibe dein eigenes Backend.

**Wähle Templatical, wenn:**
- Du deinen E-Mail-Editor besitzen willst (Lizenz + Self-Host), ohne ihn von Grund auf zu schreiben.
- MJML-Kompatibilität für E-Mail-Clients wichtiger ist als ein proprietärer HTML-Renderer.
- Du TypeScript magst und Ende-zu-Ende-Typsicherheit willst.
- Du Zusammenarbeit, KI und Kommentare ohne Enterprise-pro-Sitz-Preise willst.
- Du einen fokussierten, modernen E-Mail-Editor willst und einen Maintainer, der schnell ausliefert.

**Wähle Templatical NICHT, wenn:**
- Du Popup-, Page- oder Document-Builder im selben Tool brauchst — Templatical ist bewusst E-Mail-First.
- Du ab Tag eins eine Bibliothek mit über 1.000 Templates brauchst — die liefern wir noch nicht mit.
- Dein Team jegliche Vue-Abhängigkeit strikt verbietet, auch eine, die per Vanilla-JS-API eingebettet wird.

## Beefree SDK

**Reifer gehosteter Editor mit dem tiefsten Funktionsumfang am Markt, preislich auf finanzierte Startups und Unternehmen ausgelegt.**

Beefree SDK läuft als gehostetes iframe, ausgeliefert von Beefrees Servern. Templates werden in Beefrees proprietärem JSON-Format gespeichert und über Beefrees [Content Services API](https://docs.beefree.io/beefree-sdk/apis/content-services-api/export) in HTML gerendert. Das Produkt umfasst E-Mail-, Page-, Popup- und Document-Builder, mit gehosteten Saved Rows, synchronisierten Rows, mehrsprachigen Templates und einer Editor-UI in 21 Sprachen.

**Preise** ([Quelle](https://developers.beefree.io/pricing-plans)): Free → Essentials **$350/Monat** → Core **$1.000/Monat** → Superpowers **$2.500/Monat** → Enterprise **$5.000/Monat**, mit nutzungsbasierten Per-User-Aufschlägen. Die Template-Catalog-API mit über 1.500 Templates ist ein separates Add-on. Ein Startup-Programm bietet 12 Monate lang 90 % Rabatt ([Quelle](https://developers.beefree.io/startup-program)).

**Tier-Beschränkungen** (laut Beefrees Preisseite): Echtzeit-Co-Editing und eigene Blöcke ab Superpowers. KI-Funktionen (Schreibassistent, Text-zu-Bild, Alt-Text, Übersetzung) verteilen sich je nach Funktion auf bezahlte Tarife.

## Unlayer

**Einfacher React-Drop-in um einen gehosteten Editor. Der schnellste Weg zu einem eingebetteten Editor in einer React-App.**

Unlayer veröffentlicht [`react-email-editor`](https://github.com/unlayer/react-email-editor) unter MIT — eine Wrapper-Komponente, die den Editor als iframe von Unlayers Servern lädt. Self-Hosting des Editors wird nicht angeboten ([Upstream-Issue #99](https://github.com/unlayer/react-email-editor/issues/99)). Unlayers Produkt umfasst E-Mail-, Page-, Popup- und Document-Builder.

**Preise** ([Quelle](https://unlayer.com/pricing)): Free → Launch **$250/Monat** → Scale **$750/Monat** → Optimize **$2.000/Monat** → Enterprise nach Vereinbarung.

**Tier-Beschränkungen** (laut Unlayers Preisseite): eigene Blöcke und KI-gestütztes Schreiben ab Scale; eigenes CSS und Themes ab Optimize; "Custom OpenAI Connector" im Enterprise-Tarif. Die Ausgabe erfolgt als HTML über Unlayers Render-API in den bezahlten Tarifen.

## GrapesJS + MJML-Preset

**Open-Source-Web-Builder-Framework, das du mit dem MJML-Plugin kombinieren kannst, um dir einen E-Mail-Editor selbst zu bauen.**

[GrapesJS](https://github.com/GrapesJS/grapesjs) ist ein BSD-3-Clause-Web-Builder-Framework mit großer Community (25k+ Sterne, 190+ Mitwirkende). Das [offizielle MJML-Plugin](https://github.com/GrapesJS/mjml) ergänzt MJML-Komponenten und Live-MJML-Kompilierung. GrapesJS ist ein Framework, kein E-Mail-Produkt — Funktionen wie KI-Umschreibung, Echtzeit-Zusammenarbeit, Kommentare, Merge-Tags und Anzeigebedingungen sind nicht Teil des Cores oder des MJML-Presets; du implementierst sie über die Plugin-API oder ziehst Drittanbieter-Plugins hinzu.

**Preis:** Kostenlos. Kommerzielle Templates und Presets werden von Drittanbietern verkauft (z. B. [gjs.market](https://gjs.market/grapesjs-email)).

## Wo Templatical hineinpasst

Templatical ist der Open-Source, MJML-ausgebende, vollständig typisierte, selbst hostbare E-Mail-Editor mit optionalen Cloud-Features als offenem Code — ein fokussiertes, E-Mail-First-Produkt, kein generischer Page-Builder mit nachträglich angeflanschtem E-Mail-Modus und kein geschlossenes iframe-SDK.

Wir investieren in Architektur, Offenheit, Ausgabeformat und Preisuntergrenze. Wenn das für dein Team zählt, [fang hier an](/de/getting-started/installation).

## Quellen

Preise und Funktionsangaben Stand April 2026. Falls etwas veraltet ist, bitte [ein Issue öffnen](https://github.com/templatical/sdk/issues) — wir korrigieren es.

- Beefree SDK Preise: <https://developers.beefree.io/pricing-plans>
- Beefree Content Services API: <https://docs.beefree.io/beefree-sdk/apis/content-services-api/export>
- Beefree Startup-Programm: <https://developers.beefree.io/startup-program>
- Unlayer Preise: <https://unlayer.com/pricing>
- Unlayer Self-Host-Issue: <https://github.com/unlayer/react-email-editor/issues/99>
- Unlayer Wrapper-Lizenz: <https://github.com/unlayer/react-email-editor/blob/master/LICENSE>
- GrapesJS Repo: <https://github.com/GrapesJS/grapesjs>
- GrapesJS MJML-Plugin: <https://github.com/GrapesJS/mjml>
- MJML-Dokumentation: <https://documentation.mjml.io>
