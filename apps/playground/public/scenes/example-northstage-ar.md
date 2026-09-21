# Northstage Arabic

Same Northstage Summit invitation in ar, RTL canvas, brand-locked colors.

Contract: https://docs.templatical.com/guide/examples#northstage-ar
Live: https://play.templatical.com/scenes/example-northstage-ar

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
