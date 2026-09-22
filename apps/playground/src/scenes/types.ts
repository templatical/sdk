import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateContent } from "@templatical/types";

export type SceneGroup =
  | "minimum"
  | "configure"
  | "personalization"
  | "backend"
  | "import"
  | "examples";

export type SceneCatalog = "oss";

export type SetupAffordance =
  | "save"
  | "history"
  | "comment"
  | "bookmark"
  | "media"
  | "send"
  | "export"
  | "tag"
  | "picker"
  | "sample"
  | "resolve"
  | "logic"
  | "condition"
  | "custom"
  | "lint"
  | "font"
  | "defaults"
  | "theme"
  | "locale"
  | "light-dom"
  | "import";

export type SceneSketch =
  | "product"
  | "newsletter"
  | "welcome"
  | "order"
  | "event"
  | "sale"
  | "reset"
  | "rtl";

export interface SceneContext {
  search: URLSearchParams;
}

export interface SceneVariant {
  name: string;
  query: Record<string, string>;
}

export interface Scene {
  id: string;
  title: string;
  /** One clause for the catalog card and llms.txt. Four to eight words. */
  job: string;
  summary: string;
  catalog: SceneCatalog;
  group: SceneGroup;
  docs: string;
  /** Catalog wireframe for Examples. Same sketches as the old chooser. */
  preview?: SceneSketch;
  /** Mini editor chrome for setup cards. */
  affordance?: SetupAffordance;
  content: (ctx: SceneContext) => TemplateContent;
  config: (ctx: SceneContext) => Omit<TemplaticalEditorConfig, "container">;
  snippet: string;
  variants?: SceneVariant[];
}
