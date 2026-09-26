import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const css = readFileSync(join(ROOT, "src/style.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const sceneHost = readFileSync(join(ROOT, "src/host/SceneHost.vue"), "utf8");

/**
 * Anything that makes the editor stage a stacking context traps the editor's
 * popover root (z 10000) beneath the host header (z 100), so dialogs open
 * under the header. `modal-stacking.spec.ts` proves it in a browser; this
 * names the cause when a style is the culprit.
 */
describe("editor stage stacking", () => {
  it("names the stage for view transitions only under .pg-morphing", () => {
    const rules = [
      ...css.matchAll(/([^{}]+)\{[^}]*view-transition-name:\s*pg-scene-stage/g),
    ];
    expect(rules.map((m) => m[1]!.trim())).toEqual([
      ".pg-morphing .pg-scene-stage",
    ]);
  });

  it("puts no isolating utility on the stage element", () => {
    const stage = sceneHost.match(
      /data-testid="editor-stage"\s+class="([^"]+)"/,
    );
    expect(stage?.[1]).toContain("pg-scene-stage");
    expect(stage?.[1]).not.toMatch(
      /\bisolate\b|\btransform\b|\bfilter\b|\bopacity-/,
    );
  });
});
