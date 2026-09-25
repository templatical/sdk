import { createPasswordResetTemplate } from "../../templates";
import type { Scene } from "../types";
import { EXAMPLE_MERGE_TAGS, SNIPPET_MERGE_TAGS } from "./shared";

export const exampleLaunchpadReset: Scene = {
  id: "example-launchpad-reset",
  title: "Launchpad reset",
  job: "Password reset, same brand",
  summary:
    "Composed Launchpad password reset: merge tags on the teal transactional kit.",
  catalog: "oss",
  group: "examples",
  docs: "/guide/examples#launchpad-reset",
  content: () => createPasswordResetTemplate(),
  config: () => ({
    mergeTags: { syntax: "liquid" as const, tags: EXAMPLE_MERGE_TAGS },
  }),
  snippet: `import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: document.getElementById("editor"),
  ${SNIPPET_MERGE_TAGS},
});`,
};
