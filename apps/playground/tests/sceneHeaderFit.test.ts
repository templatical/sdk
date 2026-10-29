import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("scene header title containment", () => {
  it("lets the init key shrink within the title group before reaching Docs", () => {
    const host = readFileSync(
      join(import.meta.dirname, "../src/host/SceneHost.vue"),
      "utf8",
    );
    const key = readFileSync(
      join(import.meta.dirname, "../src/host/SceneInitKey.vue"),
      "utf8",
    );
    expect(host).toMatch(/pg-scene-heading[^\"]*overflow-hidden/);
    expect(key).toMatch(
      /data-testid="scene-init-key"[\s\S]*?class="min-w-0 truncate/,
    );
    expect(key).not.toContain('class="shrink-0 font-mono');
  });
});
