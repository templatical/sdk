import {
  createEventInvitationTemplate,
  eventDetailsBlock,
} from "../../templates";
import type { Scene } from "../types";
import {
  EXAMPLE_DISPLAY_CONDITIONS,
  EXAMPLE_MERGE_TAGS,
  NORTHSTAGE_BLOCK_DEFAULTS,
  NORTHSTAGE_COLORS,
  NORTHSTAGE_TEMPLATE_DEFAULTS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

export const exampleNorthstageEvent: Scene = {
  id: "example-northstage-event",
  title: "Northstage event",
  job: "Event invite, locked colors",
  summary:
    "Composed Northstage Summit invitation: brand-locked colors, event-details custom block, and display conditions.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#northstage-event",
  preview: "event",
  content: () => createEventInvitationTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
    displayConditions: EXAMPLE_DISPLAY_CONDITIONS,
    customBlocks: [eventDetailsBlock],
    colors: NORTHSTAGE_COLORS,
    blockDefaults: NORTHSTAGE_BLOCK_DEFAULTS,
    templateDefaults: NORTHSTAGE_TEMPLATE_DEFAULTS,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
  displayConditions: {
    conditions: [
      { label: "Early Bird", before: "{% if early_bird %}", after: "{% endif %}", group: "Registration" },
      { label: "Speakers", before: "{% if is_speaker %}", after: "{% endif %}", group: "Role" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "event-details",
      name: "Event Details",
      fields: [
        { type: "text", key: "eventName", label: "Event Name", required: true },
        { type: "text", key: "date", label: "Date", required: true },
        { type: "color", key: "accentColor", label: "Accent Color", presets: ["#7c3aed", "#ec4899"] },
      ],
      template: "<div>{{ eventName }} — {{ date }}</div>",
    },
  ],
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
