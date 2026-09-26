import { createDefaultTemplateContent } from "@templatical/types";
import type { Scene } from "../types";

export const IMPORT_IDS = [
  "import-unlayer",
  "import-beefree",
  "import-html",
  "import-mjml",
  "import-topol",
  "import-stripo",
  "import-chamaileon",
  "import-easy-email-pro",
] as const;

export type ImportSceneId = (typeof IMPORT_IDS)[number];

export type ImportKind =
  | "unlayer"
  | "beefree"
  | "html"
  | "mjml"
  | "topol"
  | "stripo"
  | "chamaileon"
  | "easy-email-pro";

export const IMPORT_KIND_BY_ID: Record<ImportSceneId, ImportKind> = {
  "import-unlayer": "unlayer",
  "import-beefree": "beefree",
  "import-html": "html",
  "import-mjml": "mjml",
  "import-topol": "topol",
  "import-stripo": "stripo",
  "import-chamaileon": "chamaileon",
  "import-easy-email-pro": "easy-email-pro",
};

export function makeImportScene(spec: {
  id: ImportSceneId;
  title: string;
  job: string;
  summary: string;
  docs: string;
  pkg: string;
  convertFn: string;
  sourceExpr: string;
}): Scene {
  return {
    id: spec.id,
    title: spec.title,
    job: spec.job,
    summary: spec.summary,
    catalog: "oss",
    group: "import",
    docs: spec.docs,
    content: () => createDefaultTemplateContent(),
    config: () => ({}),
    snippet: `import { ${spec.convertFn} } from "${spec.pkg}";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const { content } = ${spec.convertFn}(${spec.sourceExpr});

const editor = await init({
  container: document.getElementById("editor"),
  content,
});`,
  };
}
