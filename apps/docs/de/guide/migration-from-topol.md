---
title: Migration von Topol
description: Topol.io-E-Mail-Templates mit @templatical/import-topol in das Templatical-Format konvertieren.
---

# Migration von Topol

Diese Anleitung richtet sich an Teams, die E-Mail-Templates im Drag-and-Drop-Editor von [Topol.io](https://topol.io) erstellt haben — direkt, oder über ein Produkt, das ihn einbettet — und auf Templaticals visuellen Editor wechseln möchten. **`@templatical/import-topol`** konvertiert ein Topol-Design direkt in Templaticals `TemplateContent`-Format — installieren Sie es, führen Sie es aus, und nutzen Sie die folgenden Abschnitte, um alles nachzuarbeiten, was es nicht automatisch abbilden kann.

## Installation

```bash
npm install @templatical/import-topol
```

### Ohne Build-Schritt (CDN)

Sie können es auch von einem CDN laden:

```html
<script type="module">
  import { convertTopolTemplate } from 'https://cdn.jsdelivr.net/npm/@templatical/import-topol/+esm';
  // ...dann konvertieren wie im Abschnitt „Verwendung“ unten
</script>
```

## Verwendung

```ts
import { convertTopolTemplate } from '@templatical/import-topol';

// Topols REST-API umschließt das Design als { id, name, html, json } —
// verwenden Sie das "json"-Feld der Antwort, nicht die Antwort selbst.
const res = await fetch('https://api.topol.io/v1/designs/123').then((r) => r.json());

// In das Templatical-Format konvertieren
const { content, report } = convertTopolTemplate(res.json);

// Im Editor verwenden
const editor = await init({
  container: '#editor',
  content,
});

// Konvertierungsbericht auf Auffälligkeiten prüfen
console.log(report);
```

`convertTopolTemplate` arbeitet synchron und gibt ein `ImportResult` zurück mit:
- `content` — das konvertierte `TemplateContent`, bereit für den Editor
- `report` — ein Konvertierungsbericht mit dem Status jedes Quellknotens (`converted`, `approximated`, `html-fallback` oder `skipped`)

Es akzeptiert das Design auch als serialisierten JSON-String, für Aufrufer, die es auf diese Weise speichern oder übertragen.

::: tip
Übergeben Sie das Design-Objekt selbst, nicht Topols gesamte API-Antwort — die Antwort umschließt es als `{ id, name, html, json }`, verwenden Sie also `.json`. Wird das Antwortobjekt versehentlich übergeben — als Objekt oder als JSON-String —, erkennt der Konverter das: Er sieht den `json`-Schlüssel und nennt `.json` direkt in der Fehlermeldung. Eine Wurzel mit einer anderen Form — kein Objekt, nicht parsbares JSON, oder ein Objekt ohne erkennbaren `tagName` und ohne `json`-Schlüssel — wirft weiterhin einen Fehler und nennt, was erwartet wurde. Das Design wird explizit ausgepackt statt automatisch erkannt, denn ein Rateversuch riskiert, den `html`-String der Hülle zu importieren — eine Ausgabe, die zu `@templatical/import-html` gehört, nicht zu diesem Paket.
:::

## Den Bericht lesen

Jeder Eintrag in `report.entries` beschreibt einen Quellknoten:

| Status | Bedeutung |
|---|---|
| `converted` | Jedes Attribut mit einer Templatical-Entsprechung wurde übernommen. |
| `approximated` | Auf den richtigen Block abgebildet, aber ein Wert musste auf einen begrenzten Wertebereich angepasst werden — `note` nennt, was angepasst wurde. |
| `html-fallback` | Keine Block-Entsprechung vorhanden; der rohe Knoten bleibt als JSON in einem `HtmlBlock` erhalten. |
| `skipped` | Reserviert für die Parität mit den anderen `@templatical/import-*`-Paketen — dieser Konverter erzeugt diesen Status derzeit nicht. |

```ts
console.log(report.summary);
// { total: 161, converted: 152, approximated: 9, htmlFallback: 0, skipped: 0 }

for (const entry of report.entries) {
  if (entry.status === 'approximated') {
    console.warn(`<${entry.sourceTag}> approximiert:`, entry.note);
  }
}
// <mj-social> approximiert: Icon size 35px is not one of 24/32/48px; resolved to "medium".
```

Eine `note` bei einem `approximated`-Eintrag nennt immer den ersetzten Wert — ein Diff von `report.entries` zwischen zwei Durchläufen zeigt so genau, was eine Migration verändert hat. `report.warnings` trägt die wenigen Verluste auf Dokumentebene, die an keinem einzelnen Eintrag hängen — eine verworfene Zeilenhöhe des Dokuments zum Beispiel, behandelt weiter unten unter „Was sich nicht automatisch überträgt“.

## Was hier eigentlich passiert

Topols eigener JSON-Baum spricht bereits in MJML-förmigen Tags — `mj-section`, `mj-column`, `mj-text`, `mj-button` und so weiter — obwohl Topol selbst kein MJML ist. Sein Wurzelknoten ist `mj-global-style`, nicht MJMLs `<mjml>`/`<mj-body>`-Paar, und einige Tags verpacken Informationen anders: Ein einzelner `mj-social`-Knoten trägt jedes Icon als `<platform>-href`-Attribute, statt wie bei handgeschriebenem MJML `mj-social-element`-Kindelemente zu verschachteln. Reicher Inhalt liegt in einem `content`-Feld neben den `attributes` jedes Knotens, nicht darin.

- **Topol** speichert ein Design als diesen Baum aus tag-förmigen Knoten, plus ein Wurzel-`attributes`-Objekt mit Style-Defaults pro Tag und pro Selektor — dieselbe Rolle, die MJMLs `<mj-attributes>` spielt, hier auf die Wurzel abgeflacht statt unter `<mj-head>` verschachtelt.
- **Templatical** speichert Templates als JSON-Baum mit typisierten Blöcken (`SectionBlock`, `ParagraphBlock` usw.) und rendert diesen Baum beim Export zu MJML.

`@templatical/import-topol` durchläuft den Topol-Baum, löst die Attribute jedes Knotens gegen die Tag- und Selektor-Defaults der Wurzel auf und baut daraus den entsprechenden Templatical-Block. Die Tag-Mapping-Tabelle unten zeigt, was er dabei umsetzt.

## Pfad 1 — Visuell mit Ihrem Topol-Export als Referenz neu aufbauen

Bei einer Handvoll Templates ist der Neuaufbau von Hand neben Ihrem Topol-Export oft schneller, als ein Paket zu installieren:

1. Öffnen Sie Ihr Topol-Design — den Editor selbst oder den JSON-Export — in einem Fenster.
2. Öffnen Sie den Templatical-Editor (oder den [Playground](https://play.templatical.com)) daneben.
3. Nutzen Sie Topols eigene Vorschau oder das `html`-Feld aus seiner API-Antwort als visuelles Ziel.
4. Ziehen Sie die entsprechenden Templatical-Blöcke hinein (siehe [Mapping-Tabelle](#topol-tag-mapping) unten).
5. Kopieren Sie Textinhalte direkt. Hosten Sie Bilder über Ihre Medienbibliothek neu.
6. Bilden Sie Styling über Templaticals [Design-Tokens](/de/guide/theming) ab, statt über Topols eigene Attribut-Defaults.

Die meisten Topol-Templates sind in 10–20 Minuten umgezogen, sobald Sie eines oder zwei gemacht haben. Bei größeren Mengen führen Sie zuerst `@templatical/import-topol` aus und nutzen diesen Pfad nur, um nachzuarbeiten, was als `approximated` oder als `html-fallback`-Block gelandet ist.

## Pfad 2 — Templaticals Renderer zur Verifikation nutzen

Sobald ein Template in Templatical vorliegt — importiert oder von Hand nachgebaut:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content);
// Mit Ihrer eigenen MJML-Bibliothek kompilieren und das Ergebnis mit
// Topols eigenem `html`-Feld vergleichen, aus derselben API-Antwort, die auch `json` trägt.
```

Ein visueller Vergleich zeigt, was der Bericht nicht zeigen kann. Mehrere der unten genannten Verluste — am sichtbarsten das Hintergrundbild einer Section — werden vom Importer nie gelesen, sodass nichts in `report.entries` darauf hinweist.

## Topol-Tag-Mapping {#topol-tag-mapping}

| Topol-Tag | Templatical-Block | Hinweise |
|---|---|---|
| `mj-section` (mit `mj-column`-Kindern) | `SectionBlock` mit `columns` | Spaltenbreiten kommen aus dem `width`-Prozentwert jeder Spalte oder werden gleichmäßig verteilt; ein Verhältnis außerhalb von Templaticals fünf Layouts wird auf das nächstliegende aufgelöst. |
| `mj-column` | Section-Spalte | Hält eine Liste verschachtelter Blöcke. |
| `mj-text` | `TitleBlock` oder `ParagraphBlock` | Eine einzelne Überschrift, die den gesamten Inhalt umschließt, wird zu `TitleBlock`; alles andere wird zu `ParagraphBlock`. |
| `mj-button` | `ButtonBlock` | `href`, `background-color`, `color`, Schrift und `padding` als äußerer Abstand des Blocks — sein `margin` überlebt nicht. |
| `mj-image` | `ImageBlock` | `src`, `alt`, `href`, `width`, Padding. |
| `mj-gif` | `ImageBlock` | Dieselben Felder wie `mj-image` — Templatical hat keinen eigenen GIF-Block. |
| `mj-divider` | `DividerBlock` | `border-color`, `border-width`, `border-style`, Padding. |
| `mj-spacer` | `SpacerBlock` | `height`. |
| `mj-social` | `SocialIconsBlock` | Jede Plattform, die in der `display`-Liste des Knotens genannt ist und ein passendes `<platform>-href` hat, wird zu einem `SocialIcon`. Topol packt jedes Icon auf die Attribute dieses einen Knotens, statt wie bei handgeschriebenem MJML `mj-social-element`-Kindelemente zu verschachteln. |
| Wurzel-`attributes` (plus `background-color` von `mj-container`) | Template-`settings` | Ein bloßes `:color` / `a:color` setzt die Text-/Link-Farbe des Dokuments; Selektor-Defaults (`h1:font-family` und Ähnliches) setzen die Schriftart einer Überschrift, wenn diese selbst keine festlegt. Ein eigenes Attribut des Knotens gewinnt immer gegen diese Defaults. |
| Alles andere | `HtmlBlock` | Für das Tag existiert kein Templatical-Block; der rohe Knoten bleibt als JSON erhalten, markiert als `html-fallback`. |

## Wo das Mapping verlustbehaftet ist

Jedes Blatt-Tag in der Mapping-Tabelle oben wird konvertiert — Topols eigener Editor erzeugt in der Praxis nichts, das dieser Importer als `html-fallback` behandelt. Innerhalb dessen sind einige Konvertierungen Näherungen statt exakter Treffer, jede davon als `approximated`-Eintrag mit einer `note` in `report.entries` festgehalten:

- **Spalten-Geometrie** — Templatical unterstützt fünf Spalten-Layouts (`1`, `2`, `3`, `2-1`, `1-2`). Topol erlaubt eine beliebige Spaltenzahl bei beliebiger Breite, daher wird ein Verhältnis außerhalb dieser fünf — am häufigsten vier gleich breite Spalten — auf das nächstliegende Layout aufgelöst, und jede Spalte ab der vierten fließt in die letzte.
- **GIFs** — `mj-gif` wird als `ImageBlock` importiert, derselbe Block, den `mj-image` erzeugt. Templatical hat keinen eigenen GIF-Block.
- **Überschriften-Ebenen** — `TitleBlock` unterstützt die Ebenen 1 bis 4. Ein `mj-text`, das ein einzelnes `<h5>` oder `<h6>` umschließt, wird auf Ebene 4 begrenzt.
- **Die Plattform `google`** — `SocialPlatform` hat kein `google`-Element, daher wird ein `google-href` stattdessen auf `website` abgebildet. Das ist der Normalfall, kein Randfall: Topols eigenes Social-Widget schreibt weiterhin `google-href` für Google+, ein vor Jahren eingestelltes Netzwerk.
- **Social-Icon-Größen** — `SocialIconsBlock` unterstützt drei Größen (24px, 32px, 48px). Eine `icon-size` außerhalb dieser drei wird auf die nächstliegende aufgelöst — und Topols eigener Standardwert ist 35px, also ist das bei Social-Blöcken der Normalfall, nicht die Ausnahme.
- **Block-IDs** — jeder importierte Block erhält eine neu generierte ID. IDs erscheinen nirgends in einem Topol-Design, daher überlebt nichts, das an einer ID hängt — zum Beispiel ein Cloud-Kommentarthread — einen Import.

## Was sich nicht automatisch überträgt

- **Hintergrundbilder einer Section** — `SectionWrapper` trägt nur `backgroundColor`, `padding` und `borderRadius`; Templatical hat kein Hintergrundbild-Feld auf irgendeinem Block, und der Renderer erzeugt kein `background-url`. Das `background-url` einer Topol-Section wird nie gelesen, daher behält eine Hero-Section ihre Hintergrundfarbe, verliert aber ihr Foto — und weil das Attribut unangetastet bleibt, weist nichts in `report.entries` darauf hin. `full-width` und `layout` auf derselben `mj-section` sowie `vertical-align` auf `mj-column` gehen denselben Weg.
- **Der `margin` eines Buttons** — `styles.padding` ist das einzige Feld für äußeren Abstand von `ButtonBlock`. Topol schreibt auf jedem `mj-button` sowohl `padding` als auch `margin`; `padding` füllt dieses Feld, und `margin` wird verworfen statt eingerechnet zu werden, was den vertikalen Abstand verdoppeln würde. Auch das innere Padding der Button-Beschriftung (`buttonPadding`) behält Templaticals Standardwert, da Topol dafür kein eigenes Attribut hat.
- **Importierte Webfonts** — Templatical hat kein Konzept für den Import von Webfonts. Das Wurzel-Array `fonts` des Designs listet die in das Topol-Projekt importierten Webfonts auf (ein Design misst `["\"Cabin\", sans-serif"]`; ein anderes trägt zwei Einträge), und das Array wird verworfen — Text, der davon abhing, wird in seiner Ersatzschriftart gerendert, ohne Warnung zur Laufzeit. Das ist ein anderes Feld als `attributes.fonts`, ein kommagetrennter Fallback-Stack auf derselben Wurzel, den der Importer liest und der die Standard-`fontFamily` des Templates füllt, wenn nichts Spezifischeres eine setzt.
- **Icon-Details pro Plattform** — `SocialIcon` trägt nur `id`, `platform` und `url`. Der `alt`-Text pro Plattform eines `mj-social`-Icons, `*-icon-color` und `text-mode` haben nirgends einen Platz. Der `alt`-Text lohnt eine Prüfung nach dem Import — dieselbe Barrierefreiheits-Lücke wie bei den Bildern weiter unten, nur auf einem anderen Block.
- **Zeilenhöhe des Dokuments** — Templatical hat keine Einstellung für die Zeilenhöhe auf Dokumentebene. Topols Standardwert auf Wurzelebene wird verworfen, und der Importer schreibt eine Notiz in `report.warnings`, die den Wert nennt — der einzige Verlust auf dieser Liste, der zur Laufzeit sichtbar wird.
- **Nicht erkannte Tags** — ein Topol-Knoten, den der Importer nicht explizit behandelt, wird zu einem `HtmlBlock`, der den rohen Knoten als JSON hält, nicht als Markup, da Topol-Knoten kein Markup sind. Jedes Blatt-Tag, das Topols eigener Editor erzeugt, wird explizit behandelt — dieser Pfad ist eher ein Sicherheitsnetz für handbearbeitetes oder von Dritten stammendes JSON als etwas, das ein normaler Export auslöst. Implementieren Sie das Tag als [Templatical Custom Block](/de/guide/custom-blocks) neu, für eine native, editierbare Entsprechung.

::: tip
Ein frisch importiertes Template scheitert bei der Ankunft häufig an den Barrierefreiheits-Regeln von `@templatical/quality`, und das `validate.mjs` des [Agent Skill](/de/guide/agent-skill) beendet sich dabei mit einem Exit-Code ungleich 0. Aus Topol exportierte Bilder tragen typischerweise keinen `alt`-Text, und der Importer übernimmt diese Lücke originalgetreu — eine Beschreibung zu erfinden wäre selbst ein Anti-Pattern für Barrierefreiheit. Die strukturelle Validierung besteht; die Befunde betreffen den Inhalt. Fügen Sie den importierten Bildern Alt-Text hinzu, und die Befunde verschwinden.
:::

## Wenn diese Anleitung etwas nicht abdeckt

[Eröffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) mit einem geschwärzten Ausschnitt Ihres Topol-Designs und dem, was Sie erreichen wollen. Wir nutzen diese Rückmeldungen, um die Abdeckung von `@templatical/import-topol` zu verbessern.
