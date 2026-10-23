---
title: Fehlerbehebung
description: Symptom → Ursache bei einem Templatical-Editor-Mount — fehlendes Stylesheet, gefangene Dialoge, Höhenkette, Unmount während init().
---

# Fehlerbehebung

Das Symptom der Zeile zuordnen, bevor etwas geändert wird. Mehrere davon sehen wie ein kaputter Build aus und werfen nichts. Container und Stacking: [Einbetten](/de/getting-started/embedding).

| Symptom | Ursache | Was tun |
|---|---|---|
| Kein Tab „Probleme“ oder keine Lint-Badges | `@templatical/quality` fehlt oder wurde weggelassen. | Fügen Sie `@templatical/quality` zu Ihren Abhängigkeiten hinzu. Falls das Paket vorhanden ist, prüfen Sie `lint.disabled` und die Einstellungen pro Tool. |
| Editor erscheint in einer Fallback-Schrift, oder ohne Layout mit `shadowDom: false` | `@templatical/editor/style.css` wurde nicht importiert. Es lädt die Geist-Schrift des Editors, und mit `shadowDom: false` ist es das einzige Stylesheet des Editors. Der Standardmodus (Shadow DOM) bringt eine eigene Kopie des Editor-CSS mit. Die `exports`-Map löst diesen Subpath zu `dist/style.css` auf. | Das Stylesheet neben `init()` importieren. `tailwindcss` nicht als Peer installieren — es ist in diese Datei einkompiliert. |
| Dialoge abgeschnitten, unter Host-Chrome, oder ein Drag-Ghost der driftet | Ein Vorfahre des Containers ist Containing Block für `position: fixed`: `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` unter `1`, oder ein positioniertes Element mit `z-index`. | Die Eigenschaft an Vorfahren entfernen, oder außerhalb dieses Stacking-Kontexts mounten. |
| Letzte Sidebar-Einträge / Footer abgeschnitten, kein Scroll | Der Container hat keine definite Höhe. Der Editor füllt das Elternelement; ohne Höhe nutzt er eine kleine Anti-Collapse-Untergrenze, das Chrome nimmt trotzdem echte Höhe an. | Dem Container eine echte Höhe geben (`100%` eines bemessenen Parents, oder `px`/`vh`). |
| `Cmd`/`Strg`+`S` und `Cmd`/`Strg`+`Z` bleiben abgefangen, nachdem die Seite des Editors verlassen wurde, oder ein neu gemounteter Editor ignoriert sie bis zum ersten Klick | `init()` ist asynchron. Eine Komponente, die ausgebunden wird, während `init()` noch aussteht, etwa bei einem Routenwechsel oder bei bedingtem Rendern, führt ihr Cleanup aus, bevor die Instanz existiert. Der Aufruf mountet seinen Editor trotzdem, in den entfernten Container, und ein Cleanup, das nur den gespeicherten Editor unmountet, erreicht ihn nie: Sein `keydown`-Listener auf `document` bleibt registriert und übernimmt die Tastenkürzel, bis ein Klick in einem anderen Editor landet. Bis einschließlich 0.44.0 bewirkt der doppelte Effect-Durchlauf von React StrictMode in der Entwicklung dasselbe. | Eine Instanz unmounten, die erst nach dem Cleanup auflöst, wie es die Framework-Snippets unter [Installation](/de/getting-started/installation) tun. |
| `toHtml()` wirft / `toMjml()` verlangt ein Paket | Das SDK liefert keinen MJML-Compiler. `toMjml()` lädt `@templatical/renderer` lazy. HTML ist jede MJML-Bibliothek, `render.compileMjml` oder `template-tools render --format html`. | Den Renderer-Peer für MJML installieren. HTML auf dem Server kompilieren. [So funktioniert das Rendering](/de/getting-started/how-rendering-works). |
| `require('@templatical/editor')` schlägt fehl | Nur ESM. Kein `main`, kein CJS, kein UMD. | `import` verwenden. Eine reine-CJS-App braucht einen Bundler, der ESM konsumieren kann. |
| Theme-Tokens verschwinden nach `all: initial` am Container | Vererbung überquert die Shadow-Grenze. Ein Reset am Container löscht `--tpl-user-*`, die Theming-Oberfläche, und kann die Höhenkette zerbrechen. | Den Container nicht resetten. Der Editor neutralisiert Host-Typografie an der eigenen Wurzel. |

Der `diagnose`-Modus des Agent Skills prüft dieselbe Tabelle gegen einen bestehenden `init()`-Aufruf.
