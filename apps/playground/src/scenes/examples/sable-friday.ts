import {
  createBlackFridayTemplate,
  productShowcaseBlock,
} from "../../templates";
import type { Scene } from "../types";
import {
  EXAMPLE_DISPLAY_CONDITIONS,
  EXAMPLE_MERGE_TAGS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

export const exampleSableFriday: Scene = {
  id: "example-sable-friday",
  title: "Sable Friday",
  summary:
    "Composed Sable sale: htmlBlockPreview, a product-showcase custom block, and display conditions.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#sable-friday",
  preview: "/examples/sable/speaker.png",
  content: () => createBlackFridayTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
    displayConditions: EXAMPLE_DISPLAY_CONDITIONS,
    customBlocks: [productShowcaseBlock],
    htmlBlockPreview: true,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
  displayConditions: {
    conditions: [
      { label: "Enterprise", before: '{% if plan == "enterprise" %}', after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "product-showcase",
      name: "Product Showcase",
      fields: [
        { type: "text", key: "heading", label: "Section Heading" },
        { type: "repeatable", key: "products", label: "Products", fields: [
          { type: "text", key: "name", label: "Name" },
          { type: "text", key: "price", label: "Price" },
        ] },
      ],
      template: "<div>{{ heading }}</div>",
    },
  ],
  htmlBlockPreview: true,
});`,
};
