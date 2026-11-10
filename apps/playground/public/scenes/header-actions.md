# Header actions

Put your controls in the header

init({ header: { actions } }) — host controls beside the editor's actions.

Contract: https://docs.templatical.com/api/editor#header-actions
Live: https://play.templatical.com/scenes/header-actions

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const actions = document.createElement("div");
actions.className = "my-header-actions";
const button = document.createElement("button");
button.type = "button";
button.textContent = "Template";
const menu = document.createElement("div");
menu.hidden = true;
menu.style.position = "absolute";
for (const label of ["Save as template", "Change template"]) {
  const item = document.createElement("button");
  item.type = "button";
  item.textContent = label;
  menu.appendChild(item);
}
button.addEventListener("click", () => { menu.hidden = !menu.hidden; });
actions.append(button, menu);

const editor = await init({
  container: document.getElementById("editor"),
  header: { actions: actions, previewToggle: false, darkModeToggle: false },
});

// Style [data-tpl-compact="true"] in CSS; keep this element in your own framework root.
// The editor moves it into the header and removes it on editor.unmount().
```
