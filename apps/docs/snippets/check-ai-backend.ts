import { createHttpAiProvider } from "@templatical/ai-kit/client";
import {
  AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  AI_EVAL_TEMPLATES,
  runAiProviderConformance,
  runAiWireConformance,
} from "@templatical/ai-kit/testing";

const token = process.env.AI_TEST_TOKEN;
if (!token) throw new Error("Set AI_TEST_TOKEN for a disposable test account.");
const baseUrl = process.env.AI_BASE_URL ?? "http://localhost:8787/ai";
const templatesUrl =
  process.env.AI_TEMPLATES_URL ?? "http://localhost:8787/api/templates";
const headers = { Authorization: `Bearer ${token}` };
const content = structuredClone(AI_EVAL_TEMPLATES.welcome);
const logo = content.blocks.find((block) => block.type === "image");
if (!logo) throw new Error("The welcome fixture must contain an image.");
// Both conformance suites authorize this synthetic alt-text probe by block id.
content.blocks.push({
  ...logo,
  id: "conformance-image",
  src: AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  alt: "",
});
const created = await fetch(templatesUrl, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Disposable AI conformance",
    content,
  }),
});
if (!created.ok)
  throw new Error(`Test template creation: HTTP ${created.status}`);
const template = (await created.json()) as { id: string };
if (!template.id) throw new Error("The templates endpoint must return { id }.");

// Match the guide's stateless server and a text-only chat adapter.
const features = { conversation: false, chatAttachments: false } as const;
const timeoutMs = 60_000;
const provider = createHttpAiProvider({ baseUrl, headers, features });
const providerReport = await runAiProviderConformance(provider, {
  templateId: template.id,
  content,
  timeoutMs,
});
const wireReport = await runAiWireConformance({
  baseUrl,
  headers,
  features,
  templateId: template.id,
  timeoutMs,
});
for (const [suite, report] of [
  ["provider", providerReport],
  ["wire", wireReport],
] as const) {
  for (const check of report.checks) {
    console.log(suite, check.ok ? "ok" : "FAIL", check.name, check.detail);
  }
  if (!report.ok) process.exitCode = 1;
}
