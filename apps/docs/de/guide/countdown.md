---
title: Countdown
description: "Konfigurieren Sie `init({ countdown: { imageUrl } })`, damit der Editor ein Countdown-Bild anzeigt und als MJML exportiert."
---

# Countdown

Konfigurieren Sie `init({ countdown: { imageUrl } })`, damit der Editor ein Countdown-Bild anzeigt und als MJML exportiert.

```ts
import { init } from "@templatical/editor";
import type { CountdownBlock } from "@templatical/types";
import "@templatical/editor/style.css";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const container = document.createElement("div");
container.style.height = "100vh";
document.body.append(container);

const editor = await init({
  container,
  countdown: { imageUrl },
});
```

Die Playground-URL liefert ein **statisches Beispiel-GIF**. Sie zeigt die URL-Form und die Darstellung auf der Arbeitsfläche; ihre Abfrageparameter lassen das Bild nicht herunterzählen. Ersetzen Sie die Basis-URL durch Ihren eigenen Endpunkt oder einen URL-basierten Countdown-Bilddienst, der `targetDate` und `timezone` liest und ein Bild liefert, das beim Öffnen der E-Mail aktuell ist. Der Editor bietet den Countdown-Block nur an, wenn `countdown` konfiguriert ist.

## Provider- und Renderer-Vertrag

`CountdownProvider` aus `@templatical/types` hat genau diese Methode:

```ts
interface CountdownProvider {
  imageUrl(block: CountdownBlock): string;
}
```

`imageUrl` läuft synchron und gibt die Bild-URL zurück. `CountdownBlock.targetDate` und `CountdownBlock.timezone` sind Strings; Letzteres ist eine IANA-Zeitzone. Die Bilddatei bestimmt ihre Größe selbst. Für Headless-Rendering und den Alternativtext stehen diese Exporte bereit:

```ts
renderCountdownImage(
  block: CountdownBlock,
  src: string,
  options?: { locale?: string },
): string;

countdownAltText(block: CountdownBlock, locale: string | undefined): string;
```

`renderCountdownImage` kommt aus `@templatical/renderer`. Die Funktion gibt ein `<mj-image>` mit dem übergebenen `src`, maskierten Attributen und lokalisiertem Alternativtext zurück. `countdownAltText` kommt aus `@templatical/types` und beschreibt das Zieldatum in der Sprache des Templates. Der lokale Renderpfad des Editors verwendet automatisch die Template-Sprache. Ein Host-Override mit `render.toMjml` verantwortet seinen eigenen Renderpfad.

## Headless-MJML

Übergeben Sie dieselbe URL-Funktion über `blockRenderers.countdown` an `renderToMjml`:

```ts
import { renderCountdownImage, renderToMjml } from "@templatical/renderer";
import { createCountdownBlock, createDefaultTemplateContent } from "@templatical/types";
import type { CountdownBlock } from "@templatical/types";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));

const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => renderCountdownImage(block, imageUrl(block), {
      locale: content.settings.locale,
    }),
  },
});
```

## Grenzen

Das SDK liefert keinen GIF-Server mit. Ihr Bilddienst erzeugt und liefert das Countdown-Bild. E-Mail-HTML ist nach dem Versand statisch. Darum übernimmt der Bilddienst auch den Ablauf sowie `expiredMessage`, `expiredImageUrl` und `hideOnExpiry`; der Editor kann einen versendeten Block später nicht ausblenden. Wenn die Bild-URL auf der Arbeitsfläche nicht geladen werden kann, zeigt der Editor die CSS-Vorschau. Eine leere URL erzeugt den Marker `templatical:unrenderable-block`. Das gilt auch für einen Headless-Countdown ohne `blockRenderers.countdown`.

## Prüfen

Installieren Sie das optionale Peer-Paket `@templatical/renderer` für den lokalen `toMjml()`-Pfad des Editors. Nachdem Sie einen Countdown-Block eingefügt haben, enthält `await editor.toMjml()` für diesen Block `<mj-image src="…">`. Mit dem Editor aus dem Beispiel oben können Sie direkt prüfen:

```ts
import { createCountdownBlock } from "@templatical/types";

const content = editor.getContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00:00+01:00",
  timezone: "Europe/Berlin",
}));
editor.setContent(content);
const mjml = await editor.toMjml();
if (!mjml.includes('<mj-image\n  src="https://play.templatical.com/countdown-sample.gif')) {
  throw new Error("Countdown image missing from MJML");
}
```

## Im Playground

Das [Countdown-Setup](https://play.templatical.com/scenes/countdown) verwendet das statische Beispiel-GIF. So können Sie Provider und Arbeitsfläche ohne Bilddienst prüfen.
