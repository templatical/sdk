---
title: Migration von Easy Email Pro
description: Easy-Email-Pro-E-Mail-Templates mit @templatical/import-easy-email-pro in das Templatical-Format konvertieren.
---

# Migration von Easy Email Pro

Diese Anleitung richtet sich an Teams, die E-Mail-Templates in [Easy Email Pro](https://www.easyemail.pro) erstellt haben — im gehosteten Editor oder über ein Produkt, das ihn einbettet — und auf Templaticals visuellen Editor wechseln möchten. **`@templatical/import-easy-email-pro`** konvertiert eine Easy-Email-Pro-Persist-Seite in Templaticals `TemplateContent`-Format. Installieren Sie es, führen Sie es aus, und nutzen Sie die folgenden Abschnitte, um alles nachzuarbeiten, was es nicht automatisch abbilden kann.

Die Eingabe ist das Persist-JSON — `{ subject, content }` mit `content.type === "page"`, oder ein nacktes Seiten-Element. Es ist nicht `EditorCore.toMJML()` und nicht das kompilierte HTML.

## Installation

```bash
npm install @templatical/import-easy-email-pro
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertEasyEmailProTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-easy-email-pro/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung

```ts
import { convertEasyEmailProTemplate } from '@templatical/import-easy-email-pro';

const { content, report } = convertEasyEmailProTemplate(emailTemplate);

const editor = await init({
  container: '#editor',
  content,
});

console.log(report);
```

`convertEasyEmailProTemplate` arbeitet synchron und gibt ein `ImportResult` zurück mit:

- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes erzeugten Blocks (`converted`, `approximated`, `html-fallback` oder `skipped`)

Es akzeptiert:

- den Persist-Umschlag `{ subject, content }` mit `content.type === "page"`
- ein nacktes Seiten-Element `{ type: "page", children, attributes, data }`
- jede der beiden Formen als serialisierten JSON-String

Zusätzliche `html`- / `mjml`- / `thumbnail`- / `id`-Schlüssel auf dem Umschlag werden ignoriert.

::: tip
Übergeben Sie die Persist-Seite, nicht die Ausgabe von `EditorCore.toMJML()`. `toMJML` ist ein Compile-Pfad — MJML-Markup, das zu [`@templatical/import-mjml`](/de/guide/migration-from-mjml) gehört, nicht zu diesem Paket. Kompiliertes HTML gehört zu [`@templatical/import-html`](/de/guide/migration-from-html). Ein Rateversuch zwischen den dreien würde Markup durch den falschen Konverter schicken.

`$var(name)` ist ein Design-Token, kein Merge-Tag. Werte werden gegen die nächstgelegene Tabelle aufgelöst (zuerst Widget-`data.input`, dann `data.variables[]` der Seite). Nicht aufgelöste Reste bleiben ungesetzt und werden nicht als Empfängerfelder gespeichert.

Open-Source-Easy-Email ist ein anderes JSON (`type: "section"` / `"text"` ohne das Präfix `standard-`). Dieses Paket wirft einen eigenen Fehler, statt es falsch zu importieren. Zalify liefert `easyEmailToEasyEmailPro()` für diese Richtung.
:::

## Bericht

Jeder Eintrag in `report.entries` beschreibt einen erzeugten Block:

| Status | Bedeutung |
|---|---|
| `converted` | Auf einen Templatical-Block abgebildet, ohne Verlust. |
| `approximated` | Auf den richtigen Block abgebildet, mit einer Begrenzung oder einem Flatten — `note` nennt die Änderung. |
| `html-fallback` | Keine Block-Entsprechung vorhanden; der rohe Knoten bleibt als JSON in einem `HtmlBlock` erhalten. |
| `skipped` | Leeres `logic` — es gab keine Kinder zu konvertieren. |

```ts
console.log(report.summary);
// { total: 24, converted: 18, approximated: 5, htmlFallback: 0, skipped: 1 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`${entry.sourceTag} approximiert:`, entry.note);
  }
}
```

Eine `note` bei einem `approximated`-Eintrag nennt den ursprünglichen Wert. `report.warnings` trägt Verluste auf Dokumentebene, die an keinem einzelnen Eintrag hängen — ein nicht-leeres `subject` oder `fonts[]`, Anzahlen nicht aufgelöster `$var()`, und `mobileAttributes`, wenn irgendein Knoten sie trug.

## Dokumentform

Easy Email Pro speichert ein Design als Baum typisierter Knoten unter einer `page`:

```
EmailTemplate { subject, content }
  content: page
    data: { globalAttributes, blockAttributes, categoryAttributes, fonts, preheader, variables[] }
    attributes: { width, background-color, content-background-color, link-color, … }
    children: standard-section | standard-wrapper | standard-hero | *_widget | AMP_* | custom
      standard-section.children: standard-column | standard-group
        standard-group.children: standard-column
          standard-column.children: leaf | nested structure
```

Blätter in der dokumentierten Elementliste: `standard-paragraph`, `standard-h1`–`h4`, `standard-button`, `standard-image`, `standard-divider`, `standard-spacer`, `standard-navbar` + `standard-navbar-link`, `standard-social` + `standard-social-element`, `standard-table2`, `line-break`, `html-block-node`, `marketing-countdown`, `placeholder`. `uid` / `id` / `thumbnail` werden verworfen — Templatical vergibt eigene IDs. `placeholder` ist Editor-Chrome und wird übersprungen.

- **Easy Email Pro** speichert diesen Persist-Baum, plus optionale `variables[]` (Design-Tokens) und Seiten-`data`.
- **Templatical** speichert Templates als JSON-Baum mit typisierten Blöcken (`SectionBlock`, `ParagraphBlock` usw.) und rendert diesen Baum beim Export zu MJML.

`@templatical/import-easy-email-pro` durchläuft `page.children`, flacht `standard-group` und Widgets ab und baut daraus die entsprechenden Templatical-Blöcke. Die Mapping-Tabelle unten zeigt, was er dabei umsetzt.

## Visueller Neuaufbau

Bei einer Handvoll Templates ist der Neuaufbau von Hand neben einer Easy-Email-Pro-Vorschau schneller, als ein Paket zu installieren:

1. Öffnen Sie das Easy-Email-Pro-Design — den Editor selbst oder eine Vorschau des kompilierten HTML — in einem Fenster.
2. Öffnen Sie den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Nutzen Sie diese Vorschau als visuelles Ziel. Übergeben Sie `EditorCore.toMJML()` nicht an diesen Konverter.
4. Ziehen Sie die entsprechenden Templatical-Blöcke hinein (siehe [Mapping-Tabelle](#easy-email-pro-node-mapping) unten).
5. Kopieren Sie Textinhalte direkt. Hosten Sie Bilder über Ihre Medienbibliothek neu.
6. Bilden Sie Styling über Templaticals [Design-Tokens](/de/guide/theming) ab.

Bei größeren Mengen führen Sie zuerst `@templatical/import-easy-email-pro` aus und nutzen diesen Pfad nur, um nachzuarbeiten, was als `approximated`, `skipped` oder als `html-fallback`-Block gelandet ist.

## Renderer-Prüfung

Sobald ein Template in Templatical vorliegt — importiert oder von Hand nachgebaut:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
```

Ein visueller Vergleich mit Easy Email Pros eigener Vorschau zeigt, was der Bericht nicht zeigen kann. Mehrere der unten genannten Verluste — `mobileAttributes`, Hero-Overlay, Seiten-`fonts[]` — werden an der Stelle verworfen, an der sie gelesen werden, mit einer `note`, wenn der Konverter irgendwo andocken kann.

Es gibt kein Round-Trip-Orakel. Templatical rendert kein Easy-Email-Pro-JSON, und dieses Paket verarbeitet `EditorCore.toMJML()` nicht.

## Knoten-Abbildung {#easy-email-pro-node-mapping}

| Easy Email Pro | Templatical-Block | Hinweise |
|---|---|---|
| `page` | Template-`settings` | `width` → `settings.width`; `background-color` → `settings.backgroundColor` nach `$var`; `globalAttributes["font-family"]` / `color` → `fontFamily` / `textColor`; `link-color` → `linkColor`, wenn gesetzt; `preheader` → `settings.preheaderText`, wenn nicht leer. `content-background-color` ist die Standard-Sektionsfüllung, nicht der Seitenhintergrund. |
| `standard-section` | `SectionBlock` | Eigenes `background-color` → `section.styles.backgroundColor`; sonst das Seiten-`content-background-color`. `padding-*` → Padding. Direkte `standard-column`-Kinder, oder die Spalten in einem einzelnen `standard-group`. |
| `standard-column` | Section-`columns` / `children[i]` | Prozentbreiten (`"50%"`, `"33.33%"`) werden auf Templaticals fünf Layouts gematcht. Kein eigener Berichtseintrag. |
| `standard-group` | Abgeflachte Spalten; `stackOnMobile: false` | Eine Group aus Spalten auf einer Sektion ist die Spaltenstruktur dieser Sektion. Eine verschachtelte Group in einer Spalte wird abgeflacht, `approximated`. |
| `standard-wrapper` | Innere Sektion(en) `wrapper` | Äußeres `background-color` / Padding → `section.wrapper`. Eine innere Sektion → converted. Mehrere Innere → Wrapper auf jede kopiert, `approximated`. |
| `standard-hero` | 1-Spalten-`SectionBlock` | Kinder werden als h1 / Paragraph / Button durchlaufen. `background-color` auf die Sektion; `background-url` stellt einen `ImageBlock` voran (gestapelt, nicht Overlay), `approximated`. |
| `placeholder` | Übersprungen | Editor-Chrome. Kein Eintrag. |
| `standard-paragraph` | `ParagraphBlock` | Inhalt aus Slate-Kindern. Bleibt ein Paragraph, auch bei großer `font-size`. |
| `standard-h1`–`h4` | `TitleBlock` | `level` 1–4 aus dem Typ. |
| `standard-button` | `ButtonBlock` | Beschriftung aus den Kindern, nicht `data.content`. `href` → `url`. Ungesetztes Fill plus `border-enabled` ist outlined — Fill wird `#ffffff` (nicht das Factory-`#333333`), `approximated`. |
| `standard-image` | `ImageBlock` | `src`, `alt`; `href` → `linkUrl`. |
| `standard-divider` | `DividerBlock` | `border-color` / `border-width` / `border-style`. |
| `standard-spacer` | `SpacerBlock` | Höhe aus `height` in px. |
| `standard-navbar` + `standard-navbar-link` | `MenuBlock` | Linktext aus den Kindern; `href` → `url`; `target === "_blank"` → `openInNewTab`. |
| `standard-social` + `standard-social-element` | `SocialIconsBlock` | Plattform aus `href`-Hostname, dann `src`-Pfad. Benutzerdefiniertes PNG-`src` entfällt, `approximated`. |
| `standard-table2` / `tr` / `td` | `TableBlock` | Converted. |
| `line-break` | `<br>` | Innerhalb des Eltern-Rich-Texts. Kein Eintrag. |
| `html-block-node` | HTML-Fragment | Innerhalb des Eltern-Rich-Texts. Kein Eintrag. |
| `marketing-countdown` | Overlay-Text + `ImageBlock` von `src` | Das GIF ist der Timer. Es wird kein `type: "countdown"` erzeugt (Cloud-only). `approximated`. |
| Kit `common-video` | `VideoBlock` | Converted, wenn eine URL vorhanden ist; sonst `html-fallback`. |
| Kit shopwindow / qr-code / countdown-v2 | `HtmlBlock` | `JSON.stringify(node)`, `html-fallback`. |
| `section_widget` / `wrapper_widget` | Kinder | `$var` aus `data.input`; jeder erzeugte Eintrag `approximated`. |
| AMP_* | `HtmlBlock` | `JSON.stringify(node)`, `html-fallback`. |
| `logic` | Kinder, oder Skip | Leer → `skipped`. Nicht leer → Kinder werden konvertiert, als wäre der Wrapper nicht da; jeder erzeugte Eintrag `approximated`. Der Ausdruck wird nicht auf `displayCondition` abgebildet. |
| Jeder andere `type` | `HtmlBlock` | Der rohe Knoten bleibt als JSON erhalten, markiert als `html-fallback`. |

`visible: "desktop"` / `"mobile"` wird auf `visibility` abgebildet. Fehlt, wenn der Schlüssel fehlt.

## Verlustbehaftete Konvertierung

- **Nicht aufgelöste `$var`-Reste** — `$var(name)` wird gegen Widget-`data.input`, dann gegen `variables[]` der Seite aufgelöst. Ein Name ohne Wert bleibt ungesetzt (`""` / übrig gebliebenes `$var(…)` werden keine Merge-Tags). Eine Warnung auf Dokumentebene nennt, wie viele Werte aufgelöst wurden und wie viele unaufgelöst blieben.
- **`mobileAttributes`** — eine zweite Attributtasche für das mobile Viewport. Templatical hat kein Padding je Viewport. Verworfen. Eine Warnung auf Dokumentebene, wenn irgendein Knoten sie trug.
- **Hero-Overlay** — `standard-hero` hat keine Block-Entsprechung. Kinder laufen in eine 1-Spalten-Sektion; `background-url` wird zu einem führenden `ImageBlock`, gestapelt, nicht überlagert. Overlay-auf-Bild ist der Verlust; editierbare CTAs bleiben. `approximated`.
- **Outlined-Buttons** — `border-enabled: true` plus ungesetztes Fill hat keine Templatical-Entsprechung. Nach `createButtonBlock` wird Fill als `#ffffff` geschrieben, damit das Factory-`#333333` einen Ghost-Button nicht in eine dunkle Pille verwandelt. Der Outline entfällt; der Eintrag ist `approximated`.
- **4+ Spalten** — Templatical unterstützt fünf Spalten-Layouts (`1`, `2`, `3`, `2-1`, `1-2`). Eine Sektion mit 4, 5 oder 6 Spalten wird auf `"3"` gefaltet; überzählige Kinder hängen an den letzten Slot, `approximated`, Originalbreiten in der `note`.
- **Abflachen verschachtelter Groups** — ein `standard-group` innerhalb einer Spalte kann kein verschachtelter `SectionBlock` werden. Die Kinder der inneren Spalten werden in Dokumentreihenfolge in die Elternspalte eingefügt, `approximated`, `note` `"nested group flattened (N columns)"`. Blätter werden konvertiert; die Geometrie ist der Verlust.
- **Benutzerdefinierte Social-PNGs** — `standard-social-element` trägt ein eigenes PNG-`src`. `SocialIconsBlock` hat kein Custom-Src — es wählt ein Icon aus `platform` + `iconStyle`. Das PNG ist der Verlust; der Eintrag ist `approximated`, wenn ein Custom-`src` vorhanden war.
- **AMP** — `AMP_*`-Knoten haben keine Templatical-Entsprechung. Als JSON in einem `HtmlBlock` erhalten, `html-fallback`.
- **`logic`** — Pro-`logic.condition` / `logic.iteration` werden zur `toMJML`-Zeit nach Liquid (oder einer eigenen Engine) kompiliert. Sie sind nicht `displayCondition.{ before, after }`. Leere Knoten `skipped`. Gefüllte Knoten konvertieren ihre Kinder und verwerfen die Verzweigung.
- **Countdown als GIF** — `marketing-countdown` ist Overlay-Text plus ein `ImageBlock` von `attributes.src`. Templaticals `countdown`-Block ist Cloud-only und auf OSS leer, daher erzeugt dieses Paket ihn nicht. Das GIF ist ein statisches Bild; der Timer läuft nicht.

::: tip
Verschachtelte Groups werden abgeflacht, weil MJML eine Sektion innerhalb einer Spalte verbietet und `addBlock` das ebenfalls tut. Ein erfundener verschachtelter `SectionBlock` würde nicht rendern. Hero-Kinder werden durchlaufen, statt den ganzen Teilbaum als `html-fallback` zu legen, damit editierbare CTAs erhalten bleiben; Overlay-auf-Bild kann Templatical nicht ausdrücken. Leeres `logic` wird übersprungen statt zu einem undurchsichtigen `HtmlBlock`, sodass ein gefüllter Zweig aus Produktzeilen als konvertierte Kinder erhalten bleibt. Der Countdown bleibt ein Bild, damit ein OSS-Renderer den Block nicht leer lässt.
:::

## Nicht abgebildete Felder

- **`subject`** — Templatical-Templates haben kein Betreff-Feld. Ein nicht-leerer Wert wird in `report.warnings` genannt.
- **`fonts[]`** — keine Schrift-Datei-Tabelle auf Dokumentebene. Ein nicht-leeres Array wird in `report.warnings` genannt. Text, der davon abhing, wird in der Ersatzschriftart gerendert.
- **`headStyles`** — keine Head-Style-Tabelle auf Dokumentebene. Ein nicht-leerer Wert wird in `report.warnings` genannt.
- **`thumbnail` / `id`** — still; sie sind nicht empfängerseitig.
- **`classAttributes`** — in v1 übersprungen. Eine Warnung, wenn das Objekt nicht leer ist.
- **`breakpoint`** — still. Templatical-Mobil ist 375 / MJML 480; dieses Paket erfindet keine Einstellung.

Ein frisch importiertes Template scheitert bei der Ankunft häufig an den Barrierefreiheits-Regeln von `@templatical/quality`, und das `validate.mjs` des [Agent Skill](/de/guide/agent-skill) beendet sich dabei mit einem Exit-Code ungleich 0. Aus Easy Email Pro exportierte Bilder tragen typischerweise keinen `alt`-Text, und der Importer übernimmt diese Lücke originalgetreu — eine Beschreibung zu erfinden wäre selbst ein Anti-Pattern für Barrierefreiheit. Die strukturelle Validierung besteht; die Befunde betreffen den Inhalt. Fügen Sie den importierten Bildern Alt-Text hinzu, und die Befunde verschwinden.

## Weitere Fälle

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres Easy-Email-Pro-Persist-JSON und dem, was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-easy-email-pro` zu verbessern.
