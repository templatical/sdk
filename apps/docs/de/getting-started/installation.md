---
title: Installation
description: Installieren Sie den Templatical-E-Mail-Editor über npm oder CDN.
---

# Installation

::: tip Aktive Entwicklung
Templatical wird aktiv weiterentwickelt und veröffentlicht häufig neue Versionen. Die öffentliche API stabilisiert sich — wir folgen [SemVer](https://semver.org), nutzen [Changesets](https://github.com/changesets/changesets) für jedes Release und dokumentieren Breaking Changes im [Changelog](https://github.com/templatical/sdk/releases). Pinnen Sie in Produktion eine Version und beobachten Sie die [GitHub-Releases](https://github.com/templatical/sdk/releases), um aktuell zu bleiben.

Feature-Wunsch oder rauer Kante begegnet? [Diskussion eröffnen](https://github.com/templatical/sdk/discussions) — Feedback formt die Roadmap.
:::

## Voraussetzungen

- **Moderner Browser** -- der Support hängt vom Mount-Modus ab:
  - **Standardmodus** (`shadowDom: true`, Shadow DOM) — Chrome 80+, Edge 80+, Firefox 101+, Safari 16.4+. Firefox- und Safari-Mindestversionen sind durch die `adoptedStyleSheets`-API bestimmt, auf die der Shadow-Pfad angewiesen ist.
  - **Opt-out-Modus** (`shadowDom: false`, Light DOM) — Chrome 80+, Edge 80+, Firefox 80+, Safari 14+. Verwenden Sie diesen Modus, wenn Sie ältere Firefox- oder Safari-Versionen unterstützen müssen oder Ihre Integration Light-DOM-Zugriff auf Editor-Interna benötigt. Siehe den [Shadow-DOM-Leitfaden](../guide/shadow-dom) für die Kompromisse.
- **Container-Element** -- muss eine definierte Höhe haben (der Editor füllt seinen Container aus). Im Standardmodus muss es ein Elementtyp sein, der einen Shadow Root hosten kann (z. B. `<div>`, `<section>`, `<article>`). Siehe [Container-Element-Anforderungen](../api/editor#container-element-requirements).
- **Kein `transform` und kein Stacking-Kontext auf einem Vorfahren des Containers** -- `transform`, `filter`, `perspective`, `will-change`, `opacity` unter `1`, `isolation`, `contain` und positionierte Elemente mit `z-index` verändern jeweils, wo die Overlays des Editors gezeichnet oder positioniert werden. Das sind reine CSS-Regeln, keine Templatical-spezifischen Einschränkungen; sie betreffen jede Bibliothek, die Overlays mit `position: fixed` positioniert. Was jede Eigenschaft konkret bricht und wie Sie es umgehen, steht unter [Den Editor einbetten](./embedding).
- **Keine erforderlichen Peer-Dependencies** -- Vue, TipTap und alle internen Bibliotheken sind im Editor gebündelt. Sie müssen weder Vue noch eine andere Framework-Runtime installieren, unabhängig davon, welches Framework Ihre App verwendet. (`@templatical/renderer`, `@templatical/quality`, `@templatical/media-library` und `pusher-js` sind _optionale_ Peers — installieren Sie sie nur, wenn Sie das entsprechende Feature nutzen; siehe [Optionale Peers](#optionale-peers) weiter unten.)

## Netzwerk-Anfragen

Der Editor sendet **keine** Anfragen an Templatical. Es gibt keinen Lizenzschlüssel, keine Client-ID, keinen Aktivierungsaufruf, keine Berechtigungsprüfung und keine Telemetrie. Nichts am Editor wird aus der Ferne freigeschaltet oder deaktiviert — eine installierte Kopie funktioniert unbegrenzt weiter.

Genau eine Anfrage an Dritte findet dennoch statt, und Sie sollten sie vor dem Deployment kennen:

| Anfrage | Ausgelöst durch | Wann |
| ------- | --------------- | ---- |
| `https://fonts.bunny.net/css?family=geist:400,500,600` | Ein CSS-`@import` am Anfang des Editor-Stylesheets | Bei jedem Parsen des Stylesheets, in beiden DOM-Modi |

Geist ist die Standard-UI-Schrift des Editors. Wird die Anfrage zum Laden blockiert oder schlägt sie fehl, funktioniert der Editor normal weiter — der Text fällt lediglich auf die nächste Schriftart im Stack zurück. In zwei Fällen könnte das auffallen:

- **Strikte Content Security Policy** — eine Richtlinie wie `style-src 'self'` blockiert den `@import`. Ergänzen Sie `https://fonts.bunny.net` in `style-src` und `font-src`, oder nehmen Sie die Fallback-Schrift in Kauf.
- **Air-Gapped- oder Offline-Deployments** — die Anfrage schlägt fehl und die Fallback-Schrift wird verwendet.

Damit der Editor nicht auf Geist angewiesen ist, überschreiben Sie das Schrift-Token:

```css
.tpl,
#ihr-editor-container {
  --tpl-user-font-family: system-ui, sans-serif;
}
```

Der `@import` bleibt dabei im Stylesheet erhalten, die Anfrage wird also weiterhin versucht. Um sie vollständig zu entfernen, hosten Sie Geist selbst und entfernen den `@import` in einem Build-Schritt aus Ihrer Kopie von `dist/style.css`. Die vollständige Schrift-Token-Oberfläche finden Sie unter [Theming](../guide/theming).

## Der Container des Editors

Der Container, den Sie an `init()` übergeben, unterliegt einigen CSS-Einschränkungen. Ein Vorfahre mit `transform`, `overflow: hidden` oder einem eigenen Stacking-Kontext kann die Dialoge des Editors verschieben oder beschneiden.

Was jede Eigenschaft bricht und wie Sie es umgehen, steht unter [Den Editor einbetten](./embedding).

## npm

::: code-group

```bash [npm]
npm install @templatical/editor
```

```bash [pnpm]
pnpm add @templatical/editor
```

```bash [yarn]
yarn add @templatical/editor
```

```bash [bun]
bun add @templatical/editor
```

:::

`@templatical/editor` ist der visuelle Editor. Um Templates in MJML zu konvertieren, installieren Sie zusätzlich `@templatical/renderer`:

::: code-group

```bash [npm]
npm install @templatical/renderer
```

```bash [pnpm]
pnpm add @templatical/renderer
```

```bash [yarn]
yarn add @templatical/renderer
```

```bash [bun]
bun add @templatical/renderer
```

:::

Der Renderer ist **optional**. Installieren Sie ihn dort, wo Sie MJML-Ausgabe benötigen:

- **Im Browser, neben dem Editor** – wenn Sie `editor.toMjml()` aufrufen, um aus der Sitzung des Nutzers zu exportieren.
- **In Node.js / auf dem Server** – wenn Sie nur gespeichertes Template-JSON haben und es serverseitig in MJML umwandeln möchten. Dafür benötigen Sie den Editor nicht; installieren Sie nur den Renderer.

Wenn Sie `editor.toMjml()` aufrufen, ohne dass der Renderer installiert ist, wird ein klarer Fehler ausgelöst, der das fehlende Paket benennt.

## Paketübersicht

| Paket                          | Beschreibung                                                                                                            | Erforderlich                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@templatical/editor`          | Visueller Drag-and-Drop-Editor und `init()`-Einstiegspunkt                                                              | Ja                                                                                                           |
| `@templatical/types`           | Gemeinsame TypeScript-Typen, Block-Factory-Funktionen, Type Guards                                                      | Automatisch installiert                                                                                      |
| `@templatical/core`            | Framework-agnostische Editor-Logik (State, History)                                                                     | Automatisch installiert                                                                                      |
| `@templatical/renderer`        | Rendert Templates zu MJML                                                                                               | Optional – installieren, wo Sie `editor.toMjml()` (Browser) oder `renderToMjml()` (Node.js, Server) aufrufen |
| `@templatical/quality`         | Template-Linter (Barrierefreiheit, Struktur, Links) für das Issues-Panel des Editors und Headless- / CI-Checks                | Optional – installieren, um den Issues-Sidebar-Tab und die Inline-Block-Badges zu aktivieren                 |
| `@templatical/media-library`   | Eigenständige Medienbibliothek (Typen, Composable, API-Client, Vue-Komponenten), wird von `initCloud()` genutzt         | Optional – nur nötig, wenn Sie `initCloud()` für den Medien-Browser verwenden                                |
| `@templatical/import-beefree`  | Konvertiert BeeFree-JSON-Templates in das Templatical-Format                                                            | Optional                                                                                                     |
| `@templatical/import-unlayer`  | Konvertiert Unlayer-JSON-Design-Templates in das Templatical-Format                                                     | Optional                                                                                                     |
| `@templatical/import-html`     | Konvertiert bestehende HTML-E-Mail-Templates (Tabellen-basiert) in das Templatical-Format                               | Optional                                                                                                     |
| `@templatical/import-mjml`     | Konvertiert MJML-E-Mail-Templates in das Templatical-Format                                                             | Optional                                                                                                     |

`@templatical/types` und `@templatical/core` sind direkte Abhängigkeiten von `@templatical/editor` und werden automatisch installiert.

## Optionale Peers

Der Editor lädt vier optionale Peers zur Laufzeit per dynamischem `import()`, abhängig davon, welche Features Sie nutzen:

| Peer                         | Wann geladen                                   | Installieren, wenn Sie                   |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------- |
| `@templatical/renderer`      | Erster Aufruf von `editor.toMjml()`            | MJML-Export aus dem Browser benötigen    |
| `@templatical/quality`       | Beim Mounten des Editors (Issues-Panel)        | Barrierefreiheit, Struktur und Link-Lint in der Issues-Sidebar nutzen möchten |
| `@templatical/media-library` | Erstes Öffnen des Medien-Browsers              | `initCloud()` verwenden                  |
| `pusher-js`                  | Cloud-Realtime-Verbindung                      | `initCloud()` verwenden                  |

Wenn Sie sie nicht installieren, deaktiviert sich das jeweilige Feature selbst — der Editor mountet und läuft trotzdem.

### Hinweis zur Bundler-Ausgabe

Der Editor funktioniert mit allen modernen Bundlern out of the box — unabhängig davon, welche optionalen Peers Sie installieren, ist keinerlei Konfiguration auf Consumer-Seite erforderlich. Vite, esbuild, Rollup und Rolldown behandeln die optionalen dynamischen Imports stillschweigend. Webpack 5 ist etwas gesprächiger: Es analysiert jeden `import()`-Aufruf statisch und gibt für jeden nicht installierten optionalen Peer eine harmlose `Module not found`-**Warnung** aus. Der Build ist trotzdem erfolgreich und der Editor läuft korrekt — diese Warnungen sind rein kosmetisch.

Wenn Sie eine saubere Webpack-Ausgabe bevorzugen, können Sie die Warnungen optional über `ignoreWarnings` ausblenden:

```js
// webpack.config.js — optional, nur falls die Warnungen stören
module.exports = {
  ignoreWarnings: [
    {
      module: /@templatical[\\/]editor/,
      message:
        /Can't resolve '(pusher-js|@templatical\/(quality|media-library|renderer))'/,
    },
  ],
};
```

## Framework-Integration

Templatical wird in jedes beliebige DOM-Element eingebunden. Intern erstellt es seine eigene isolierte Anwendung und funktioniert daher mit jedem Framework – oder ganz ohne Framework.

::: code-group

```ts [Vanilla JS]
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  onChange(content) {
    console.log("Content changed", content);
  },
});

// Später, beim Entfernen des Editors:
editor.unmount();
```

```tsx [React]
import { useRef, useEffect } from "react";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    (async () => {
      const ed = await init({
        container: containerRef.current,
        onChange(content) {
          console.log("Content changed", content);
        },
      });
      if (!cancelled) editorRef.current = ed;
    })();

    return () => {
      cancelled = true;
      editorRef.current?.unmount();
    };
  }, []);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
```

```vue [Vue]
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

const container = ref<HTMLElement>();
let editor: TemplaticalEditor | null = null;

onMounted(async () => {
  if (!container.value) return;

  editor = await init({
    container: container.value,
    onChange(content) {
      console.log("Content changed", content);
    },
  });
});

onUnmounted(() => {
  editor?.unmount();
});
</script>

<template>
  <div ref="container" style="height: 100vh" />
</template>
```

```svelte [Svelte]
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { init } from '@templatical/editor';
  import '@templatical/editor/style.css';
  import type { TemplaticalEditor } from '@templatical/editor';

  let containerEl: HTMLElement;
  let editor: TemplaticalEditor | null = null;

  onMount(async () => {
    editor = await init({
      container: containerEl,
      onChange(content) {
        console.log('Content changed', content);
      },
    });
  });

  onDestroy(() => {
    editor?.unmount();
  });
</script>

<div bind:this={containerEl} style="height: 100vh;" />
```

```ts [Angular]
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

@Component({
  selector: "app-email-editor",
  standalone: true,
  template: `<div #editorContainer style="height: 100vh"></div>`,
})
export class EmailEditorComponent implements OnInit, OnDestroy {
  @ViewChild("editorContainer", { static: true })
  containerRef!: ElementRef<HTMLElement>;

  private editor: TemplaticalEditor | null = null;

  async ngOnInit(): Promise<void> {
    this.editor = await init({
      container: this.containerRef.nativeElement,
      onChange(content) {
        console.log("Content changed", content);
      },
    });
  }

  ngOnDestroy(): void {
    this.editor?.unmount();
  }
}
```

:::

::: warning Wichtig
Rufen Sie immer `unmount()` auf, wenn Sie den Editor von der Seite entfernen. Dadurch werden Event-Listener, Timer und DOM-Elemente aufgeräumt. Dies ist besonders wichtig in Single-Page-Anwendungen, bei denen Komponenten während der Navigation ein- und ausgebunden werden.
:::

## TypeScript-Unterstützung

Alle Pakete werden mit vollständigen TypeScript-Typdefinitionen ausgeliefert. Konfigurationsoptionen, Callback-Payloads, Blocktypen und Instanzmethoden sind vollständig typisiert:

```ts
import { init, unmount } from "@templatical/editor";
import type {
  TemplaticalEditor,
  TemplaticalEditorConfig,
} from "@templatical/editor";
import type {
  TemplateContent,
  Block,
  ThemeOverrides,
  FontsConfig,
} from "@templatical/types";
```

## Release-Tarballs

Jedes GitHub-Release enthält dieselben Tarballs, die auch an npm gehen — einen pro Paket. Installieren Sie daraus, wenn ein Build die Registry nicht erreichen kann oder wenn Ihre Abhängigkeiten aus URLs stammen müssen, die Sie selbst prüfen.

```json
{
  "dependencies": {
    "@templatical/renderer": "https://github.com/templatical/sdk/releases/download/v<version>/templatical-renderer-<version>.tgz"
  }
}
```

`<version>` ist die Paketversion, das Tag dieselbe mit einem vorangestellten `v`. Jede veröffentlichte Version hat eines auf der [Releases-Seite](https://github.com/templatical/sdk/releases). Es ist dieselbe Datei, die npm ausgeliefert hätte — das Paket verhält sich also identisch.

Drei Dinge sollten Sie wissen:

**Pinnen Sie auch die Templatical-Pakete, die Sie indirekt nutzen.** Ein Tarball verweist auf seine Geschwisterpakete nur über eine Versionsnummer, Ihr Paketmanager sucht diese Version also weiterhin in der Registry. `@templatical/core`, `@templatical/quality`, `@templatical/renderer`, `@templatical/media-library` und die drei Importer hängen alle von `@templatical/types` ab; `@templatical/media-library` zusätzlich von `@templatical/core`. Verweisen Sie jedes davon, das Sie einbinden, ebenfalls auf einen Tarball:

```yaml
# pnpm-workspace.yaml
overrides:
  '@templatical/types': https://github.com/templatical/sdk/releases/download/v<version>/templatical-types-<version>.tgz
```

npm und Yarn erledigen dasselbe über `overrides` bzw. `resolutions` in der `package.json`. `@templatical/editor` benötigt nichts davon — es bündelt alles, was es verwendet.

**Fremdabhängigkeiten stammen weiterhin aus einer Registry.** `@templatical/types`, `@templatical/renderer`, `@templatical/import-beefree` und `@templatical/import-unlayer` kommen zur Laufzeit ohne weitere Pakete aus. Die übrigen ziehen Pakete nach, die nicht von uns stammen: `@templatical/core` benötigt `@vue/reactivity`, `@templatical/quality` benötigt `htmlparser2`, `@templatical/import-html` und `@templatical/import-mjml` benötigen `cheerio` und `domhandler`, und `@templatical/media-library` benötigt `@lucide/vue`, `@vueuse/core` und `vue-advanced-cropper`. Um diese ohne Registry zu installieren, brauchen Sie auch dafür einen Mirror.

**Die Quellcode-Archive auf derselben Seite sind kein Ersatz.** „Source code (zip)“ und „Source code (tar.gz)“ sind Momentaufnahmen des Repositories, ebenso wie eine `github:templatical/sdk`-Abhängigkeit. Keines von beiden enthält ein gebautes `dist/`, und beide verweisen auf Geschwisterpakete als `workspace:*`, was außerhalb dieses Repositories ins Leere läuft.

## CDN

Wenn Sie keinen Paketmanager verwenden möchten, können Sie den Editor direkt über Script-Tags laden:

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/@templatical/editor/dist/cdn/editor.css"
/>
<script type="module">
  import { init } from "https://unpkg.com/@templatical/editor/dist/cdn/editor.js";

  const editor = await init({
    container: "#editor",
  });
</script>

<div id="editor" style="height: 100vh;"></div>
```

Der CDN-Build ist vollständig eigenständig – alle Abhängigkeiten sind gebündelt. Schwere Bibliotheken (TipTap, Vue, Pusher usw.) werden per Code-Splitting in separate Chunks aufgeteilt und bei Bedarf nachgeladen.
