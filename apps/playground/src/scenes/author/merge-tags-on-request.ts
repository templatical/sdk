import type { Scene } from "../types";
import {
  AUTHOR_MERGE_TAGS,
  createOnRequestMergeTag,
  paragraphCanvas,
} from "./shared";

export const mergeTagsOnRequest: Scene = {
  id: "merge-tags-on-request",
  title: "Merge tags on request",
  job: "Pick fields from your app",
  summary:
    "init({ mergeTags: { onRequest } }) — consumer-owned picker takes precedence.",
  affordance: "picker",
  catalog: "oss",
  group: "author",
  docs: "/guide/merge-tags",
  content: () => paragraphCanvas(),
  config: () => ({
    mergeTags: {
      syntax: "liquid" as const,
      tags: AUTHOR_MERGE_TAGS,
      onRequest: createOnRequestMergeTag(AUTHOR_MERGE_TAGS),
    },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", group: "Recipient" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient" },
    ],
    onRequest: async () => {
      // open your own picker; return the chosen tag or null
      return await yourPicker();
    },
  },
});`,
};
