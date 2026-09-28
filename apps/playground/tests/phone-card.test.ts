import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const sceneHost = readFileSync(join(ROOT, "src/host/SceneHost.vue"), "utf8");
const editorQuery = readFileSync(
  join(ROOT, "../../packages/editor/src/composables/useSmallScreenNotice.ts"),
  "utf8",
).match(/SMALL_SCREEN_QUERY = "([^"]+)"/)?.[1];

/**
 * The scene host swaps the editor for its setup card exactly where the editor
 * would cover itself with its small-screen notice. With two breakpoints a
 * visitor between them gets either that notice over a mounted editor, or a
 * card where the editor would have worked.
 */
describe("phone setup card breakpoint", () => {
  it("finds the editor's small-screen query", () => {
    expect(editorQuery).toMatch(/^\(max-width: \d+px\)$/);
  });

  it("switches to the card at the editor's breakpoint", () => {
    expect(sceneHost.match(/useMediaQuery\("[^"]*"\)/g)).toEqual([
      `useMediaQuery("${editorQuery}")`,
    ]);
  });
});
