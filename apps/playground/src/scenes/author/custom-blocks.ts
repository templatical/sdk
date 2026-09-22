import type { Scene } from "../types";
import { AUTHOR_TESTIMONIAL, customBlockCanvas } from "./shared";

export const customBlocks: Scene = {
  id: "custom-blocks",
  title: "Custom blocks",
  job: "Register your own block type",
  summary: "init({ customBlocks }) — one registered block on the palette.",
  affordance: "custom",
  catalog: "oss",
  group: "author",
  docs: "/guide/custom-blocks",
  content: () => customBlockCanvas(),
  config: () => ({
    customBlocks: [AUTHOR_TESTIMONIAL],
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  customBlocks: [
    {
      type: "testimonial",
      name: "Testimonial",
      fields: [
        { type: "textarea", key: "quote", label: "Quote", required: true },
        { type: "text", key: "authorName", label: "Author Name", required: true },
      ],
      template: "<div>{{ quote }} — {{ authorName }}</div>",
    },
  ],
});`,
};
