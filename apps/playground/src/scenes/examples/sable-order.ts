import { testEmailProvider } from "../../host/providers";
import {
  createOrderConfirmationTemplate,
  shippingTrackerBlock,
} from "../../templates";
import type { Scene } from "../types";
import {
  EXAMPLE_DISPLAY_CONDITIONS,
  EXAMPLE_LOGIC_TAGS,
  EXAMPLE_MERGE_TAGS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

export const exampleSableOrder: Scene = {
  id: "example-sable-order",
  title: "Sable order",
  job: "Order receipt with sample values",
  summary:
    "Composed Sable receipt: merge-tag samples, logic tags, display conditions, and test email.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#sable-order",
  preview: "order",
  content: () => createOrderConfirmationTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
    logicTags: EXAMPLE_LOGIC_TAGS,
    displayConditions: EXAMPLE_DISPLAY_CONDITIONS,
    customBlocks: [shippingTrackerBlock],
    testEmail: testEmailProvider,
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
  logicTags: {
    tags: [
      { label: "Else", value: "{% else %}", group: "Conditions" },
    ],
    pairs: [
      { label: "If VIP", before: "{% if customer.vip %}", after: "{% endif %}", group: "Conditions" },
    ],
  },
  displayConditions: {
    conditions: [
      { label: "VIP Partners", before: "{% if vip_partner %}", after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "shipping-tracker",
      name: "Shipping Tracker",
      fields: [
        { type: "text", key: "carrier", label: "Carrier", readOnly: true },
        { type: "text", key: "trackingNumber", label: "Tracking Number", readOnly: true },
      ],
      template: "<div>{{ carrier }} · {{ trackingNumber }}</div>",
    },
  ],
  testEmail: {
    includeMjml: true,
    allowedRecipients: ["you@example.com", "teammate@example.com"],
    send: async ({ recipient, content, mjml }) => {
      await fetch("/api/test-email", {
        method: "POST",
        body: JSON.stringify({ recipient, content, mjml }),
      });
    },
  },
});`,
};
