import { init, unmount as unmountEditor } from "@templatical/editor";
import type { TemplaticalEditor } from "@templatical/editor";
import type { Scene, SceneContext } from "../scenes/types";

export async function mountScene(
  scene: Scene,
  container: HTMLElement,
  ctx: SceneContext,
  shadowDom: boolean,
): Promise<TemplaticalEditor> {
  const editor = await init({
    container,
    shadowDom,
    content: scene.content(ctx),
    ...scene.config(ctx),
  });
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
