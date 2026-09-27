import type { TemplaticalEditorConfig } from "@templatical/editor";
import type { TemplateContent } from "@templatical/types";
import type { GeneralNoteId, SceneNoteSide } from "../host/sceneNotes";

export type SceneGroup =
  | "minimum"
  | "configure"
  | "personalization"
  | "backend"
  | "import"
  | "examples";

export type SceneCatalog = "oss";

export interface SceneContext {
  search: URLSearchParams;
}

export interface SceneVariant {
  name: string;
  query: Record<string, string>;
}

/** What a setup's own note points at: the control where its effect shows. */
export interface ScenePointer {
  /**
   * A test id, an id, a data attribute or an ARIA hook, never a `tpl-*`
   * class: the editor restyles those freely.
   */
  selector: string;
  /**
   * The editor's root (its shadow root, or its container in light DOM) or
   * the host page.
   */
  root: "editor" | "page";
  side: SceneNoteSide;
  /**
   * A general note aimed at the same control, left out on this scene so no
   * control gets two arrows.
   */
  replaces?: GeneralNoteId;
}

/**
 * Makes the header's init-key chip pick that key's value from a list. The
 * value lives in one query parameter, which the scene's `config`, `content`
 * and `snippetFor` read, so a choice survives a reload and can be shared.
 */
export interface SceneValuePicker {
  param: string;
  /** The value when the URL carries none; picking it drops the parameter. */
  fallback: string;
  /**
   * Where the offered values come from, read by the host at runtime: a scene
   * module cannot import the editor, which the unit tests cannot load.
   */
  values: "editor-locales";
}

export interface Scene {
  id: string;
  title: string;
  /** One clause for the catalog card and llms.txt. Four to eight words. */
  job: string;
  /**
   * The exact init() key path the setup exercises (`mergeTags.onRequest`,
   * `shadowDom: false`), shown on its catalog row. Every Configure,
   * Personalization and Your backend scene carries one, and its snippet must
   * contain it; tests/init-keys.test.ts holds both.
   */
  initKey?: string;
  summary: string;
  catalog: SceneCatalog;
  group: SceneGroup;
  /**
   * The docs the setup demonstrates. A setup that shows one section points
   * at `page#id`, and that section links back; one that covers the whole
   * page points at the page, and its closing "In the playground" section
   * links back. apps/docs/tests/playground-links.test.ts holds both ends.
   */
  docs: string;
  /**
   * The email the setup opens on. Absent leaves init() to build a blank
   * template, which is the only template `templateDefaults` ever seeds.
   */
  content?: (ctx: SceneContext) => TemplateContent;
  config: (ctx: SceneContext) => Omit<TemplaticalEditorConfig, "container">;
  /**
   * Where the setup's own note points; its text is `scenes.<id>.note` in the
   * playground strings. Absent when no one control shows the effect
   * (Minimum, i18n, Shadow DOM off).
   */
  pointer?: ScenePointer;
  valuePicker?: SceneValuePicker;
  /**
   * The canonical snippet, as the docs and agents read it. A scene with a
   * `valuePicker` also gives `snippetFor`, which the Code drawer shows, so
   * the snippet names the value on screen.
   */
  snippet: string;
  snippetFor?: (ctx: SceneContext) => string;
  variants?: SceneVariant[];
}
