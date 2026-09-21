# Northstage event

Composed Northstage Summit invitation: brand-locked colors, event-details custom block, and display conditions.

Contract: https://docs.templatical.com/guide/examples#northstage-event
Live: https://play.templatical.com/scenes/example-northstage-event

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
});
```
