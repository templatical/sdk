import type { Scene } from "../types";
import { AUTHOR_LOGIC_TAGS, logicCanvas } from "./shared";

export const logicTags: Scene = {
  id: "logic-tags",
  title: "Logic tags",
  job: "Branch copy with IF / ENDIF",
  summary:
    "init({ logicTags }) — insert control-flow tokens from a dedicated picker.",
  affordance: "logic",
  catalog: "oss",
  group: "author",
  docs: "/guide/logic-tags",
  content: () => logicCanvas(),
  config: () => ({
    logicTags: AUTHOR_LOGIC_TAGS,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  logicTags: {
    tags: [
      { label: "Else", value: "{% else %}", group: "Conditions" },
    ],
    pairs: [
      { label: "If VIP", before: "{% if customer.vip %}", after: "{% endif %}", group: "Conditions" },
    ],
  },
});`,
};
