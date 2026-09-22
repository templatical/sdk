import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateContent } from "@templatical/types";

export type SceneGroup =
  "minimum" | "storage" | "author" | "render" | "import" | "examples";

export type SceneCatalog = "oss";

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
  /** Catalog thumbnail for Examples. HTTPS path under /examples/. */
  preview?: string;
  content: (ctx: SceneContext) => TemplateContent;
  config: (ctx: SceneContext) => Omit<TemplaticalEditorConfig, "container">;
  snippet: string;
  variants?: SceneVariant[];
}
