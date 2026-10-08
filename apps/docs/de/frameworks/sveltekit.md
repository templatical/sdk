---
title: SvelteKit
description: Eine lauffähige SvelteKit-3-App mit dem Templatical-Editor, angebunden über +server.ts-Routen für Templates, gespeicherte Blöcke, HTML-Export und Test-E-Mails.
---

# SvelteKit

[`examples/sveltekit`](https://github.com/templatical/sdk/tree/main/examples/sveltekit) ist eine SvelteKit-3-App (Svelte 5, adapter-node), die den Editor einbettet und ihn über eigene `+server.ts`-Routen anbindet. SvelteKit 3 liest seine Konfiguration aus `vite.config.ts`, und das Beispiel importiert aus `src/lib` über den Subpath-Import `#lib/*`, den `package.json` deklariert. Die App speichert Templates und gespeicherte Blöcke als JSON-Dateien unter `./data`, rendert HTML-Export und Test-E-Mails auf dem Server mit `@templatical/renderer` und `mjml` und schreibt jede Test-E-Mail nach `./data/outbox`, statt sie zu versenden. CI baut die App und führt sie bei jeder Änderung am SDK in einem Browser aus.

## Ausführen des Beispiels

[Öffnen Sie es auf StackBlitz](https://stackblitz.com/github/templatical/sdk/tree/main/examples/sveltekit), oder kopieren Sie es in ein neues Verzeichnis:

```bash
npx degit templatical/sdk/examples/sveltekit my-app
cd my-app
npm install
npm run dev
```

## Die Editor-Komponente

Die Komponente bindet den Editor in `onMount` ein und gibt den Cleanup zurück, der ihn unmountet – auch einen Editor, der erst fertig lädt, nachdem die Komponente entfernt wurde. Sie importiert `init()` innerhalb von `onMount`, daher läuft der Editor nie auf dem Server. Ohne `?id=` in der URL legt sie ein Template an und schreibt die neue ID mit SvelteKits `goto` in die URL. Schlägt das Öffnen des Templates fehl, zeigt die Werkzeugleiste die Meldung des Servers an, etwa „Template not found.“, mit einem Link, der ein neues Template anlegt. Der Link zum Neustart trägt `data-sveltekit-reload`. Dadurch lädt er die Seite vollständig neu, und die Komponente legt beim erneuten Mounten ein Template an.

`src/lib/EmailEditor.svelte`

<<< @/../../examples/sveltekit/src/lib/EmailEditor.svelte

## Die Provider {#providers}

Der Editor erreicht das Backend nur über diese Objekte. Jede Methode ist ein `fetch` an eine der Routen unten. Die Datei ist in den Beispielen für Next.js, Nuxt, SvelteKit und React Router identisch.

`src/lib/templatical/providers.ts`

<<< @/../../examples/sveltekit/src/lib/templatical/providers.ts

## Die Server-Routen

Jede `+server.ts`-Datei exportiert einen Handler pro HTTP-Methode. Jeder Handler prüft seine Eingaben, ruft den Store oder den Renderer auf und antwortet mit JSON oder einem leeren 204. Eine abgelehnte Anfrage erhält einen 4xx-Status und `{ message }`, die der Editor anzeigt.

`src/routes/api/templates/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/templates/+server.ts

`src/routes/api/templates/[id]/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/templates/[id]/+server.ts

`src/routes/api/saved-blocks/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/saved-blocks/+server.ts

`src/routes/api/saved-blocks/[id]/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/saved-blocks/[id]/+server.ts

`src/routes/api/render/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/render/+server.ts

`src/routes/api/test-email/+server.ts`

<<< @/../../examples/sveltekit/src/routes/api/test-email/+server.ts

Die Render- und die Test-E-Mail-Route kompilieren das Template mit `renderTemplate()` aus `src/lib/server/templatical/render.ts`:

<<< @/../../examples/sveltekit/src/lib/server/templatical/render.ts

## Wechsel in die Produktion

- Ersetzen Sie die Funktionsrümpfe in [`src/lib/server/templatical/store.ts`](https://github.com/templatical/sdk/blob/main/examples/sveltekit/src/lib/server/templatical/store.ts) durch Aufrufe Ihrer Datenbank. Jede Route, die Templates oder gespeicherte Blöcke lädt oder speichert, nutzt diese Funktionen.
- Ersetzen Sie `deliver()` in [`src/lib/server/templatical/outbox.ts`](https://github.com/templatical/sdk/blob/main/examples/sveltekit/src/lib/server/templatical/outbox.ts) durch Ihren E-Mail-Anbieter. Die Funktion erhält Empfänger, Betreff und das fertige HTML.
- Sichern Sie die `+server.ts`-Routen mit einer Authentifizierung ab. In diesem Beispiel sind sie offen.
- Behalten Sie den Header `content-type: application/json` bei, den `providers.ts` bei jedem Schreibzugriff sendet. SvelteKit lehnt einen Schreibzugriff ohne Content-Type als Cross-Site-Formularübermittlung ab, wenn der Origin des Browsers von dem abweicht, den adapter-node annimmt: `https://`, sofern `PROTOCOL_HEADER` nicht gesetzt ist.
- Bereinigen Sie HTML-Blöcke auf dem Server, bevor Sie sie speichern oder versenden, oder übergeben Sie in `render.ts` `allowHtmlBlocks: false` an `renderToMjml`: Der Editor speichert Autoren-HTML unverändert.
- adapter-node lehnt Request-Bodies über 512 KB standardmäßig ab. Setzen Sie `BODY_SIZE_LIMIT` (zum Beispiel `BODY_SIZE_LIMIT=10M`), wenn Ihre Templates größer sind.

[Backend anbinden](/de/backend/) behandelt die Provider, die dieses Beispiel auslässt: Versionsverlauf, Kommentare und Medien.
