# Sable Friday

Composed Sable sale: htmlBlockPreview, a product-showcase custom block, and display conditions.

Contract: https://docs.templatical.com/guide/examples#sable-friday
Live: https://play.templatical.com/scenes/example-sable-friday

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
      { label: "Enterprise", before: '{% if plan == "enterprise" %}', after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "product-showcase",
      name: "Product Showcase",
      fields: [
        { type: "text", key: "heading", label: "Section Heading" },
        { type: "repeatable", key: "products", label: "Products", fields: [
          { type: "text", key: "name", label: "Name" },
          { type: "text", key: "price", label: "Price" },
        ] },
      ],
      template: "<div>{{ heading }}</div>",
    },
  ],
  htmlBlockPreview: true,
});
```
