import type { SceneGroup } from "@/scenes";

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
