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

Die Playground-URL liefert ein **festes Beispiel-GIF**: dieselbe 30-Sekunden-Schleife für jede Anfrage. Sie zeigt die URL-Form und die Darstellung auf der Arbeitsfläche; die Abfrageparameter werden ignoriert, und das Bild zählt nicht bis zum Ziel herunter. Ersetzen Sie die Basis-URL durch Ihren eigenen Endpunkt oder einen URL-basierten Countdown-Bilddienst, der `targetDate` und `timezone` liest und ein Bild liefert, das beim Öffnen der E-Mail aktuell ist. Der Editor bietet den Countdown-Block nur an, wenn `countdown` konfiguriert ist.

## Bild auf der Arbeitsfläche

Die Arbeitsfläche zeigt das Bild, das `imageUrl` für den Block in seinem aktuellen Zustand im Editor zurückgibt. Ohne Bild-URL erscheint ein Platzhalter; kann das Bild nicht geladen werden, zeigt der Platzhalter die fehlgeschlagene URL. Ein Block ohne `targetDate` zeigt einen Hinweis zum Setzen des Datums, bis ein Bild geladen ist.

Der Editor lädt das Bild so:

- Das erste Bild lädt, sobald der Block erscheint.
- Danach fordert der Editor nur dann ein neues Bild an, wenn sich die URL ändert, und zwar 400 ms nach ihrer letzten Änderung. Gibt ein Host nach einer Änderung dieselbe URL zurück, folgt keine neue Anfrage; nehmen Sie daher alles, was das Bild neu laden soll, in die URL auf.
- Während das neue Bild lädt, bleibt das bisherige abgeblendet und mit „Wird aktualisiert…“ versehen sichtbar.

Arbeitsfläche und E-Mail können unterschiedliche Bilder zeigen:

- Ist [`resolveImageUrl`](/de/guide/images#reine-anzeige-aufloesung-von-bild-urls) konfiguriert, zeigt und entprellt die Arbeitsfläche die aufgelöste URL, während die E-Mail das Ergebnis von `imageUrl` behält.
- Der lokale Render-Pfad des Editors (`toMjml()`, `toHtml()`) schreibt das Ergebnis von `imageUrl` in die E-Mail; ein Backend-Rendering kann eine andere URL senden, etwa eine [signierte URL](#signierte-urls-beim-rendern).
- Ein Host, der aus dem gespeicherten Block rendert ([Block-Abruf aus dem Speicher](#block-abruf-aus-dem-speicher)), kann ungespeicherte Änderungen auf der Arbeitsfläche zeigen, bevor sie Empfänger erreichen.

## Provider- und Renderer-Vertrag

`CountdownProvider` aus `@templatical/types` hat genau diese Methode:

```ts
interface CountdownProvider {
  imageUrl(block: CountdownBlock): string;
}
```

`imageUrl` läuft synchron und gibt die Bild-URL zurück. `CountdownBlock.targetDate` ist eine Ortszeit im Format `YYYY-MM-DDTHH:mm`, gelesen in `CountdownBlock.timezone`, einer IANA-Zeitzone wie `Europe/Berlin`: der Wert, den das Datumsfeld des Editors schreibt. Ihr Bilddienst liest das Paar genauso. Ein `targetDate` mit `Z` oder einem Offset gilt als dieser Zeitpunkt, und der Editor zeigt ihn als Ortszeit in der Zeitzone des Blocks an. Die Bilddatei bestimmt ihre Größe selbst. Für Headless-Rendering und den Alternativtext stehen diese Exporte bereit:

```ts
declare function renderCountdownImage(
  block: CountdownBlock,
  src: string,
  options?: { locale?: string },
): string;

declare function countdownAltText(block: CountdownBlock, locale: string | undefined): string;

declare function countdownTargetTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): number | null;

declare function countdownWallTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): string;
```

Andere Felder der Werkzeugleiste als `targetDate` und `timezone` wirken sich nur dann auf die versendete E-Mail aus, wenn der Bilddienst des Hosts sie liest, entweder aus der Bild-URL oder aus dem gespeicherten Block.

`renderCountdownImage` kommt aus `@templatical/renderer`. Die Funktion gibt ein `<mj-image>` mit dem übergebenen `src`, maskierten Attributen und lokalisiertem Alternativtext zurück. `countdownAltText` kommt aus `@templatical/types` und beschreibt das Zieldatum in der Sprache des Templates. `countdownTargetTime` gibt das Ziel in Epoch-Millisekunden zurück, oder `null` bei leerem, unlesbarem oder unmöglichem Datum sowie bei einem Datum ohne Offset und unbekannter Zeitzone (ein Datum mit `Z` oder Offset ignoriert `timezone`); `countdownWallTime` gibt es als `YYYY-MM-DDTHH:mm` in der Zeitzone des Blocks zurück, oder `""`. Der lokale Renderpfad des Editors verwendet automatisch die Template-Sprache. Ein Host-Override mit `render.toMjml` verantwortet seinen eigenen Renderpfad.

## Headless-MJML

Übergeben Sie dieselbe URL-Funktion über `blockRenderers.countdown` an `renderToMjml`:

```ts
import { renderCountdownImage, renderToMjml } from "@templatical/renderer";
import { createCountdownBlock, createDefaultTemplateContent, isCountdown } from "@templatical/types";
import type { CountdownBlock } from "@templatical/types";

const imageUrl = (block: CountdownBlock): string => {
  const url = new URL("https://play.templatical.com/countdown-sample.gif");
  url.searchParams.set("targetDate", block.targetDate);
  url.searchParams.set("timezone", block.timezone);
  return url.toString();
};

const content = createDefaultTemplateContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00",
  timezone: "Europe/Berlin",
}));

const mjml = await renderToMjml(content, {
  blockRenderers: {
    countdown: (block) => {
      if (!isCountdown(block)) return "";
      return renderCountdownImage(block, imageUrl(block), {
        locale: content.settings.locale,
      });
    },
  },
});
```

## Absicherung des Bild-Endpunkts

Die Bild-URL steht im HTML jeder versendeten E-Mail, und E-Mail-Clients rufen sie ohne Ihre Cookies oder Header ab; auch der Bild-Proxy von Gmail und Apple Mail Privacy Protection laden sie. Sitzungs-Authentifizierung und Rate-Limits pro IP schützen den Endpunkt deshalb nicht: Die URL selbst muss einen Countdown ausweisen, den Ihre Anwendung angelegt hat. `imageUrl` läuft synchron im Browser, kann also kein Signatur-Geheimnis enthalten, und jedes Token, das es der URL hinzufügt, ist in jeder E-Mail lesbar.

### Block-Abruf aus dem Speicher

Geben Sie eine URL zurück, die die gespeicherte Vorlage und den Block benennt, statt den Einstellungen in der URL zu vertrauen. Dafür braucht der Endpunkt eine gespeicherte Kopie der Vorlage, die er abrufen kann, aus einem `templates`-Provider oder aus Ihrer eigenen Speicherung von `getContent()`; wie Sie speichern und den Abruf prüfen, entscheidet Ihre Anwendung.

```ts
import type { CountdownBlock } from "@templatical/types";

// Die ID der Vorlage, die der Editor geöffnet hat. Aktualisieren Sie sie, wenn Ihre App eine Vorlage lädt oder anlegt.
let currentTemplateId = "tpl_123";

const PREVIEW_FIELDS = [
  "targetDate", "timezone", "showDays", "showHours", "showMinutes", "showSeconds",
  "separator", "digitFontSize", "digitColor", "labelColor", "labelFontSize",
  "backgroundColor", "fontFamily", "labelDays", "labelHours", "labelMinutes",
  "labelSeconds", "expiredMessage", "expiredImageUrl", "hideOnExpiry",
] as const satisfies readonly (keyof CountdownBlock)[];

export function setCurrentTemplateId(id: string): void {
  currentTemplateId = id;
}

export const imageUrl = (block: CountdownBlock): string => {
  const path = `/countdown/${encodeURIComponent(currentTemplateId)}/${encodeURIComponent(block.id)}.gif`;
  const url = new URL(path, "https://app.example.com");
  // Nur eine authentifizierte Editor-Sitzung liest diese Werte; sie zeigen ungespeicherte Änderungen in der Vorschau.
  for (const field of PREVIEW_FIELDS) {
    const value = block[field];
    if (value !== undefined) url.searchParams.set(field, String(value));
  }
  return url.toString();
};
```

Der Endpunkt entscheidet dann, was er rendert:

- **Ohne Editor-Sitzung (ein Empfänger oder ein Bild-Proxy):** Ignorieren Sie den Query-String, laden Sie die gespeicherte Vorlage, finden Sie den Block anhand seiner ID und rendern Sie aus seinen gespeicherten Feldern. Antworten Sie mit 404, wenn Vorlage oder Block nicht existieren. Wer die Vorlage löscht, verhindert, dass spätere Anfragen aufgelöst werden; eine Kopie, die der Client eines Empfängers oder ein Cache schon geladen hat, bleibt bestehen.
- **Mit authentifizierter Editor-Sitzung:** Rendern Sie aus dem Query-String, damit ungespeicherte Änderungen auf der Arbeitsfläche erscheinen. Die Arbeitsfläche sendet Ihre Cookies nur, wenn der Endpunkt auf der Site Ihrer App liegt.
- **Versendete E-Mails bleiben unverändert** nur, wenn die URL eine Vorlagenversion statt der aktuellen Vorlage benennt; sonst ändert eine spätere Bearbeitung des Countdowns bereits zugestellte E-Mails.

Speichern Sie die Vorlage vor dem Versand: Ein nie gespeicherter Block lässt sich nicht auflösen.

### Signierte URLs beim Rendern

Ein Backend, das die versendete E-Mail rendert (ein `render.toMjml`-Provider oder `renderToMjml` mit `blockRenderers.countdown`), kann stattdessen eine signierte URL zurückgeben: einen HMAC mit einem Geheimnis, das nur der Server kennt, über jeden Parameter, den der Endpunkt liest. Gespeicherte Vorlagen enthalten keine Bild-URL, daher kommt die Signatur erst beim Rendern hinzu. HTML, das im Browser mit `editor.toMjml()` oder `editor.toHtml()` entsteht, enthält, was `imageUrl` zurückgegeben hat, und lässt sich so nicht signieren.

### Grenzen des Endpunkts

Diese Regeln gelten für beide Ansätze:

- Lesen Sie nur die Blockfelder, die das Bild braucht, und begrenzen Sie sie: einen Bereich für das Zieldatum, Grenzen für Schriftgrößen, eine maximale Label-Länge.
- Rufen Sie `expiredImageUrl` nie vom Server ab. Leiten Sie darauf weiter oder akzeptieren Sie nur Ihren eigenen Asset-Host; eine Adresse aus der Anfrage abzurufen, macht den Endpunkt zu einem offenen Proxy.
- Cachen Sie aus gespeicherten Blöcken gerenderte Bilder pro Parametersatz, höchstens so lange, wie es die nötige Genauigkeit zulässt: Ein Countdown mit Sekunden, der eine Minute gecacht wird, kann beim Öffnen bis zu 59 Sekunden nachgehen, und jede kürzere Lebensdauer kostet mehr Renderings. Bild-Proxys bündeln viele Empfänger hinter wenigen IP-Adressen, daher können Rate-Limits pro IP Missbrauch nicht von einem großen Versand unterscheiden.
- Halten Sie die Bildkodierung schnell und cachen Sie Antworten anhand der URL nur kurz. Das Bild hängt vom Zeitpunkt der Anfrage ab.
- Halten Sie Editor-Vorschauen aus geteilten Caches heraus (`Cache-Control: private, no-store`) und wählen Sie den Schlüssel des öffentlichen Caches so, dass er nie eine Vorschau-Anfrage beantwortet: Vorschau und öffentliche Anfrage können dieselbe URL haben, brauchen aber verschiedene Bilder.

## Grenzen

Das SDK liefert keinen GIF-Server mit. Ihr Bilddienst erzeugt und liefert das Countdown-Bild. E-Mail-HTML ist nach dem Versand statisch. Darum übernimmt der Bilddienst auch den Ablauf sowie `expiredMessage`, `expiredImageUrl` und `hideOnExpiry`; der Editor kann einen versendeten Block später nicht ausblenden. Bei leerer Bild-URL oder einem Ladefehler zeigt die Arbeitsfläche einen Platzhalter. Eine leere URL erzeugt den Marker `templatical:unrenderable-block`. Das gilt auch für einen Headless-Countdown ohne `blockRenderers.countdown`.

## Prüfen

Installieren Sie das optionale Peer-Paket `@templatical/renderer` für den lokalen `toMjml()`-Pfad des Editors. Nachdem Sie einen Countdown-Block eingefügt haben, enthält `await editor.toMjml()` für diesen Block `<mj-image src="…">`. Mit dem Editor aus dem Beispiel oben können Sie direkt prüfen:

```ts
import { createCountdownBlock } from "@templatical/types";

const content = editor.getContent();
content.blocks.push(createCountdownBlock({
  targetDate: "2026-12-24T18:00",
  timezone: "Europe/Berlin",
}));
editor.setContent(content);
const mjml = await editor.toMjml();
if (!mjml.includes('<mj-image\n  src="https://play.templatical.com/countdown-sample.gif')) {
  throw new Error("Countdown image missing from MJML");
}
```

## Im Playground

Das [Countdown-Setup](https://play.templatical.com/scenes/countdown) verwendet das feste Beispiel-GIF. So können Sie Provider und Arbeitsfläche ohne Bilddienst prüfen.
