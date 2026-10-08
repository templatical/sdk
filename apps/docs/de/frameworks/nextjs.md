---
title: Next.js
description: Eine lauffähige Next.js-16-App mit App Router und dem Templatical-Editor, angebunden über API-Routen für Templates, gespeicherte Blöcke, HTML-Export und Test-E-Mails.
---

# Next.js

[`examples/nextjs`](https://github.com/templatical/sdk/tree/main/examples/nextjs) ist eine Next.js-16-App mit App Router, die den Editor einbettet und ihn über eigene API-Routen anbindet. Sie speichert Templates und gespeicherte Blöcke als JSON-Dateien unter `./data`, rendert HTML-Export und Test-E-Mails auf dem Server mit `@templatical/renderer` und `mjml` und schreibt jede Test-E-Mail nach `./data/outbox`, statt sie zu versenden. CI baut die App und führt sie bei jeder Änderung am SDK in einem Browser aus.

## Ausführen des Beispiels

[Öffnen Sie es auf StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/nextjs), oder kopieren Sie es in ein neues Verzeichnis:

```bash
npx degit templatical/sdk/examples/nextjs my-app
cd my-app
npm install
npm run dev
```

## Die Editor-Komponente

Eine Client-Komponente bindet den Editor ein. Sie importiert `init()` innerhalb des Effects, daher läuft der Editor nie auf dem Server, und ihr Cleanup unmountet den Editor – auch einen, der erst fertig lädt, nachdem React StrictMode den Effect aufgeräumt hat. Ohne `?id=` in der URL legt sie ein Template an und schreibt dessen neue ID in die URL. Schlägt das Öffnen des Templates fehl, zeigt die Werkzeugleiste die Meldung des Servers an, etwa „Template not found.“, mit einem Link, der ein neues Template anlegt.

`app/email-editor.tsx`

<<< @/../../examples/nextjs/app/email-editor.tsx

## Die Provider {#providers}

Der Editor erreicht das Backend nur über diese Objekte. Jede Methode ist ein `fetch` an eine der Routen unten. Die Datei ist in den Beispielen für Next.js, Nuxt, SvelteKit und React Router identisch.

`lib/templatical/providers.ts`

<<< @/../../examples/nextjs/lib/templatical/providers.ts

## Die Server-Routen

Jede Route prüft ihre Eingaben, ruft den Store oder den Renderer auf und antwortet mit JSON oder einem leeren 204. Eine abgelehnte Anfrage erhält einen 4xx-Status und `{ message }`, die der Editor anzeigt.

`app/api/templates/route.ts`

<<< @/../../examples/nextjs/app/api/templates/route.ts

`app/api/templates/[id]/route.ts`

<<< @/../../examples/nextjs/app/api/templates/[id]/route.ts

`app/api/saved-blocks/route.ts`

<<< @/../../examples/nextjs/app/api/saved-blocks/route.ts

`app/api/saved-blocks/[id]/route.ts`

<<< @/../../examples/nextjs/app/api/saved-blocks/[id]/route.ts

`app/api/render/route.ts`

<<< @/../../examples/nextjs/app/api/render/route.ts

`app/api/test-email/route.ts`

<<< @/../../examples/nextjs/app/api/test-email/route.ts

Die Render- und die Test-E-Mail-Route kompilieren das Template mit `renderTemplate()` aus `lib/templatical/server/render.ts`:

<<< @/../../examples/nextjs/lib/templatical/server/render.ts

## Wechsel in die Produktion

- Ersetzen Sie die Funktionsrümpfe in [`lib/templatical/server/store.ts`](https://github.com/templatical/sdk/blob/main/examples/nextjs/lib/templatical/server/store.ts) durch Aufrufe Ihrer Datenbank. Jede Route, die Templates oder gespeicherte Blöcke lädt oder speichert, nutzt diese Funktionen.
- Ersetzen Sie `deliver()` in [`lib/templatical/server/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/nextjs/lib/templatical/server/outbox.ts) durch Ihren E-Mail-Anbieter. Die Funktion erhält Empfänger, Betreff und das fertige HTML.
- Sichern Sie die API-Routen mit einer Authentifizierung ab. In diesem Beispiel sind sie offen.
- Bereinigen Sie HTML-Blöcke auf dem Server, bevor Sie sie speichern oder versenden, oder übergeben Sie in `render.ts` `allowHtmlBlocks: false` an `renderToMjml`: Der Editor speichert Autoren-HTML unverändert.
- Bevor Sie eine Cookie-basierte Authentifizierung hinzufügen, lehnen Sie Schreibzugriffe ohne `content-type: application/json` ab oder verwenden Sie CSRF-Tokens: Eine fremde Seite kann einen `text/plain`-Body ohne Preflight senden, und diese Routen lesen jeden Body als JSON.

[Backend anbinden](/de/backend/) behandelt die Provider, die dieses Beispiel auslässt: Versionsverlauf, Kommentare und Medien.
