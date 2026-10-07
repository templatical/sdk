---
title: Troubleshooting
description: Symptom → cause for a Templatical editor mount — missing stylesheet, trapped dialogs, height chain, StrictMode unmount.
---

# Troubleshooting

Match the symptom to the row before changing anything. Several of these look like a broken build and throw nothing. Container and stacking detail: [Embedding](/getting-started/embedding).

| Symptom | Cause | What to do |
|---|---|---|
| Editor renders in a fallback font, or has no layout with `shadowDom: false` | `@templatical/editor/style.css` was not imported. It loads the editor's Geist font, and with `shadowDom: false` it is the editor's only stylesheet. The default shadow mount carries its own copy of the editor's CSS. The `exports` map resolves that subpath to `dist/style.css`. | Import the stylesheet next to `init()`. Do not install `tailwindcss` as a peer — it is compiled into that file. |
| Dialogs clipped, painted under host chrome, or a drag ghost that drifts | An ancestor of the container is a containing block for `position: fixed`: `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` below `1`, or a positioned element with `z-index`. | Remove that property from ancestors, or mount outside that stacking context. |
| Sidebar last items / footer clip, no scroll | The container has no definite height. The editor fills its parent; without one it uses a small anti-collapse floor and chrome still assumes real height. | Give the container a real height (`100%` of a sized parent, or a `px`/`vh` value). |
| React 18 StrictMode: extra editors, leaked listeners | `init()` is async. StrictMode unmounts the effect before the promise resolves, so the created instance is never stored and never `unmount()`ed. | Unmount the instance that just finished when the effect was cancelled. See [Installation](/getting-started/installation). |
| `toHtml()` throws / `toMjml()` asks for a package | The SDK ships no MJML compiler. `toMjml()` lazy-imports `@templatical/renderer`. HTML is any MJML library, `render.compileMjml`, or `template-tools render --format html`. | Install the renderer peer for MJML. Compile HTML on the server. [How Rendering Works](/getting-started/how-rendering-works). |
| `require('@templatical/editor')` fails | ESM only. No `main`, no CJS, no UMD. | Use `import`. A CJS-only app needs a bundler that can consume ESM. |
| Theming tokens vanish after `all: initial` on the container | Inheritance crosses the shadow boundary. Resetting the container wipes `--tpl-user-*`, which is the theming surface, and can break the height chain. | Do not reset the container. The editor already neutralizes host typography at its own root. |

The Agent Skill's `diagnose` mode walks the same table against an existing `init()` call.
