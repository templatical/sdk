import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  type TemplateContent,
} from "@templatical/types";
import type { Scene } from "../types";
import { setupBaseCanvas } from "./shared";

/**
 * The shell from guide/layout: a grey mat, a "View in browser" line, the
 * authored email inside a white card, and an imprint line under the card.
 */
function cardShell(): TemplateContent {
  const shell = createDefaultTemplateContent();
  shell.settings.backgroundColor = "#f3f4f6";
  shell.blocks = [
    createParagraphBlock({
      content:
        '<p style="text-align:center"><a href="https://example.com/view">View in browser</a></p>',
    }),
    createWrapperBlock({
      styles: {
        backgroundColor: "#ffffff",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
      borderRadius: 12,
      children: [createSlotBlock()],
    }),
    createParagraphBlock({
      content:
        '<p style="text-align:center"><a href="https://example.com/imprint">Imprint</a></p>',
    }),
  ];
  return shell;
}

export const layout: Scene = {
  id: "layout",
  title: "Layout",
  job: "Wrap every email in your shell",
  initKey: "layout",
  summary:
    "init({ layout }) — your shell wraps the email in preview and export, never in saved JSON.",
  catalog: "oss",
  group: "configure",
  docs: "/guide/layout",
  content: () => setupBaseCanvas(),
  // The slot sits inside a wrapper, so Add wrapper would nest mj-wrapper in
  // mj-wrapper, which MJML forbids.
  config: () => ({ layout: cardShell(), sectionWrapper: false }),
  snippet: `import {
  init,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
} from "@templatical/editor";
import "@templatical/editor/style.css";

const shell = createDefaultTemplateContent();
shell.settings.backgroundColor = "#f3f4f6";
shell.blocks = [
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/view">View in browser</a></p>',
  }),
  createWrapperBlock({
    styles: {
      backgroundColor: "#ffffff",
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
    },
    borderRadius: 12,
    children: [createSlotBlock()],
  }),
  createParagraphBlock({
    content:
      '<p style="text-align:center"><a href="https://example.com/imprint">Imprint</a></p>',
  }),
];

const editor = await init({
  container: document.getElementById("editor"),
  layout: shell,
  sectionWrapper: false,
});`,
};
