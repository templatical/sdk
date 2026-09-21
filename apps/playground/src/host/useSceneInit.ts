import { init, unmount as unmountEditor } from "@templatical/editor";
import type { TemplaticalEditor } from "@templatical/editor";
import { overlayTemplateSettings } from "./hostOverlays";
import { compileMjmlDemo } from "./providers";
import {
  fetchShare,
  SHARE_LOAD_FAILED,
  SHARE_NOT_FOUND,
  ShareError,
} from "./share";
import type { Scene, SceneContext } from "../scenes/types";

export async function mountScene(
  scene: Scene,
  container: HTMLElement,
  ctx: SceneContext,
  shadowDom: boolean,
): Promise<TemplaticalEditor> {
  const config = scene.config(ctx);
  const shareId = ctx.search.get("s");
  let content = scene.content(ctx);
  if (shareId) {
    try {
      content = (await fetchShare(shareId)).content;
    } catch (err) {
      if (err instanceof ShareError && err.code === "not-found") {
        throw new Error(SHARE_NOT_FOUND);
      }
      throw new Error(SHARE_LOAD_FAILED);
    }
  }
  const editor = await init({
    container,
    content,
    // Host overlay for Export HTML. Scenes may replace `render`; snippets
    // stay honest because this is not in `scene.config()`.
    render: { compileMjml: compileMjmlDemo },
    ...config,
    ...overlayTemplateSettings(ctx.search),
    // Host `?shadowDom=` wins over a scene's snippet value (`shadow-dom-off`).
    shadowDom,
  });
  if (typeof config.templates?.create === "function") {
    try {
      await editor.create({ name: scene.title });
    } catch {
      // Read-only store, or attach failed — the canvas still edits.
    }
  }
  const testHooks = window as {
    __tplPlaygroundGetMjml?: () => Promise<string>;
    __tplPlaygroundGetHtml?: () => Promise<string>;
  };
  testHooks.__tplPlaygroundGetMjml = () =>
    editor.toMjml?.() ?? Promise.resolve("");
  testHooks.__tplPlaygroundGetHtml = () =>
    editor.toHtml?.() ?? Promise.resolve("");
  return editor;
}

export async function useSceneInit(
  scene: Scene,
  container: HTMLElement,
  ctx: SceneContext,
  shadowDom: boolean,
): Promise<{
  editor: TemplaticalEditor | null;
  initError: string;
  unmount: typeof unmountEditor;
}> {
  try {
    const editor = await mountScene(scene, container, ctx, shadowDom);
    return { editor, initError: "", unmount: unmountEditor };
  } catch (err) {
    return {
      editor: null,
      initError: err instanceof Error ? err.message : String(err),
      unmount: unmountEditor,
    };
  }
}

export { unmountEditor };
