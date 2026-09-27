import type { Scene } from "../types";
import { AUTHOR_DISPLAY_CONDITIONS, displayConditionCanvas } from "./shared";

export const displayConditions: Scene = {
  id: "display-conditions",
  title: "Display conditions",
  job: "Hide a block per recipient",
  initKey: "displayConditions",
  summary: "init({ displayConditions }) — show or hide a block per recipient.",
  catalog: "oss",
  group: "personalization",
  docs: "/guide/display-conditions",
  pointer: {
    selector: '[data-block-type="paragraph"]',
    root: "editor",
    side: "below",
  },
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
