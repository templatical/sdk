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

`toMjml()` funktioniert ohne weitere Konfiguration. `toHtml()` braucht **eine** Sache von Ihnen, denn das SDK bündelt bewusst keinen MJML-Compiler.

## Das Einfachste, was funktioniert

Richten Sie einen Konfigurationsschlüssel auf einen beliebigen `mjml2html`-Endpunkt, und `toHtml()` funktioniert:

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  render: {
    compileMjml: (mjml) =>
      fetch('/api/mjml', { method: 'POST', body: mjml }).then((r) => r.text()),
  },
});

const html = await editor.toHtml();
```

Das MJML rendert weiterhin das SDK selbst — Ihr Endpunkt kompiliert es nur. Genau das ist der Punkt: **MJML-Kompilierung ist Standardware** (ein gehosteter Dienst, ein Container, ein `mjml`-CLI-Aufruf), das Rendern von Templaticals Blockmodell nicht. Ohne diese Stufe müsste jedes Backend außerhalb von Node erst einen Node-Sidecar aufsetzen, um HTML zu erhalten.

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
| `toMjml()` | `render.toMjml` → der gebündelte `@templatical/renderer` → Ablehnung |
| `toHtml()` | `render.toHtml` → Ergebnis von `toMjml()` + `render.compileMjml` → Ablehnung |

Nur `compileMjml` liefert also HTML mit lokal gerendertem MJML; nur `toMjml` verlagert das Rendering auf Ihr Backend und lässt `toHtml()` nicht verfügbar; alle drei überlassen Ihrem Backend die gesamte Pipeline.

**Es gibt keinen lokalen HTML-Pfad, niemals.** Ohne `toHtml` und ohne `compileMjml` lehnt `toHtml()` mit einem Fehler ab, der die zu ergänzende Methode nennt — statt einen Compiler zu erraten, der nicht existiert.

::: tip `toHtml()` läuft über `toMjml()`
Wenn Ihr Provider `toMjml` *und* `compileMjml`, aber kein `toHtml` bereitstellt, entsteht das HTML aus **Ihrem** MJML, nicht aus dem des gebündelten Renderers. Ein Backend, das rendern kann, ist maßgeblich und sollte auf dem Weg zum HTML nicht übergangen werden.
:::

## Was der Editor garantiert

Ein Provider gewinnt gegen den gebündelten Renderer — das ist nur dann fair, wenn der Editor alles übergibt, was ein Backend nicht selbst ermitteln kann. Genau das tut er: das Payload ist **render-vollständig**.

- **Custom Blocks sind bereits aufgelöst.** `content` kommt mit gefülltem `renderedHtml` für jeden Custom Block an. Das ist wichtig, weil der Fehler sonst stillschweigend passiert: Ein Renderer, der einen Custom Block ohne Resolver und ohne `renderedHtml` erhält, **lässt ihn aus der Ausgabe weg**. Das HTML entsteht aus Ihrem Liquid-Template plus den Feldwerten des Blocks, und die Definition ist im Browser registriert — ein Server könnte damit also nichts anfangen.
- **Fonts sind aufgelöst.** `fonts` enthält die Custom-Schriften, mit denen der Editor tatsächlich rendert, plus den Fallback-Stack für alles Übrige — zusammengesetzt aus `init({ fonts })`, was aus dem Template-JSON nicht rekonstruierbar ist.
- **`content` ist eine Schutzkopie.** Ändern Sie sie beliebig; das Dokument des Nutzers bleibt unberührt.

## Lokal rendern

Ohne `render`-Provider nutzt `toMjml()` den [`@templatical/renderer`](/de/api/renderer-typescript) — eine optionale Peer-Dependency unter MIT-Lizenz. Installieren Sie ihn dort, wo Sie exportieren:

```bash
npm install @templatical/renderer
```

`toMjml()` importiert ihn beim ersten Aufruf dynamisch und lehnt mit einem klaren Fehler ab, der das fehlende Paket nennt. Custom Blocks werden über die Registry des Editors aufgelöst, und Ihre konfigurierten Fonts werden automatisch eingebunden.

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

Das verallgemeinert `renderCustomBlock`, dieselbe Idee für einen einzelnen Blocktyp. Es existiert, damit ein Backend, dessen Ausgabe eine *Obermenge* der des Browsers ist, genau diese Differenz einspeisen kann, statt den Renderer zu forken — die Gleichwertigkeit aller übrigen Blocktypen ergibt sich dann konstruktiv. Templatical Cloud nutzt es für genau zwei Blöcke: ein serverseitig erzeugtes animiertes Countdown-GIF und einen zusammengesetzten Video-Play-Button, die ein Browser zur Renderzeit beide nicht erzeugen kann.

Eine Überschreibung übernimmt alles, was der eingebaute Renderer tat — einschließlich des vorzeitigen Ausstiegs für Blöcke, die auf allen Viewports verborgen sind.

### Blöcke ohne Renderer

Ein Blocktyp ohne eingebauten Renderer und ohne `blockRenderers`-Überschreibung erzeugt einen Platzhalter-Kommentar und protokolliert eine Warnung:

```html
<mj-raw><!-- templatical:unrenderable-block type="countdown" id="0192…" --></mj-raw>
```

Kein Fehlerabbruch: Der Renderer läuft in Versand-Pipelines, und einen kompletten Render wegen eines Blocks abzubrechen ist schlimmer, als eine markierte Lücke auszuliefern. Aber auch kein Stillschweigen — ein verschwundener Countdown erreicht die Empfänger als fehlender Abschnitt, zu dem nirgends eine Erklärung steht. Der Marker ist greppbar, eine Versand-Pipeline kann also ablehnen, ihn auszuliefern.

`countdown` ist heute der einzige eingebaute Block, der hier landet. Ein auf allen Viewports verborgener Block rendert weiterhin nichts und warnt auch nicht, denn genau das hat sein Autor verlangt.

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

## Templatical Cloud

`initCloud()` nimmt **denselben `render`-Schlüssel mit demselben Typ**, ein Wechsel zwischen beiden ist also eine Löschung und nie ein Umbau:

```ts
// Clouds Renderer:
await initCloud({ container, auth });

// Ihr Renderer, auf Cloud:
await initCloud({ container, auth, render: myProvider });
```

Lassen Sie ihn weg, rendert Cloud serverseitig. Die Ausgabe ist eine bewusste Obermenge der des Browsers — das Countdown-GIF und der Video-Play-Button von oben — und Cloud führt den *veröffentlichten* Renderer mit genau diesen zwei eingespeisten Funktionen aus, sodass nichts anderes abweichen kann.

Zwei Konsequenzen, die Sie kennen sollten:

- **Cloud rendert das gespeicherte Template**, jeder `toMjml()`- / `toHtml()`-Aufruf speichert also zuerst. Eine Sitzung, die nie ein Template erzeugt hat, erhält eine klare Ablehnung statt eines Exports von nichts.
- **Keiner der beiden Provider ist plangebunden.** Jeder Plan rendert die Schriften, die auch auf der Arbeitsfläche verwendet werden.

Damit entfallen der MJML-Compiler und der Render-Host, die Sie sonst betreiben müssten, plus die beiden Dinge, die ein Browser zur Renderzeit nicht erzeugen kann. Siehe [Export](/de/cloud/getting-started#export) für die Aufrufe im Editor und die [Headless-API](/de/cloud/headless-api#export), um ganz ohne Editor zu rendern.

## Referenz

- [`@templatical/renderer`-API](/de/api/renderer-typescript)
- [Speichern & Laden](/de/backend/templates) — der Save/Load-Lebenszyklus, von dem dies bewusst getrennt ist
- [Custom Blocks](/de/guide/custom-blocks) — warum das Vorrendern Teil des Payloads ist
