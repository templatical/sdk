import { createArabicInvitationTemplate } from "../../templates";
import type { Scene } from "../types";
import {
  EXAMPLE_MERGE_TAGS,
  NORTHSTAGE_BLOCK_DEFAULTS,
  NORTHSTAGE_COLORS,
  NORTHSTAGE_TEMPLATE_DEFAULTS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

export const exampleNorthstageAr: Scene = {
  id: "example-northstage-ar",
  title: "Northstage Arabic",
  summary:
    "Same Northstage Summit invitation in ar, RTL canvas, brand-locked colors.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#northstage-ar",
  preview: "rtl",
  content: () => createArabicInvitationTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
    colors: NORTHSTAGE_COLORS,
    blockDefaults: NORTHSTAGE_BLOCK_DEFAULTS,
    templateDefaults: NORTHSTAGE_TEMPLATE_DEFAULTS,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
  colors: {
    presets: ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#111827", "#ffffff"],
    allowCustom: false,
  },
  blockDefaults: {
    button: { backgroundColor: "#7c3aed" },
  },
  templateDefaults: {
    textColor: "#111827",
  },
});`,
};
