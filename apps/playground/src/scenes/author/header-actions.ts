import { templatesProviderFor, testEmailProvider } from "../../host/providers";
import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

function hostActions(): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "pg-header-actions";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "pg-header-action-trigger";
  trigger.dataset.testid = "host-template-action";
  trigger.setAttribute("aria-label", "Template");
  trigger.innerHTML =
    '<span class="pg-header-action-label">Template</span><span aria-hidden="true">▾</span>';
  const menu = document.createElement("div");
  menu.className = "pg-header-action-menu";
  menu.dataset.testid = "host-template-menu";
  menu.hidden = true;
  for (const label of ["Save as template", "Change template"]) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    item.addEventListener("click", () => {
      menu.hidden = true;
    });
    menu.appendChild(item);
  }
  trigger.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  actions.append(trigger, menu);
  return actions;
}

const snippet = `import { init } from "@templatical/editor";
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
// The editor moves it into the header and removes it on editor.unmount().`;

export const headerActions: Scene = {
  id: "header-actions",
  title: "Header actions",
  job: "Put your controls in the header",
  initKey: "header.actions",
  summary:
    "init({ header: { actions } }) — host controls beside the editor's actions.",
  catalog: "oss",
  group: "configure",
  docs: "/api/editor#header-actions",
  pointer: {
    selector: '[data-testid="host-template-action"]',
    root: "page",
    side: "below",
  },
  content: () => setupBaseCanvas(),
  config(ctx) {
    return {
      header: {
        actions: typeof document === "undefined" ? undefined : hostActions(),
        darkModeToggle: ctx.search.get("darkToggle") === "1",
        previewToggle: ctx.search.get("preview") === "1",
      },
      ...(ctx.search.get("templates") === "1"
        ? {
            templates: templatesProviderFor("header-actions"),
            testEmail: testEmailProvider,
          }
        : {}),
    };
  },
  snippet,
};
