import { describe, expect, it } from "vitest";
import { SCENES } from "../src/scenes/index";

const SETUP_GROUPS = new Set(["configure", "personalization", "backend"]);
const setups = SCENES.filter((scene) => SETUP_GROUPS.has(scene.group));

/** `mergeTags.tags[].sample` → ["mergeTags", "tags", "sample"]. */
function segments(key: string): string[] {
  return key
    .replace(/:\s*\S+$/, "")
    .split(".")
    .map((part) => part.replace("[]", ""));
}

describe("catalog init keys", () => {
  it("every setup row names its init() key", () => {
    expect(setups).toHaveLength(21);
    for (const scene of setups) {
      expect(scene.initKey, scene.id).toMatch(/^[a-zA-Z]/);
    }
  });

  it.each(setups.map((scene) => [scene.id, scene.initKey!] as const))(
    "%s snippet contains `%s`",
    (id, key) => {
      const snippet = SCENES.find((scene) => scene.id === id)!.snippet;
      for (const part of segments(key)) {
        expect(snippet, `${id}: ${part}`).toMatch(
          new RegExp(String.raw`(?:^|[\s,{])${part}\s*:`),
        );
      }
      const value = key.match(/:\s*(\S+)$/)?.[1];
      if (value) expect(snippet).toContain(key);
    },
  );

  it("labels a composed scene by its own feature, not the one it needs", () => {
    const byId = (id: string) => SCENES.find((scene) => scene.id === id)!;
    // Both snippets also configure `templates`; the row names the feature.
    expect(byId("version-history").initKey).toBe("versionHistory");
    expect(byId("comments").initKey).toBe("comments");
    expect(byId("merge-tags-on-request").initKey).toBe("mergeTags.onRequest");
  });

  it("leaves imports and examples without a key", () => {
    for (const scene of SCENES.filter((s) => !SETUP_GROUPS.has(s.group))) {
      expect(scene.initKey, scene.id).toBeUndefined();
    }
  });
});
