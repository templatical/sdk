---
title: Schnellstart
description: Bringen Sie den Templatical-E-Mail-Editor in weniger als 5 Minuten zum Laufen.
---

# Schnellstart

## 1. Pakete installieren

::: code-group

```bash [npm]
npm install @templatical/editor @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/editor @templatical/renderer
```

```bash [yarn]
yarn add @templatical/editor @templatical/renderer
```

```bash [bun]
bun add @templatical/editor @templatical/renderer
```

:::

## 2. Editor einbinden {#mount-the-editor}

Diese Datei in den Browser legen. Kein Bundler. Framework- und Paketmanager-Mounts stehen unter [Installation](/de/getting-started/installation). Für Produktion eine Version pinnen — [CDN](/de/getting-started/installation#cdn).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Templatical Editor</title>
  <link
    rel="stylesheet"
    href="https://unpkg.com/@templatical/editor/dist/cdn/editor.css"
  />
  <style>
    body { margin: 0; }
    #editor { height: 100vh; }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script type="module">
    import { init } from "https://unpkg.com/@templatical/editor/dist/cdn/editor.js";

    const editor = await init({
      container: "#editor",
    });

    const json = editor.getContent();
    const mjml = await editor.toMjml();
  </script>
</body>
</html>
```

[Im Playground öffnen](https://play.templatical.com/scenes/minimum)

`json` speichern, damit Nutzer das Template später weiter bearbeiten können. `mjml` auf dem Server kompilieren — `toMjml()` erzeugt kein HTML.

## 3. MJML zu HTML kompilieren

Auf dem Server kompilieren Sie das gerade gesendete MJML mit einer beliebigen [MJML-Bibliothek](https://mjml.io) — Node, PHP, Python, Ruby und andere. [So funktioniert das Rendering](/de/getting-started/how-rendering-works) listet sie. Das Node-Paket ist `mjml`:

::: code-group

```bash [npm]
npm install mjml
```

```bash [pnpm]
pnpm add mjml
```

```bash [yarn]
yarn add mjml
```

```bash [bun]
bun add mjml
```

:::

```ts
import mjml2html from "mjml";

const { html } = mjml2html(mjml);
// html ist versandfertig
```

Aus einer gespeicherten JSON-Datei, ohne den Editor zu mounten (braucht ebenfalls `mjml`):

::: code-group

```bash [npm]
npx -y @templatical/template-tools render template.json --format html -o email.html
```

```bash [pnpm]
pnpm dlx @templatical/template-tools render template.json --format html -o email.html
```

```bash [yarn]
yarn dlx @templatical/template-tools render template.json --format html -o email.html
```

```bash [bun]
bunx @templatical/template-tools render template.json --format html -o email.html
```

:::

Siehe [Template Tools](/de/api/template-tools).

::: info Shadow DOM als Standard
Der Editor mountet standardmäßig innerhalb eines Shadow DOM, sodass Host-Seiten-CSS nicht in Editor-Elemente durchschlagen kann. Verwenden Sie ein `<div>` — oder ein beliebiges [Shadow-Host-fähiges Element](/de/api/editor#anforderungen-an-das-container-element) — als Container; Elemente wie `<table>`, `<form>` oder `<input>` können keinen Shadow Root aufnehmen.

Übergeben Sie `shadowDom: false`, um zu deaktivieren, falls Sie einen ungewöhnlichen Container benötigen, Editor-Interna über `document.querySelector` ansprechen oder Firefox <101 / Safari <16.4 unterstützen müssen. Siehe den [Shadow-DOM-Leitfaden](/de/guide/shadow-dom) für die vollständige Kompromissliste und Theming via `:host`.
:::

## Nächste Schritte

- [Einstiegspunkte](/de/getting-started/paths) — Einbinden, Backend, Prompt oder JSON → HTML.
- [Einbetten](/de/getting-started/embedding) — Container-Regeln, Stacking und was die CSS-Isolation bricht.
- [Backend anbinden](/de/backend/) — Speichern, Versionen, Kommentare, gespeicherte Blöcke, Medien, Test-E-Mail, Rendern.
- [Template Tools](/de/api/template-tools) — Validieren, Rendern, Importieren und Live-Vorschau per CLI oder Skript.
- [So funktioniert das Rendering](/de/getting-started/how-rendering-works) — JSON → MJML → HTML, und was gespeichert werden sollte.
