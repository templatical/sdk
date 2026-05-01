---
title: Schnellstart
description: Bringen Sie den Templatical-E-Mail-Editor in weniger als 5 Minuten zum Laufen.
---

# Schnellstart

## 1. Pakete installieren

```bash
npm install @templatical/editor @templatical/renderer
```

## 2. Editor einbinden

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Templatical Editor</title>
  <style>
    body { margin: 0; }
    #editor { height: calc(100vh - 48px); }
    #toolbar { height: 48px; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #e5e7eb; }
    #toolbar button { padding: 8px 16px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="toolbar">
    <button onclick="save()">Save Template</button>
  </div>
  <div id="editor"></div>

  <script type="module">
    import { init } from '@templatical/editor';
    import '@templatical/editor/style.css';

    const editor = await init({
      container: '#editor',
    });

    window.save = async function () {
      const content = editor.getContent();
      const mjml = await editor.toMjml();

      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mjml }),
      });
    };
  </script>
</body>
</html>
```

Ihr Backend erhält sowohl das JSON (speichern Sie es, damit Nutzer das Template später weiter bearbeiten können) als auch das MJML (kompilieren Sie es mit einer beliebigen [MJML-Bibliothek](https://mjml.io) zu HTML und versenden Sie es).

## Nächste Schritte

- [Wie das Rendering funktioniert](/de/getting-started/how-rendering-works) -- verstehen Sie die JSON → MJML-Pipeline.
- [Blöcke](/de/guide/blocks) -- Referenz für alle 14 Blocktypen.
- [Renderer-API](/de/api/renderer-typescript) -- vollständige `renderToMjml()`-Referenz.
