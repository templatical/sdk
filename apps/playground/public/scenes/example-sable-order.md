# Sable order

Composed Sable receipt: merge-tag samples, logic tags, display conditions, and test email.

Contract: https://docs.templatical.com/guide/examples#sable-order
Live: https://play.templatical.com/scenes/example-sable-order

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada", group: "Recipient", description: "Personalized greeting at the top of the email" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient", description: "Recipient family name" },
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient", description: "Primary contact address" },
      { label: "Unsubscribe URL", value: "{{unsubscribe_url}}", sample: "https://example.com/unsubscribe", group: "System" },
    ],
  },
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
});
```
