import { createLocalStorageSavedBlocksProvider } from "@templatical/core";
import {
  createNewsletterTemplate,
  featuredArticleBlock,
  newsletterSavedBlocks,
} from "../../templates";
import type { Scene } from "../types";
import {
  EXAMPLE_MERGE_TAGS,
  FLOWWORK_FONTS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

const SAVED_BLOCKS_KEY = "templatical:saved-blocks:flowwork-newsletter";

function seedFlowworkSavedBlocks(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(SAVED_BLOCKS_KEY) !== null) return;
  const seed = newsletterSavedBlocks;
  if (!seed?.length) return;
  localStorage.setItem(SAVED_BLOCKS_KEY, JSON.stringify(seed));
}

export const exampleFlowworkNewsletter: Scene = {
  id: "example-flowwork-newsletter",
  title: "Flowwork newsletter",
  job: "Weekly digest with curated fonts",
  summary:
    "Composed Flowwork weekly: curated fonts, a featured-article custom block, and saved blocks.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#flowwork-newsletter",
  content: () => createNewsletterTemplate(),
  config: () => {
    seedFlowworkSavedBlocks();
    return {
      mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
      fonts: FLOWWORK_FONTS,
      customBlocks: [featuredArticleBlock],
      savedBlocks: createLocalStorageSavedBlocksProvider({
        key: SAVED_BLOCKS_KEY,
      }),
    };
  },
  snippet: `import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
  fonts: {
    builtIns: ["Georgia", "Times New Roman", "Arial"],
  },
  customBlocks: [
    {
      type: "featured-article",
      name: "Featured Article",
      fields: [
        { type: "text", key: "title", label: "Title", readOnly: true },
        { type: "textarea", key: "excerpt", label: "Excerpt", readOnly: true },
      ],
      template: "<div>{{ title }}</div>",
    },
  ],
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:flowwork-newsletter",
  }),
});`,
};
