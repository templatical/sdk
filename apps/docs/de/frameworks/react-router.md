---
title: React Router
description: Eine lauffähige React-Router-8-App im Framework-Modus mit dem Templatical-Editor, angebunden über Resource Routes für Templates, gespeicherte Blöcke, HTML-Export und Test-E-Mails.
---

# React Router

[`examples/react-router`](https://github.com/templatical/sdk/tree/main/examples/react-router) ist eine React-Router-8-App im Framework-Modus, der Nachfolger von Remix und die Grundlage von Shopifys App-Template. Die App bettet den Editor ein und bindet ihn über Resource Routes an: Route-Module mit einem `loader` oder einer `action` und ohne Komponente. Die App speichert Templates und gespeicherte Blöcke als JSON-Dateien unter `./data`, rendert HTML-Export und Test-E-Mails auf dem Server mit `@templatical/renderer` und `mjml` und schreibt jede Test-E-Mail nach `./data/outbox`, statt sie zu versenden. CI baut die App und führt sie bei jeder Änderung am SDK in einem Browser aus.

## Ausführen des Beispiels

[In StackBlitz öffnen](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-router)

Oder kopieren Sie es in ein neues Verzeichnis:

```bash
npx degit templatical/sdk/examples/react-router my-app
cd my-app
npm install
npm run dev
```

## Die Editor-Komponente

Die Komponente bindet den Editor in einem Effect ein. Sie importiert `init()` innerhalb des Effects, daher läuft der Editor nie auf dem Server, und ihr Cleanup unmountet den Editor – auch einen, der erst fertig lädt, nachdem React StrictMode den Effect aufgeräumt hat. Ohne `?id=` in der URL legt sie ein Template an und schreibt die neue ID mit `navigate` aus `useNavigate` in die URL. Schlägt das Öffnen des Templates fehl, zeigt die Werkzeugleiste die Meldung des Servers an, etwa „Template not found.“, mit einem Link, der ein neues Template anlegt. Die Werkzeugleiste zeigt auch Fehler, die der Editor über `onError` meldet, etwa eine Bibliothek gespeicherter Blöcke, die nicht lädt, und einen fehlgeschlagenen Export; der nächste Export entfernt sie.

`app/components/email-editor.tsx`

<<< @/../../examples/react-router/app/components/email-editor.tsx

## Die Provider {#providers}

Der Editor erreicht das Backend nur über diese Objekte. Jede Methode ist ein `fetch` an eine der Routen unten. Die Datei ist in den Beispielen für Next.js, Nuxt, SvelteKit und React Router identisch.

`app/lib/templatical/providers.ts`

<<< @/../../examples/react-router/app/lib/templatical/providers.ts

## Die Server-Routen

`app/routes.ts` registriert jede Resource Route. Module, die nur auf dem Server laufen, enden auf `.server.ts`, was sie aus dem Client-Bundle heraushält. Jede Route prüft ihre Eingaben, ruft den Store oder den Renderer auf und antwortet mit JSON oder einem leeren 204. Eine abgelehnte Anfrage erhält einen 4xx-Status und `{ message }`, die der Editor anzeigt.

`app/routes.ts`

<<< @/../../examples/react-router/app/routes.ts

`app/routes/api.templates.ts`

<<< @/../../examples/react-router/app/routes/api.templates.ts

`app/routes/api.templates.$id.ts`

<<< @/../../examples/react-router/app/routes/api.templates.$id.ts

`app/routes/api.saved-blocks.ts`

<<< @/../../examples/react-router/app/routes/api.saved-blocks.ts

`app/routes/api.saved-blocks.$id.ts`

<<< @/../../examples/react-router/app/routes/api.saved-blocks.$id.ts

`app/routes/api.render.ts`

<<< @/../../examples/react-router/app/routes/api.render.ts

`app/routes/api.test-email.ts`

<<< @/../../examples/react-router/app/routes/api.test-email.ts

Die Render- und die Test-E-Mail-Route kompilieren das Template mit `renderTemplate()` aus `app/lib/templatical/render.server.ts`:

<<< @/../../examples/react-router/app/lib/templatical/render.server.ts

## Wechsel in die Produktion

- Ersetzen Sie die Funktionsrümpfe in [`app/lib/templatical/store.server.ts`](https://github.com/templatical/sdk/blob/main/examples/react-router/app/lib/templatical/store.server.ts) durch Aufrufe Ihrer Datenbank. Jede Route, die Templates oder gespeicherte Blöcke lädt oder speichert, nutzt diese Funktionen.
- Ersetzen Sie `deliver()` in [`app/lib/templatical/outbox.server.ts`](https://github.com/templatical/sdk/blob/main/examples/react-router/app/lib/templatical/outbox.server.ts) durch Ihren E-Mail-Anbieter. Die Funktion erhält Empfänger, Betreff und das fertige HTML.
- Sichern Sie die Resource Routes mit einer Authentifizierung ab. In diesem Beispiel sind sie offen.
- Bereinigen Sie HTML-Blöcke auf dem Server, bevor Sie sie speichern oder versenden, oder übergeben Sie in `render.server.ts` `allowHtmlBlocks: false` an `renderToMjml`: Der Editor speichert Autoren-HTML unverändert.
- Bevor Sie eine Cookie-basierte Authentifizierung hinzufügen, lehnen Sie Schreibzugriffe ohne `content-type: application/json` ab oder verwenden Sie CSRF-Tokens: Eine fremde Seite kann einen `text/plain`-Body ohne Preflight senden, und diese Routen lesen jeden Body als JSON.

[Backend anbinden](/de/backend/) behandelt die Provider, die dieses Beispiel auslässt: Versionsverlauf, Kommentare und Medien.
