import type { Scene } from "../types";
import { AUTHOR_MERGE_TAGS, paragraphCanvas } from "./shared";

export const mergeTags: Scene = {
  id: "merge-tags",
  title: "Merge tags",
  job: "Insert a field from the list",
  initKey: "mergeTags",
  summary: "init({ mergeTags }) — static tags, built-in picker, no onRequest.",
  affordance: "tag",
  catalog: "oss",
  group: "personalization",
  docs: "/guide/merge-tags",
  content: () => paragraphCanvas(),
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
      { label: "First Name", value: "{{first_name}}", sample: "Ada", group: "Recipient", description: "Personalized greeting at the top of the email" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient", description: "Recipient family name" },
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient" },
    ],
  },
});`,
};
