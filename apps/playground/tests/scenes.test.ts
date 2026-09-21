import { describe, expect, it } from "vitest";
import {
  SCENES,
  getScene,
  parsePlaygroundRoute,
  scenesByGroup,
} from "../src/scenes/index";
import { configKeys, snippetContainsKeys } from "../src/host/snippet-keys";

describe("parsePlaygroundRoute", () => {
  it("treats / as the catalog", () => {
    expect(parsePlaygroundRoute("/")).toEqual({ kind: "catalog" });
  });

  it("parses /scenes/:id and query", () => {
    const r = parsePlaygroundRoute(
      "/scenes/minimum",
      "?shadowDom=1&readonly=1",
    );
    expect(r).toEqual({
      kind: "scene",
      id: "minimum",
      search: expect.any(URLSearchParams),
    });
    if (r.kind !== "scene") throw new Error("expected scene");
    expect(r.search.get("shadowDom")).toBe("1");
    expect(r.search.get("readonly")).toBe("1");
  });

  it("does not treat /scenes/minimum.md as a scene route", () => {
    expect(parsePlaygroundRoute("/scenes/minimum.md").kind).toBe("unknown");
  });

  it("treats an unknown id as a scene route", () => {
    const r = parsePlaygroundRoute("/scenes/nope");
    expect(r).toEqual({
      kind: "scene",
      id: "nope",
      search: expect.any(URLSearchParams),
    });
  });
});

describe("registry", () => {
  it("registers minimum then Launchpad launch", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "minimum",
      "example-launchpad-launch",
    ]);
    expect(getScene("minimum")?.group).toBe("minimum");
    expect(getScene("minimum")?.docs).toBe("/getting-started/quick-start");
    expect(getScene("example-launchpad-launch")?.group).toBe("examples");
    expect(getScene("example-launchpad-launch")?.docs).toBe(
      "/guide/examples#launchpad-launch",
    );
    expect(getScene("nope")).toBeUndefined();
  });

  it("groups minimum first", () => {
    const groups = [...scenesByGroup().keys()];
    expect(groups[0]).toBe("minimum");
  });
});

describe("snippet honesty", () => {
  it.each(SCENES.map((s) => s.id))(
    "%s snippet names every config() key",
    (id) => {
      const scene = getScene(id);
      if (!scene) throw new Error(`missing ${id}`);
      const ctx = { search: new URLSearchParams() };
      const cfg = scene.config(ctx);
      const missing = snippetContainsKeys(scene.snippet, configKeys(cfg));
      expect(missing).toEqual([]);
      expect(scene.snippet).toContain("init(");
      expect(scene.snippet).toContain("container");
      expect(scene.snippet).not.toContain("tpl-playground");
      expect(scene.snippet).not.toContain("__tplPlayground");
    },
  );
});
