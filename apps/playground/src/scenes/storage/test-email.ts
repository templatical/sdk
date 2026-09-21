import { testEmailProvider } from "../../host/providers";
import type { Scene } from "../types";
import { storageCanvas } from "./canvas";

export const testEmail: Scene = {
  id: "test-email",
  title: "Test email",
  summary:
    "init({ testEmail }) — header Test button, recipient picker, fake send.",
  catalog: "oss",
  group: "storage",
  docs: "/backend/test-email",
  content: () => storageCanvas(),
  config: () => ({
    testEmail: testEmailProvider,
  }),
  snippet: `import { init } from "@templatical/editor";
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
});`,
};
