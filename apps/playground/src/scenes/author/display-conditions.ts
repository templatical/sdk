import type { Scene } from "../types";
import { AUTHOR_DISPLAY_CONDITIONS, displayConditionCanvas } from "./shared";

export const displayConditions: Scene = {
  id: "display-conditions",
  title: "Display conditions",
  job: "Hide a block per recipient",
  initKey: "displayConditions",
  summary: "init({ displayConditions }) — show or hide a block per recipient.",
  affordance: "condition",
  catalog: "oss",
  group: "personalization",
  docs: "/guide/display-conditions",
  content: () => displayConditionCanvas(),
  config: () => ({
    displayConditions: AUTHOR_DISPLAY_CONDITIONS,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  displayConditions: {
    conditions: [
      { label: "VIP Partners", before: "{% if vip_partner %}", after: "{% endif %}", group: "Audience" },
      { label: "Free Users", before: '{% if plan == "free" %}', after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
});`,
};
