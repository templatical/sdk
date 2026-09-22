import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateContent } from "@templatical/types";

export type SceneGroup =
  "minimum" | "storage" | "author" | "render" | "import" | "examples";

export type SceneCatalog = "oss";

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
  summary: string;
  catalog: SceneCatalog;
  group: SceneGroup;
  docs: string;
  /** Catalog wireframe for Examples. Same sketches as the old chooser. */
  preview?: SceneSketch;
  content: (ctx: SceneContext) => TemplateContent;
  config: (ctx: SceneContext) => Omit<TemplaticalEditorConfig, "container">;
  snippet: string;
  variants?: SceneVariant[];
}
