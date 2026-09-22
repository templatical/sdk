import { customBlocks } from "./author/custom-blocks";
import { defaults } from "./author/defaults";
import { displayConditions } from "./author/display-conditions";
import { fonts } from "./author/fonts";
import { i18n } from "./author/i18n";
import { issues } from "./author/issues";
import { logicTags } from "./author/logic-tags";
import { mergeTags } from "./author/merge-tags";
import { mergeTagsOnRequest } from "./author/merge-tags-on-request";
import { mergeTagsResolvePreview } from "./author/merge-tags-resolve-preview";
import { mergeTagsSamples } from "./author/merge-tags-samples";
import { shadowDomOff } from "./author/shadow-dom-off";
import { theming } from "./author/theming";
import { exampleFlowworkNewsletter } from "./examples/flowwork-newsletter";
import { exampleFlowworkWelcome } from "./examples/flowwork-welcome";
import { exampleLaunchpadLaunch } from "./examples/launchpad-launch";
import { exampleLaunchpadReset } from "./examples/launchpad-reset";
import { exampleNorthstageAr } from "./examples/northstage-ar";
import { exampleNorthstageEvent } from "./examples/northstage-event";
import { exampleSableFriday } from "./examples/sable-friday";
import { exampleSableOrder } from "./examples/sable-order";
import { importBeefree } from "./import/import-beefree";
import { importChamaileon } from "./import/import-chamaileon";
import { importEasyEmailPro } from "./import/import-easy-email-pro";
import { importHtml } from "./import/import-html";
import { importMjml } from "./import/import-mjml";
import { importStripo } from "./import/import-stripo";
import { importTopol } from "./import/import-topol";
import { importUnlayer } from "./import/import-unlayer";
import { minimum } from "./minimum";
import { comments } from "./storage/comments";
import { media } from "./storage/media";
import { render } from "./storage/render";
import { savedBlocks } from "./storage/saved-blocks";
import { templates } from "./storage/templates";
import { testEmail } from "./storage/test-email";
import { versionHistory } from "./storage/version-history";
import type { Scene, SceneGroup } from "./types";

export type {
  SetupAffordance,
  SceneSketch,
  Scene,
  SceneCatalog,
  SceneContext,
  SceneGroup,
  SceneVariant,
} from "./types";

export const SCENES: readonly Scene[] = [
  minimum,
  fonts,
  defaults,
  theming,
  i18n,
  shadowDomOff,
  issues,
  customBlocks,
  mergeTags,
  mergeTagsOnRequest,
  mergeTagsSamples,
  mergeTagsResolvePreview,
  logicTags,
  displayConditions,
  templates,
  versionHistory,
  comments,
  savedBlocks,
  media,
  testEmail,
  render,
  importUnlayer,
  importBeefree,
  importHtml,
  importMjml,
  importTopol,
  importStripo,
  importChamaileon,
  importEasyEmailPro,
  exampleLaunchpadLaunch,
  exampleLaunchpadReset,
  exampleFlowworkWelcome,
  exampleFlowworkNewsletter,
  exampleSableOrder,
  exampleSableFriday,
  exampleNorthstageEvent,
  exampleNorthstageAr,
];

export const SCENE_GROUP_ORDER: readonly SceneGroup[] = [
  "minimum",
  "configure",
  "personalization",
  "backend",
  "import",
  "examples",
];

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
