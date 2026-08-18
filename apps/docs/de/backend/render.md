---
title: Rendering & Export
description: Ein Template in MJML oder versandfertiges HTML verwandeln — lokal, auf Ihrem eigenen Backend oder mit einem einzigen mjml2html-Endpunkt.
---

# Rendering & Export

Zwei Methoden auf jeder Editor-Instanz:

```ts
const mjml = await editor.toMjml();
const html = await editor.toHtml();
```

## Die zwei Umwandlungen

```
Template-JSON  ──▶  MJML  ──▶  HTML
```

**Template-JSON → MJML** setzt Templaticals Blockmodell voraus: Sektionen, Spalten, Merge-Tags, Anzeigebedingungen, eigene Blöcke. Das erledigt [`@templatical/renderer`](/de/api/renderer-typescript), und zwar im Browser.

**MJML → HTML** braucht einen MJML-Compiler. Dieser Schritt ist generisch — jeder Compiler liefert dasselbe Ergebnis, und keiner weiß etwas über Templatical. **Das SDK bündelt keinen**: Das Kompilieren von MJML ist ein eigenständiges, bereits gut abgedecktes Thema außerhalb von Templaticals Aufgabenbereich, `toHtml()` erfordert daher eine Implementierung von Ihnen.

Jede Umwandlung kann im Browser oder auf Ihrem Backend laufen — daraus ergeben sich drei Anordnungen:

<!-- prettier-ignore -->
| Sie liefern | Das SDK übernimmt | Sie erhalten | Wo `@templatical/renderer` läuft |
| --- | --- | --- | --- |
| einen MJML-Compiler-Endpunkt | Template → MJML, im Browser | `toMjml()` und `toHtml()` | **in Ihrem Frontend-Bundle** |
| `toMjml` + `toHtml` | nichts | `toMjml()` und `toHtml()` | **auf Ihrem Backend**, falls Sie ihn dort einsetzen — nie im Browser |
| nichts | Template → MJML, im Browser | nur `toMjml()` | **in Ihrem Frontend-Bundle** |

## MJML → HTML auf Ihrem Backend

**Sie liefern** einen Endpunkt, der MJML entgegennimmt und HTML zurückgibt.
**Das SDK** rendert das Template im Browser zu MJML und übergibt es.
**Sie erhalten** `toMjml()` und `toHtml()`.
**Sie installieren** `@templatical/renderer` **in Ihrer Frontend-Anwendung**, neben dem Editor. Ihr Backend braucht nur einen MJML-Compiler — es sieht Templaticals Blockmodell nie.

Richten Sie einen Konfigurationsschlüssel auf einen beliebigen `mjml2html`-Endpunkt, und `toHtml()` funktioniert:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  render: {
    compileMjml: async (mjml) => {
      const res = await fetch('/api/mjml', { method: 'POST', body: mjml });
      return res.text();
    },
  },
});

const html = await editor.toHtml();
```

Ihr Endpunkt führt nur die zweite Umwandlung aus — das ist die kleinste Aufgabe, mit der ein Backend HTML erzeugen kann. `mjml2html(input)` ist die gesamte Implementierung; ein gehosteter Compiler, ein Container oder ein `mjml`-CLI-Aufruf erfüllen sie gleichermaßen.

Das zählt vor allem außerhalb von Node: `toMjml` zu implementieren hieße, unseren TypeScript-Renderer irgendwo zu betreiben, während `compileMjml` aus Laravel, Rails, Django oder Go ein paar Zeilen gegen ein Werkzeug sind, das es bereits gibt.

## Template → MJML → HTML auf Ihrem Backend

**Sie liefern** `toMjml` und `toHtml` — beide nehmen das Template entgegen und geben fertiges Markup zurück.
**Das SDK** rendert nichts; im Browser entsteht überhaupt kein E-Mail-Markup.
**Sie erhalten** `toMjml()` und `toHtml()`.
**Sie installieren** im Frontend nichts. Ihr Backend braucht etwas, das aus dem Blockmodell MJML macht: `@templatical/renderer` **serverseitig**, sofern es Node ausführt (siehe [Headless rendern](#headless-rendern)), oder Ihre eigene Implementierung in einer anderen Sprache.

```ts
const editor = await init({
  container: '#editor',
  render: {
    toMjml: async (payload) => {
      const res = await fetch('/api/render/mjml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.text();
    },

    toHtml: async (payload) => {
      const res = await fetch('/api/render/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.text();
    },
  },
});
```

Das Paket wird nie installiert, importiert oder geladen: Der lokale Pfad liegt hinter einem dynamischen `import()`, den nur der Fallback erreicht — und beantwortet ein Provider beide Aufrufe, wird der Fallback nie genommen.

Wählen Sie das, wenn Ihr Backend E-Mails ohnehin schon rendert. Sie pflegen einen Renderer statt zwei, und das MJML, das Ihre Nutzenden in der Vorschau sehen, ist genau das, was Sie versenden.

`toMjml` allein verlagert die erste Umwandlung weg vom Client. Kombinieren Sie es mit `compileMjml` statt `toHtml`, wenn Ihr Backend MJML erzeugt, das Kompilieren aber einem separaten Werkzeug überlässt.

## Der Vertrag

```ts
interface RenderPayload {
  /** Custom Blocks sind bereits zu `renderedHtml` aufgelöst. */
  content: TemplateContent;
  fonts?: { customFonts: CustomFont[]; defaultFallback: string };
}

interface RenderProvider {
  toMjml?(payload: RenderPayload): Promise<string>;
  toHtml?(payload: RenderPayload): Promise<string>;
  compileMjml?(mjml: string): Promise<string>;
}
```

Jede Methode ist **unabhängig optional**, und der Editor löst jede für sich auf:

<!-- prettier-ignore -->
| Aufruf | Reihenfolge |
| --- | --- |
| `toMjml()` | `render.toMjml` → der lokale `@templatical/renderer` → Ablehnung |
| `toHtml()` | `render.toHtml` → Ergebnis von `toMjml()` + `render.compileMjml` → Ablehnung |

Ob das Paket gebraucht wird, ergibt sich daraus, **welche Methoden Sie implementieren** — nicht daraus, ob Sie `render` überhaupt konfiguriert haben:

<!-- prettier-ignore -->
| Ihr Provider | `@templatical/renderer` im Frontend-Bundle? |
| --- | --- |
| *(kein `render`-Schlüssel)* | **Ja** — `toMjml()` rendert lokal, `toHtml()` lehnt ab |
| `{ compileMjml }` | **Ja** — das SDK rendert das MJML, Ihr Endpunkt kompiliert es |
| `{ toHtml }` | **Ja**, aber nur, wenn Sie auch `toMjml()` aufrufen |
| `{ toMjml }` | **Nein** — `toHtml()` lehnt allerdings ab |
| `{ toMjml, compileMjml }` | **Nein** |
| `{ toMjml, toHtml }` | **Nein** — im Browser wird nichts gerendert |

Diese Tabelle betrifft Ihr **Frontend**-Bundle. Womit Ihr Backend `toMjml` erfüllt, ist eine davon getrennte Entscheidung — oft dasselbe Paket, serverseitig importiert.

`compileMjml` führt ausschließlich die zweite Umwandlung aus; das MJML muss weiterhin irgendwo entstehen — ohne `render.toMjml` im lokalen Renderer. **`toMjml` ist die Methode, die das Rendering vom Client wegholt.**

**Es gibt keinen lokalen HTML-Pfad.** Ohne `toHtml` und ohne `compileMjml` lehnt `toHtml()` mit einem Fehler ab, der die zu ergänzende Methode nennt, statt einen Compiler zu erraten, der nicht existiert.

::: tip `toHtml()` läuft über `toMjml()`
Ein Provider mit `toMjml` *und* `compileMjml`, aber ohne `toHtml`, erhält HTML aus **Ihrem** MJML, nicht aus dem des lokalen Renderers. Ein Backend, das rendern kann, ist maßgeblich und sollte auf dem Weg zum HTML nicht übergangen werden.
:::

## Die Nutzlast

Ein Provider gewinnt gegen den lokalen Renderer, deshalb übergibt der Editor alles, was ein Backend nicht selbst ermitteln kann. Die Nutzlast ist **render-vollständig**:

- **Custom Blocks sind bereits aufgelöst.** `content` kommt mit gefülltem `renderedHtml` für jeden Custom Block an. Ohne das passiert der Fehler stillschweigend: Ein Renderer, der einen Custom Block ohne Resolver und ohne `renderedHtml` erhält, **lässt ihn aus der Ausgabe weg**. Das HTML entsteht aus Ihrem Liquid-Template plus den Feldwerten des Blocks, und die Definition ist im Browser registriert — ein Server könnte damit also nichts anfangen.
- **Fonts sind aufgelöst.** `fonts` enthält die Custom-Schriften, mit denen der Editor tatsächlich rendert, plus den Fallback-Stack für alles Übrige — zusammengesetzt aus `init({ fonts })`, was aus dem Template-JSON nicht rekonstruierbar ist.
- **`content` ist eine Schutzkopie.** Ändern Sie sie beliebig; das Dokument des Nutzers bleibt unberührt.

## Template → MJML im Browser

**Sie liefern** nichts.
**Das SDK** rendert das Template im Browser zu MJML.
**Sie erhalten** `toMjml()`. `toHtml()` lehnt ab, da kein Compiler verfügbar ist.
**Sie installieren** `@templatical/renderer` **in Ihrer Frontend-Anwendung**.

Ohne `render`-Provider — oder mit einem, der nur `compileMjml` implementiert — nutzt `toMjml()` den [`@templatical/renderer`](/de/api/renderer-typescript), eine optionale Peer-Dependency unter MIT-Lizenz. Installieren Sie ihn dort, wo Sie exportieren:

```bash
npm install @templatical/renderer
```

`toMjml()` importiert ihn beim ersten Aufruf dynamisch und lehnt mit einem klaren Fehler ab, der das fehlende Paket nennt. Custom Blocks werden über die Registry des Editors aufgelöst, und Ihre konfigurierten Fonts werden automatisch eingebunden.

::: tip Laden Sie über das CDN?
Dann gibt es nichts zu installieren. Der CDN-Build ist in sich geschlossen, `@templatical/renderer` ist also enthalten — als eigener Code-Split-Chunk, der beim ersten `toMjml()`-Aufruf geladen wird.
:::

## Headless rendern

Außerhalb des Editors rufen Sie den Renderer direkt auf:

```ts
import { renderToMjml } from '@templatical/renderer';

const mjml = await renderToMjml(content, {
  renderCustomBlock: async (block) => myLiquid.render(block),
});
```

### Einen Blocktyp überschreiben

`blockRenderers` ersetzt den eingebauten Renderer für einen bestimmten `block.type`:

```ts
const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => `<mj-image src="${countdownGifUrl(block)}" />`,
    video: (block, ctx) => renderVideoWithPlayButton(block, ctx),
  },
});
```

Es verallgemeinert `renderCustomBlock` von einem Blocktyp auf beliebige. Ein Backend, dessen Ausgabe eine *Obermenge* der des Browsers ist, kann genau diese Differenz einspeisen, statt den Renderer zu forken, und die Gleichwertigkeit aller übrigen Blocktypen ergibt sich dann konstruktiv. Templatical Cloud nutzt es für zwei Blöcke: ein serverseitig erzeugtes animiertes Countdown-GIF und einen zusammengesetzten Video-Play-Button.

Eine Überschreibung übernimmt alles, was der eingebaute Renderer tat — einschließlich des vorzeitigen Ausstiegs für Blöcke, die auf allen Viewports verborgen sind.

### Blöcke ohne Renderer

Ein Blocktyp ohne eingebauten Renderer und ohne `blockRenderers`-Überschreibung erzeugt einen Platzhalter-Kommentar und protokolliert eine Warnung:

```html
<mj-raw><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw>
```

`countdown` ist heute der einzige eingebaute Block, der hier landet. Ein auf allen Viewports verborgener Block rendert weiterhin nichts und warnt auch nicht, denn genau das hat sein Autor verlangt.

::: tip Warum ein Marker und kein Fehlerabbruch
Der Renderer läuft in Versand-Pipelines, und einen kompletten Render wegen eines Blocks abzubrechen ist schlimmer, als eine markierte Lücke auszuliefern. Stillschweigen ist noch schlimmer: Ein verschwundener Countdown erreicht die Empfänger als fehlender Abschnitt, zu dem nirgends eine Erklärung steht. Der Marker ist greppbar, eine Pipeline kann also ablehnen, ihn auszuliefern.
:::

Beide Teile werden exportiert, damit der Marker-Text nirgends hart codiert werden muss:

```ts
import {
  UNRENDERABLE_MARKER_PREFIX,
  renderUnrenderableBlock,
} from "@templatical/renderer";

if (mjml.includes(UNRENDERABLE_MARKER_PREFIX)) {
  throw new Error("Versand abgelehnt: Ein Block dieser Vorlage wurde als Lücke gerendert.");
}
```

`UNRENDERABLE_MARKER_PREFIX` ist der stabile Anfangstext des Markers — prüfen Sie darauf, bevor Sie versenden. `renderUnrenderableBlock(block)` erzeugt einen Marker und protokolliert die Warnung. Eine `blockRenderers`-Überschreibung kann damit für eine Variante, die sie nicht verarbeiten kann, genauso degradieren, anstatt `""` zurückzugeben und das stille Verschwinden wieder einzuführen.

## Referenz

- [`@templatical/renderer`-API](/de/api/renderer-typescript)
- [Speichern & Laden](/de/backend/templates) — der Save/Load-Lebenszyklus, von dem dies bewusst getrennt ist
- [Custom Blocks](/de/guide/custom-blocks) — warum das Vorrendern Teil des Payloads ist

**Sie nutzen Templatical Cloud?** Cloud implementiert diesen Vertrag ohne jede Konfiguration — siehe [Rendering auf Cloud](/de/cloud/rendering).
