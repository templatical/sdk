# Test email

init({ testEmail }) — header Test button, recipient picker, fake send.

Contract: https://docs.templatical.com/backend/test-email
Live: https://play.templatical.com/scenes/test-email

## Snippet

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  testEmail: {
    // replace with your API
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
