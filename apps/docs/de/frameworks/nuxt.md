---
title: Nuxt
description: Eine lauffähige Nuxt-4-App mit dem Templatical-Editor, angebunden über Server-Routen für Templates, gespeicherte Blöcke, HTML-Export und Test-E-Mails.
---

# Nuxt

[`examples/nuxt`](https://github.com/templatical/sdk/tree/main/examples/nuxt) ist eine Nuxt-4-App, die den Editor einbettet und ihn über eigene Server-Routen anbindet. Sie speichert Templates und gespeicherte Blöcke als JSON-Dateien unter `./data`, rendert HTML-Export und Test-E-Mails auf dem Server mit `@templatical/renderer` und `mjml` und schreibt jede Test-E-Mail nach `./data/outbox`, statt sie zu versenden. CI baut die App und führt sie bei jeder Änderung am SDK in einem Browser aus.

## Ausführen des Beispiels

[In StackBlitz öffnen](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nuxt)

Oder kopieren Sie es in ein neues Verzeichnis:

```bash
npx degit templatical/sdk/examples/nuxt my-app
cd my-app
npm install
npm run dev
```

## Die Editor-Komponente

Eine reine Client-Komponente (`.client.vue`) bindet den Editor in `onMounted` ein und unmountet ihn in `onBeforeUnmount` – auch einen Editor, der erst fertig lädt, nachdem die Komponente entfernt wurde. Sie wartet zuerst einen Tick, weil Nuxt das Template einer reinen Client-Komponente erst nach dem Mounten der Komponente rendert. Sie importiert `init()` innerhalb von `onMounted`, daher läuft der Editor nie auf dem Server. Ohne `?id=` in der URL legt sie ein Template an und schreibt dessen neue ID in die URL. Schlägt das Öffnen des Templates fehl, zeigt die Werkzeugleiste die Meldung des Servers an, etwa „Template not found.“, mit einem Link, der ein neues Template anlegt. Die Werkzeugleiste zeigt auch Fehler, die der Editor über `onError` meldet, etwa eine Bibliothek gespeicherter Blöcke, die nicht lädt, und einen fehlgeschlagenen Export; der nächste Export entfernt sie.

`app/components/EmailEditor.client.vue`

<<< @/../../examples/nuxt/app/components/EmailEditor.client.vue

## Die Provider {#providers}

Der Editor erreicht das Backend nur über diese Objekte. Jede Methode ist ein `fetch` an eine der Routen unten. Die Datei ist in den Beispielen für Next.js, Nuxt, SvelteKit und React Router identisch.

`app/utils/templatical/providers.ts`

<<< @/../../examples/nuxt/app/utils/templatical/providers.ts

## Die Server-Routen

Nuxt bildet jede Datei unter `server/api/` auf eine Route ab und die Methode in ihrem Namen (`.get`, `.post`, …) auf die HTTP-Methode. Jede Route prüft ihre Eingaben, ruft den Store oder den Renderer auf und antwortet mit JSON oder einem leeren 204. Eine abgelehnte Anfrage erhält einen 4xx-Status und `{ message }`, die der Editor anzeigt.

`server/api/templates/index.post.ts`

<<< @/../../examples/nuxt/server/api/templates/index.post.ts

`server/api/templates/[id].get.ts`

<<< @/../../examples/nuxt/server/api/templates/[id].get.ts

`server/api/templates/[id].patch.ts`

<<< @/../../examples/nuxt/server/api/templates/[id].patch.ts

`server/api/saved-blocks/index.get.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/index.get.ts

`server/api/saved-blocks/index.post.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/index.post.ts

`server/api/saved-blocks/[id].patch.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/[id].patch.ts

`server/api/saved-blocks/[id].delete.ts`

<<< @/../../examples/nuxt/server/api/saved-blocks/[id].delete.ts

`server/api/render.post.ts`

<<< @/../../examples/nuxt/server/api/render.post.ts

`server/api/test-email.post.ts`

<<< @/../../examples/nuxt/server/api/test-email.post.ts

Die Render- und die Test-E-Mail-Route kompilieren das Template mit `renderTemplate()` aus `server/utils/templatical/render.ts`:

<<< @/../../examples/nuxt/server/utils/templatical/render.ts

## Wechsel in die Produktion

- Ersetzen Sie die Funktionsrümpfe in [`server/utils/templatical/store.ts`](https://github.com/templatical/sdk/blob/main/examples/nuxt/server/utils/templatical/store.ts) durch Aufrufe Ihrer Datenbank. Jede Route, die Templates oder gespeicherte Blöcke lädt oder speichert, nutzt diese Funktionen.
- Ersetzen Sie `deliver()` in [`server/utils/templatical/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/nuxt/server/utils/templatical/outbox.ts) durch Ihren E-Mail-Anbieter. Die Funktion erhält Empfänger, Betreff und das fertige HTML.
- Sichern Sie die Server-Routen mit einer Authentifizierung ab. In diesem Beispiel sind sie offen.
- Bereinigen Sie HTML-Blöcke auf dem Server, bevor Sie sie speichern oder versenden, oder übergeben Sie in `render.ts` `allowHtmlBlocks: false` an `renderToMjml`: Der Editor speichert Autoren-HTML unverändert.
- Bevor Sie eine Cookie-basierte Authentifizierung hinzufügen, lehnen Sie Schreibzugriffe ohne `content-type: application/json` ab oder verwenden Sie CSRF-Tokens: Eine fremde Seite kann einen Body ohne `content-type` oder mit `multipart/form-data` ohne Preflight senden, und diese Routen lesen beide Varianten als JSON.

[Backend anbinden](/de/backend/) behandelt die Provider, die dieses Beispiel auslässt: Versionsverlauf, Kommentare und Medien.
