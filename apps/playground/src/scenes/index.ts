import { minimum } from "./minimum";
import type { Scene, SceneGroup } from "./types";

export type {
  Scene,
  SceneCatalog,
  SceneContext,
  SceneGroup,
  SceneVariant,
} from "./types";

export const SCENES: readonly Scene[] = [minimum];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((scene) => scene.id === id);
}

export function scenesByGroup(): Map<SceneGroup, Scene[]> {
  const groups = new Map<SceneGroup, Scene[]>();
  for (const scene of SCENES) {
    const list = groups.get(scene.group);
    if (list) {
      list.push(scene);
    } else {
      groups.set(scene.group, [scene]);
    }
  }
  return groups;
}

export type PlaygroundRoute =
  | { kind: "catalog" }
  | { kind: "scene"; id: string; search: URLSearchParams }
  | { kind: "unknown"; pathname: string };

export function parsePlaygroundRoute(
  pathname: string,
  search?: string,
): PlaygroundRoute {
  if (pathname === "/" || pathname === "") {
    return { kind: "catalog" };
  }

  const match = /^\/scenes\/([^/]+)$/.exec(pathname);
  const id = match?.[1];
  if (id && !id.includes(".")) {
    return {
      kind: "scene",
      id,
      search: new URLSearchParams(search ?? ""),
    };
  }

  return { kind: "unknown", pathname };
}
