---
title: Troubleshooting
description: Symptom → cause for a Templatical editor mount — missing stylesheet, trapped dialogs, height chain, unmount during init().
---

# Troubleshooting

Match the symptom to the row before changing anything. Several of these look like a broken build and throw nothing. Container and stacking detail: [Embedding](/getting-started/embedding).

| Symptom | Cause | What to do |
|---|---|---|
| No Issues tab or lint badges | `@templatical/quality` is missing or was left out. | Add `@templatical/quality` to your dependencies. If it is present, check `lint.disabled` and per-tool settings. |
| Editor renders in a fallback font, or has no layout with `shadowDom: false` | `@templatical/editor/style.css` was not imported. It loads the editor's Geist font, and with `shadowDom: false` it is the editor's only stylesheet. The default shadow mount carries its own copy of the editor's CSS. The `exports` map resolves that subpath to `dist/style.css`. | Import the stylesheet next to `init()`. Do not install `tailwindcss` as a peer — it is compiled into that file. |
| Dialogs clipped, painted under host chrome, or a drag ghost that drifts | An ancestor of the container is a containing block for `position: fixed`: `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` below `1`, or a positioned element with `z-index`. | Remove that property from ancestors, or mount outside that stacking context. |
| Sidebar last items / footer clip, no scroll | The container has no definite height. The editor fills its parent; without one it uses a small anti-collapse floor and chrome still assumes real height. | Give the container a real height (`100%` of a sized parent, or a `px`/`vh` value). |
| `Cmd`/`Ctrl`+`S` and `Cmd`/`Ctrl`+`Z` stay intercepted after leaving the editor's page, or a remounted editor ignores them until clicked | `init()` is async. A component that unmounts while `init()` is pending, on a route change or a conditional render, runs its cleanup before the instance exists. The call still mounts its editor, into the removed container, and a cleanup that unmounts only the stored editor never reaches it: its `document` `keydown` listener stays registered and takes the shortcuts until a click lands in another editor. In 0.44.0 and earlier, React StrictMode's development re-run does the same. | Unmount an instance that resolves after the cleanup ran, as the framework snippets in [Installation](/getting-started/installation) do. |
| `toHtml()` throws / `toMjml()` asks for a package | The SDK ships no MJML compiler. `toMjml()` lazy-imports `@templatical/renderer`. HTML is any MJML library, `render.compileMjml`, or `template-tools render --format html`. | Install the renderer peer for MJML. Compile HTML on the server. [How Rendering Works](/getting-started/how-rendering-works). |
| `require('@templatical/editor')` fails | ESM only. No `main`, no CJS, no UMD. | Use `import`. A CJS-only app needs a bundler that can consume ESM. |
| Theming tokens vanish after `all: initial` on the container | Inheritance crosses the shadow boundary. Resetting the container wipes `--tpl-user-*`, which is the theming surface, and can break the height chain. | Do not reset the container. The editor already neutralizes host typography at its own root. |

The Agent Skill's `diagnose` mode walks the same table against an existing `init()` call.
