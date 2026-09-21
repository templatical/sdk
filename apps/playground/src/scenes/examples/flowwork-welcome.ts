import { testEmailProvider } from "../../host/providers";
import { createWelcomeTemplate } from "../../templates";
import { resolvePreviewDemo } from "../author/shared";
import type { Scene } from "../types";
import {
  EXAMPLE_LOGIC_TAGS,
  EXAMPLE_MERGE_TAGS,
  SNIPPET_MERGE_TAGS,
} from "./shared";

export const exampleFlowworkWelcome: Scene = {
  id: "example-flowwork-welcome",
  title: "Flowwork welcome",
  summary:
    "Composed Flowwork onboarding: merge tags, logic tags, resolvePreview, and test email.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#flowwork-welcome",
  content: () => createWelcomeTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
    logicTags: EXAMPLE_LOGIC_TAGS,
    resolvePreview: resolvePreviewDemo,
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
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch("/api/resolve-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, recipient }),
    });
    return res.json();
  },
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
