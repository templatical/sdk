---
title: React (Vite)
description: Eine lauffähige Single-Page-App mit Vite, React 19 und dem Templatical-Editor, ohne Backend, als Ausgangspunkt für ein React-Frontend auf jedem Server.
---

# React (Vite)

[`examples/react-vite`](https://github.com/templatical/sdk/tree/main/examples/react-vite) ist eine Single-Page-App mit Vite und React 19, die den Editor enthält und kein Backend hat. Sie hält das Template in `localStorage`, speichert gespeicherte Blöcke mit dem `createLocalStorageSavedBlocksProvider()` des Editors und rendert MJML im Browser mit `@templatical/renderer`. Sie dient als Ausgangspunkt für ein React-Frontend, dessen Backend nicht JavaScript ist. CI baut die App und führt sie bei jeder Änderung am SDK in einem Browser aus.

## Ausführen des Beispiels

[In StackBlitz öffnen](https://stackblitz.com/github/templatical/sdk/tree/main/examples/react-vite)

Oder kopieren Sie es in ein neues Verzeichnis:

```bash
npx degit templatical/sdk/examples/react-vite my-app
cd my-app
npm install
npm run dev
```

## Die Editor-Komponente

Die Komponente bindet den Editor in einem Effect ein, und ihr Cleanup unmountet ihn – auch einen Editor, der erst fertig lädt, nachdem React StrictMode den Effect aufgeräumt hat. `onChange` schreibt jede Änderung nach `localStorage`, und der nächste Mount übergibt sie als `content` zurück an den Editor. Startet der Editor nicht, zeigt die Werkzeugleiste die Fehlermeldung an. Die Werkzeugleiste zeigt auch Fehler, die der Editor über `onError` meldet, etwa gespeicherte Blöcke, die er nicht aus `localStorage` lesen kann, und einen fehlgeschlagenen Export; der nächste Export entfernt sie.

`src/email-editor.tsx`

<<< @/../../examples/react-vite/src/email-editor.tsx

## Die Provider {#providers}

Dieses Beispiel übergibt `savedBlocks`, erzeugt mit `createLocalStorageSavedBlocksProvider()`. Um Templates und gespeicherte Blöcke auf einem Server zu halten, übergeben Sie die `fetch`-basierten Provider aus dem [Next.js-Beispiel](/de/frameworks/nextjs#providers) und implementieren Sie die Routen, die sie aufrufen, in einer beliebigen Sprache.

## Wechsel in die Produktion

- Übergeben Sie einen `templates`-Provider, damit Templates auf Ihrem Server liegen statt im `localStorage` eines einzelnen Browsers.
- Ersetzen Sie `createLocalStorageSavedBlocksProvider()` durch einen Provider, der auf Ihrem Server aufsetzt, damit gespeicherte Blöcke dem Benutzer über Browser hinweg folgen.
- Kompilieren Sie die Ausgabe von `editor.toMjml()` auf Ihrem Server mit dem Paket `mjml` zu HTML, oder übergeben Sie einen `render`-Provider, damit `editor.toHtml()` Ihren Server aufruft. [Rendering & Export](/de/backend/render) behandelt beides.
