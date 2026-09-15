---
title: Fehlerbehebung
description: Symptom → Ursache bei einem Templatical-Editor-Mount — doppeltes Vue, fehlendes Stylesheet, gefangene Dialoge, Höhenkette, StrictMode-Unmount.
---

# Fehlerbehebung

Das Symptom der Zeile zuordnen, bevor etwas geändert wird. Mehrere davon sehen wie ein kaputter Build aus und werfen nichts. Container und Stacking: [Einbetten](/de/getting-started/embedding).

| Symptom | Ursache | Was tun |
|---|---|---|
| Chrome rendert, Klicks / Drags / Tasten tun nichts | Eine zweite Vue-Reactivity-Instanz. `@templatical/core` (oder ein anderes Vue-nutzendes `@templatical/*`-Paket) steht in den `dependencies` der App, daher sind Refs, die der Editor erzeugt, für diese zweite `WeakMap` unsichtbar. | Diese Pakete nicht in die `dependencies` der App aufnehmen. Der Editor bundelt sie bereits. |
| Editor mountet, Layout fehlt | `@templatical/editor/style.css` wurde nicht importiert. Die `exports`-Map löst diesen Subpath zu `dist/style.css` auf. | Das Stylesheet neben `init()` importieren. `tailwindcss` nicht als Peer installieren — es ist in diese Datei einkompiliert. |
| Dialoge abgeschnitten, unter Host-Chrome, oder ein Drag-Ghost der driftet | Ein Vorfahre des Containers ist Containing Block für `position: fixed`: `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`, `contain`, `isolation`, `opacity` unter `1`, oder ein positioniertes Element mit `z-index`. | Die Eigenschaft an Vorfahren entfernen, oder außerhalb dieses Stacking-Kontexts mounten. |
| Letzte Sidebar-Einträge / Footer abgeschnitten, kein Scroll | Der Container hat keine definite Höhe. Der Editor füllt das Elternelement; ohne Höhe nutzt er eine kleine Anti-Collapse-Untergrenze, das Chrome nimmt trotzdem echte Höhe an. | Dem Container eine echte Höhe geben (`100%` eines bemessenen Parents, oder `px`/`vh`). |
| React 18 StrictMode: Extra-Editoren, undichte Listener | `init()` ist asynchron. StrictMode unmountet den Effect, bevor das Promise auflöst, daher wird die Instanz nie gespeichert und nie `unmount()`ed. | Die Instanz, die gerade fertig wurde, unmounten, wenn der Effect abgebrochen war. Siehe [Installation](/de/getting-started/installation). |
| `toHtml()` wirft / `toMjml()` verlangt ein Paket | Das SDK liefert keinen MJML-Compiler. `toMjml()` lädt `@templatical/renderer` lazy. HTML ist jede MJML-Bibliothek, `render.compileMjml` oder `template-tools render --format html`. | Den Renderer-Peer für MJML installieren. HTML auf dem Server kompilieren. [So funktioniert das Rendering](/de/getting-started/how-rendering-works). |
| `require('@templatical/editor')` schlägt fehl | Nur ESM. Kein `main`, kein CJS, kein UMD. | `import` verwenden. Eine reine-CJS-App braucht einen Bundler, der ESM konsumieren kann. |
| Theme-Tokens verschwinden nach `all: initial` am Container | Vererbung überquert die Shadow-Grenze. Ein Reset am Container löscht `--tpl-user-*`, die Theming-Oberfläche, und kann die Höhenkette zerbrechen. | Den Container nicht resetten. Der Editor neutralisiert Host-Typografie an der eigenen Wurzel. |

Der `diagnose`-Modus des Agent Skills prüft dieselbe Tabelle gegen einen bestehenden `init()`-Aufruf.
