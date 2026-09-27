import type { Scene, SceneGroup } from "@/scenes";

export const CATALOG_NAV_GROUPS: SceneGroup[] = [
  "configure",
  "personalization",
  "backend",
  "import",
  "examples",
];

export const RAIL_NAV_GROUPS: SceneGroup[] = ["minimum", ...CATALOG_NAV_GROUPS];

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The code a setup stands for: its init() key, or the whole call for
 * Minimum, which has no key of its own. The rail row and the scene header
 * both show it, so the two always agree.
 */
export function sceneInitCode(
  scene: Scene,
  minimumPaste: string,
): string | undefined {
  return scene.group === "minimum" ? minimumPaste : scene.initKey;
}

export interface TextPart {
  text: string;
  code: boolean;
}

/**
 * Splits `text` on backticks: every other part is inline code, so a string
 * can say `init()` and render it in the code face.
 */
export function codeSpans(text: string): TextPart[] {
  return text
    .split("`")
    .map((part, i) => ({ text: part, code: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}

/** `text` without its backticks, for a tooltip or an accessible name. */
export function plainText(text: string): string {
  return text.replaceAll("`", "");
}
