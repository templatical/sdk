# Launchpad launch

SaaS product launch email

Composed Product Launch: merge tags, logic tags, display conditions, a testimonial custom block, and saved blocks.

Contract: https://docs.templatical.com/guide/examples#launchpad-launch
Live: https://play.templatical.com/scenes/example-launchpad-launch

## Snippet

```ts
import { init, createLocalStorageSavedBlocksProvider } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada", group: "Recipient", description: "Personalized greeting at the top of the email" },
      { label: "Last Name", value: "{{last_name}}", group: "Recipient", description: "Recipient family name" },
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient", description: "Primary contact address" },
      { label: "Company", value: "{{company}}", sample: "Analytical Engines Ltd", group: "Account", description: "Recipient organization name" },
      { label: "Plan Name", value: "{{plan_name}}", sample: "Pro", group: "Account", description: "Subscription tier label" },
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
      { label: "Free Users", before: '{% if plan == "free" %}', after: "{% endif %}", group: "Audience" },
    ],
    allowCustom: true,
  },
  customBlocks: [
    {
      type: "testimonial",
      name: "Testimonial",
      fields: [
        { type: "textarea", key: "quote", label: "Quote", required: true },
        { type: "text", key: "authorName", label: "Author Name", required: true },
        { type: "text", key: "authorTitle", label: "Author Title" },
      ],
      template: "<div>{{ quote }} — {{ authorName }}</div>",
    },
  ],
  savedBlocks: createLocalStorageSavedBlocksProvider({
    key: "templatical:saved-blocks:launchpad-launch",
  }),
});
```
