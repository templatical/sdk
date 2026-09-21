# Resolve preview

init({ resolvePreview }) — backend resolves tags and evaluates logic in preview.

Contract: https://docs.templatical.com/guide/preview-rendering
Live: https://play.templatical.com/scenes/merge-tags-resolve-preview

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  mergeTags: {
    syntax: "liquid",
    tags: [
      { label: "First Name", value: "{{first_name}}", sample: "Ada" },
      { label: "Plan Name", value: "{{plan_name}}", sample: "Pro" },
    ],
  },
  displayConditions: {
    conditions: [
      { label: "VIP Partners", before: "{% if vip_partner %}", after: "{% endif %}" },
    ],
  },
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch("/api/resolve-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, recipient }),
    });
    return res.json();
  },
});
```
