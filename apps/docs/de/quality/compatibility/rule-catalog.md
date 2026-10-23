---
description: Regelkatalog für durchgereichtes HTML und CSS sowie kompilierte Gmail-Größe mit caniemail-Quellen und Ausnahmen.
---

# Kompatibilitäts-Regelkatalog

Dieser Katalog erklärt jede `compat.*`-Regel mit Auslöser, Ausnahmen, Schweregrad und Quelle. Datenbasierte Regeln nutzen den caniemail-Datenstand vom 2026-09-16. Pro Client gilt der zuletzt aufgeführte Test; die genannten Anmerkungen schränken die erkannte Nutzung ein.


## `compat.css-display-flex` {#compat-css-display-flex}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** `display: flex` oder `inline-flex` in durchgereichtem CSS.

**Ausnahmen:** Andere display-Werte und das SDK-Spaltenlayout.

**Einschränkung:** Anmerkung 2 stuft `inline-flex` dort als nicht unterstützt ein, wo diese Variante ausgeschlossen ist.

**Quelle:** [caniemail css-display-flex](https://www.caniemail.com/features/css-display-flex/).

## `compat.css-display-grid` {#compat-css-display-grid}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** `display: grid` oder `inline-grid` in durchgereichtem CSS.

**Ausnahmen:** Andere display-Werte und das SDK-Spaltenlayout.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail css-display-grid](https://www.caniemail.com/features/css-display-grid/).

## `compat.css-position` {#compat-css-position}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** `position: absolute`, `fixed` oder `sticky` in durchgereichtem CSS.

**Ausnahmen:** `position: relative`.

**Einschränkung:** Anmerkungen 1–4 nennen unterstützte Werte; ein erkannter Wert außerhalb der Liste gilt dort als nicht unterstützt.

**Quelle:** [caniemail css-position](https://www.caniemail.com/features/css-position/).

## `compat.css-variables` {#compat-css-variables}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Eine `var(--…)`-Referenz in einem CSS-Wert.

**Ausnahmen:** Deklarationen ohne Variablenreferenz.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail css-variables](https://www.caniemail.com/features/css-variables/).

## `compat.css-at-import` {#compat-css-at-import}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Eine `@import`-Regel in einem style-Element oder Stylesheet.

**Ausnahmen:** Text in CSS-Kommentaren.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail css-at-import](https://www.caniemail.com/features/css-at-import/).

## `compat.html-link` {#compat-html-link}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein `<link>` mit `stylesheet` in `rel`.

**Ausnahmen:** Andere `rel`-Werte.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail html-link](https://www.caniemail.com/features/html-link/).

## `compat.html-style` {#compat-html-style}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein `<style>`-Element in durchgereichtem HTML, das im E-Mail-Body landet.

**Ausnahmen:** Von MJML im Head erzeugte Stile.

**Einschränkung:** Anmerkung 1 schließt `<style>` im `<body>` aus, auch wenn der Client es im Head unterstützt.

**Quelle:** [caniemail html-style](https://www.caniemail.com/features/html-style/).

## `compat.html-svg` {#compat-html-svg}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein eingebettetes `<svg>`-Element.

**Ausnahmen:** Eine verlinkte SVG-Bild-URL; die Regel liest Elemente statt verlinkter Bildformate.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail html-svg](https://www.caniemail.com/features/html-svg/).

## `compat.html-form` {#compat-html-form}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein `<form>`-, `<input>`-, `<select>`- oder `<textarea>`-Element.

**Ausnahmen:** Ein Link zu einem Webformular.

**Einschränkung:** Gmail Web unterstützt Formulare; Outlook Windows nicht. Die Regel nutzt Client-Daten statt einer pauschalen Behauptung.

**Quelle:** [caniemail html-form](https://www.caniemail.com/features/html-form/).

## `compat.html-object` {#compat-html-object}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein `<object>`-Element.

**Ausnahmen:** Ein verlinktes Bild.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail html-object](https://www.caniemail.com/features/html-object/).

## `compat.html-video` {#compat-html-video}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein eingebettetes `<video>`-Element.

**Ausnahmen:** Der SDK-Video-Block, der ein verlinktes Vorschaubild ausgibt.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail html-video](https://www.caniemail.com/features/html-video/).

## `compat.html-audio` {#compat-html-audio}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Ein eingebettetes `<audio>`-Element.

**Ausnahmen:** Ein Link zu einer Audiodatei.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail html-audio](https://www.caniemail.com/features/html-audio/).

## `compat.css-width` {#compat-css-width}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Inline-`width` auf `div`, `p`, `span` oder `body` oder auf `img` ohne width-Attribut.

**Ausnahmen:** Breite einer Tabellenzelle oder eines Bildes mit width-Attribut.

**Einschränkung:** Anmerkung 1 schließt diese Elemente in betroffenen Clients aus.

**Quelle:** [caniemail css-width](https://www.caniemail.com/features/css-width/).

## `compat.css-max-width` {#compat-css-max-width}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Inline-`max-width` auf einem Element außer `table`.

**Ausnahmen:** `max-width` auf einer Tabelle.

**Einschränkung:** Anmerkung 1 erlaubt in betroffenen Clients nur Tabellen.

**Quelle:** [caniemail css-max-width](https://www.caniemail.com/features/css-max-width/).

## `compat.css-float` {#compat-css-float}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Eine `float`-Deklaration in einem Inline-Stil oder Stylesheet.

**Ausnahmen:** Layout aus SDK-Sektionen und Spalten.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail css-float](https://www.caniemail.com/features/css-float/).

## `compat.css-background-image` {#compat-css-background-image}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Eine CSS-Hintergrund-URL ohne `background-color`, Farbe in der `background`-Kurzform oder `bgcolor`.

**Ausnahmen:** Ein Hintergrund mit einer dieser Ersatzfarben.

**Einschränkung:** Keine Einschränkung durch Anmerkungen.

**Quelle:** [caniemail css-background-image](https://www.caniemail.com/features/css-background-image/).

## `compat.image-base64` {#compat-image-base64}

**Standardschweregrad:** `warning`, wenn ein Client keine Unterstützung bietet; `info`, wenn nur teilweise Unterstützung vorliegt.

**Auslöser:** Eine `data:image/`-URL in einem durchgereichten Bild, background-Attribut, CSS-URL oder unterstützten Block-URL-Feld.

**Ausnahmen:** Gehostete Bild-URLs und Nicht-Bild-Daten-URLs. Der Auszug enthält nur den Medientyp.

**Einschränkung:** Anmerkung 1 schließt GIF aus; Anmerkung 3 unterstützt nur PNG.

**Quelle:** [caniemail image-base64](https://www.caniemail.com/features/image-base64/).

## `compat.html-script` {#compat-html-script}

**Standardschweregrad:** `warning`.

**Auslöser:** Ein `<script>`-Element. E-Mail-Clients führen dessen JavaScript nicht aus.

**Beleg:** Eigene Warnung; caniemail hat keinen Test für dieses Element.

## `compat.html-iframe` {#compat-html-iframe}

**Standardschweregrad:** `warning`.

**Auslöser:** Ein `<iframe>`-Element, dessen eingebetteter Inhalt in den meisten E-Mail-Clients blockiert wird.

**Beleg:** Eigene Warnung; caniemail hat keinen Test für dieses Element.

## `compat.gmail-clipping` {#compat-gmail-clipping}

**Standardschweregrad:** `warning`.

**Auslöser:** Kompiliertes HTML über `thresholds.maxHtmlBytes` (standardmäßig `92_160` UTF-8-Bytes); Gleichheit besteht die Prüfung.

**Wo die Regel läuft:** Nie in `lintTemplate` oder in der Live-Liste des Issues-Panels. Drei Stellen messen sie: `lintCompiledHtml(html)` mit HTML, das Sie selbst kompilieren; `templatical validate --html`, das die optionale Peer-Abhängigkeit `mjml` braucht (ohne sie Exit-Code 3); und die Prüfung **E-Mail-Größe** im Editor, die nur erscheint, wenn der [Render-Provider](/de/backend/render) `toHtml` oder `compileMjml` implementiert, und nicht im Cloud-Modus.

**Beleg:** Nur `lintCompiledHtml` prüft dies; Template-JSON und durchgereichte Inhalte schätzen die kompilierte Größe nicht. Google dokumentiert die Grenze von etwa 102 KB nicht; sie stammt aus Community-Tests, die auch ein Kürzen unterhalb der Grenze zeigen, sobald ein Versanddienst Markup ergänzt.

[email-bugs#41: Gmail kürzt E-Mails ab 102 kB](https://github.com/hteumeuleu/email-bugs/issues/41).
