# Merge tags

Insert a field from the list

init({ mergeTags }) — static tags, built-in picker, no onRequest.

Contract: https://docs.templatical.com/guide/merge-tags#configuration
Live: https://play.templatical.com/scenes/merge-tags

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
      { label: "Email", value: "{{email}}", sample: "ada@example.com", group: "Recipient" },
    ],
  },
});
```
