import type { Scene } from "../types";
import { AUTHOR_MERGE_TAGS, samplesCanvas } from "./shared";

export const mergeTagsSamples: Scene = {
  id: "merge-tags-samples",
  title: "Merge tag samples",
  job: "Preview with sample values",
  initKey: "mergeTags.tags[].sample",
  summary:
    "init({ mergeTags }) with MergeTag.sample — preview substitutes, no resolver.",
  catalog: "oss",
  group: "personalization",
  docs: "/guide/preview-rendering",
  content: () => samplesCanvas(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: AUTHOR_MERGE_TAGS },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada" },
      { label: "Last Name", value: "{{last_name}}" },
    ],
  },
});`,
};
