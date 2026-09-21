import type { Scene } from "../types";
import {
  AUTHOR_DISPLAY_CONDITIONS,
  AUTHOR_MERGE_TAGS,
  resolvePreviewCanvas,
  resolvePreviewDemo,
} from "./shared";

export const mergeTagsResolvePreview: Scene = {
  id: "merge-tags-resolve-preview",
  title: "Resolve preview",
  summary:
    "init({ resolvePreview }) — backend resolves tags and evaluates logic in preview.",
  catalog: "oss",
  group: "author",
  docs: "/guide/preview-rendering",
  content: () => resolvePreviewCanvas(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: AUTHOR_MERGE_TAGS },
    displayConditions: AUTHOR_DISPLAY_CONDITIONS,
    resolvePreview: resolvePreviewDemo,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada" },
      { label: "Plan Name", value: "{{plan_name}}", sample: "Pro" },
    ],
  },
  displayConditions: {
    conditions: [
      { label: "VIP Partners", before: "{% if vip_partner %}", after: "{% endif %}" },
    ],
  },
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch("/api/resolve-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, recipient }),
    });
    return res.json();
  },
});`,
};
