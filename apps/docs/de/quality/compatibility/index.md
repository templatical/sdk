---
description: Prüfen Sie unverändert übernommenes HTML und CSS anhand von caniemail und messen Sie kompiliertes HTML für Gmail-Clipping.
---

# Kompatibilitäts-Linter

`lintCompatibility(content, options?)` meldet HTML und CSS in unverändert übernommenen Inhalten, die in E-Mail-Clients Inhalt oder Layout verlieren. Die Regeln nutzen [caniemail](https://www.caniemail.com/) für Client-Supportdaten. Die vom Renderer selbst erzeugte Ausgabe wird nicht geprüft; dafür ist MJML zuständig.

Der gebündelte caniemail-Datenstand ist vom **2026-09-16**. Für jede Client-Plattform gilt der zuletzt aufgeführte Test. `warning` bedeutet, dass mindestens ein aufgeführter Client das erkannte Merkmal nicht unterstützt; `info` bedeutet ausschließlich teilweise Unterstützung. Der [Regelkatalog](./rule-catalog) nennt Auslöser, Ausnahmen und Quellen. `<script>` und `<iframe>` sind eigene Warnungen ohne caniemail-Test.

## Prüfumfang

Der Linter liest den Inhalt von HTML-, Absatz- und Titelblöcken, Tabellenzellen sowie `renderedHtml` und `renderedStylesheet` von Custom-Blöcken. Er prüft außerdem Bild-`src`, Video-`thumbnailUrl` und Hintergrundbild-URLs von Sektionen, Sektions-Wrappern und Wrapper-Blöcken auf Base64-Bilder. CSS in style-Attributen, `<style>`-Elementen und Custom-Stylesheets zählt dazu. Pro Regel und Block entsteht höchstens ein Issue mit `suggestion`, `reference` und bei datenbasierten Treffern `clients` und kurzem `excerpt`.

MJML-generierte Ausgabe gehört nicht zum Prüfumfang. Die Outlook-Hintergrundregeln in `structure.*` bleiben Strukturregeln, weil sie SDK-Layoutfelder betreffen. Verlinkte SVG-, WebP- und AVIF-Bilder sind von diesen Regeln ausgenommen.

## API und Optionen

```ts
import { readFile } from "node:fs/promises";
import { lintCompatibility, lintHtmlFragment } from "@templatical/quality";

const content = JSON.parse(await readFile("template.json", "utf8"));
const issues = lintCompatibility(content);
const fragmentIssues = lintHtmlFragment('<div style="display:flex">Hi</div>', {
  stylesheet: ".card { position: absolute }",
  locale: "de",
});
```

`lintTemplate` führt die Kompatibilitätsregeln nach Barrierefreiheit, Struktur, Links und Zustellbarkeit aus. Mit `compatibility: false` deaktivieren Sie die Kategorie, mit `"off"` in `compatibility.rules` eine einzelne Regel. `compatibility.thresholds.maxHtmlBytes` ist standardmäßig `92_160` Byte (90 KiB). Nur wenn alle fünf Kategorien auf `false` stehen, lädt der Editor den optionalen Quality-Chunk nicht.

`lintCompiledHtml(html, options?)` misst UTF-8-Bytes und meldet `compat.gmail-clipping` erst oberhalb dieser Grenze. Google veröffentlicht keinen Grenzwert für das Kürzen; Community-Tests in [email-bugs#41](https://github.com/hteumeuleu/email-bugs/issues/41) zeigen, dass Gmail bei **etwa 102 KB** kürzt, manchmal schon früher, wenn ein Versanddienst eigenes Markup ergänzt. Der Abstand berücksichtigt Tracking-Links von Versanddiensten. Quality rendert und kompiliert selbst kein HTML:

```ts
import { readFile } from "node:fs/promises";
import { renderToMjml } from "@templatical/renderer";
import { lintCompiledHtml } from "@templatical/quality";
import mjml2html from "mjml";

const content = JSON.parse(await readFile("template.json", "utf8"));
const mjml = await renderToMjml(content);
const html = (await mjml2html(mjml, { validationLevel: "soft" })).html;
const sizeIssues = lintCompiledHtml(html);
```

Installieren Sie `mjml` für dieses Beispiel separat. Im Issues-Panel des Editors erscheint der Abschnitt **E-Mail-Größe**, wenn der Render-Provider `toHtml` oder `compileMjml` anbietet. Er erklärt, dass Gmail E-Mails über etwa 102 KB abschneidet. Mit **Größe prüfen** wird das kompilierte HTML gemessen. Ohne Clipping-Warnung erscheint die Größe mit dem Hinweis, dass Gmail die ganze E-Mail anzeigt; bei Überschreitung erscheint die Größe zusammen mit einer Clipping-Warnung in der Problemliste. Nach einer Änderung bleibt die letzte Größe mit einem Hinweis auf die veraltete Prüfung sichtbar und der Button heißt **Erneut prüfen**. Im Cloud-Modus fehlt der Abschnitt, weil der derzeitige HTML-Renderpfad zuerst speichert.

## Prüfen

Speichern Sie dieses Template als `template.json`:

```json
{"blocks":[{"id":"html_1","type":"html","content":"<svg width=\"40\" height=\"40\"><circle cx=\"20\" cy=\"20\" r=\"18\"/></svg>","styles":{"padding":{"top":10,"right":10,"bottom":10,"left":10}}}],"settings":{"width":600,"backgroundColor":"#ffffff","textColor":"#1a1a1a","linkUnderline":true,"fontFamily":"Arial","locale":"en"}}
```

```bash
npx @templatical/template-tools validate template.json --html --json
```

Mit installiertem optionalem `mjml` liefert die gebaute CLI Exit-Code `0` und `htmlBytes: 4181`. Die Ausgabe enthält dieses Issue (ausgewählte Felder aus dem tatsächlichen Ergebnis):

```json
{"blockId":"html_1","ruleId":"compat.html-svg","severity":"warning","suggestion":"Use a PNG or JPEG image instead.","reference":"https://www.caniemail.com/features/html-svg/","excerpt":"<svg>"}
```

`--html` kompiliert einmal. Ohne `mjml` liefert es Exit-Code `3` mit Installationshinweis, bevor es etwas ausgibt. Kompatibilitätswarnungen und Hinweise führen bei einem strukturell gültigen Template nicht zu Exit-Code `1`.
