import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs generator, no types
import { buildOutputs } from "../scripts/agent-surface-lib.mjs";
import { SCENES } from "../src/scenes/index";

const ROOT = join(import.meta.dirname, "..");

describe("playground agent surface", () => {
  it("committed llms.txt equals a fresh generation", () => {
    const { index } = buildOutputs(SCENES);
    expect(readFileSync(join(ROOT, "public/llms.txt"), "utf8")).toBe(index);
  });

  it("writes one markdown twin per scene", () => {
    const { pages } = buildOutputs(SCENES);
    expect(Object.keys(pages).sort()).toEqual(
      SCENES.map((s) => `scenes/${s.id}.md`).sort(),
    );
    for (const scene of SCENES) {
      const body = pages[`scenes/${scene.id}.md`];
      expect(body).toContain(scene.snippet);
      expect(body).toContain(`https://docs.templatical.com${scene.docs}`);
      expect(body).toContain(`https://play.templatical.com/scenes/${scene.id}`);
      expect(
        readFileSync(join(ROOT, "public", `scenes/${scene.id}.md`), "utf8"),
      ).toBe(body);
    }
  });
});
