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

const STORAGE_IDS = [
  "templates",
  "version-history",
  "comments",
  "saved-blocks",
  "media",
  "test-email",
  "render",
] as const;

const AUTHOR_IDS = [
  "merge-tags",
  "merge-tags-on-request",
  "merge-tags-samples",
  "merge-tags-resolve-preview",
  "logic-tags",
  "display-conditions",
  "custom-blocks",
  "issues",
  "fonts",
  "defaults",
  "theming",
  "i18n",
  "shadow-dom-off",
] as const;

const AUTHOR_DOCS: Record<(typeof AUTHOR_IDS)[number], string> = {
  "merge-tags": "/guide/merge-tags",
  "merge-tags-on-request": "/guide/merge-tags",
  "merge-tags-samples": "/guide/preview-rendering",
  "merge-tags-resolve-preview": "/guide/preview-rendering",
  "logic-tags": "/guide/logic-tags",
  "display-conditions": "/guide/display-conditions",
  "custom-blocks": "/guide/custom-blocks",
  issues: "/quality/",
  fonts: "/guide/fonts",
  defaults: "/guide/defaults",
  theming: "/guide/theming",
  i18n: "/guide/i18n",
  "shadow-dom-off": "/guide/shadow-dom",
};

describe("registry", () => {
  it("registers minimum, storage, author scenes, then Launchpad launch", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "minimum",
      ...STORAGE_IDS,
      ...AUTHOR_IDS,
      "example-launchpad-launch",
    ]);
    expect(getScene("minimum")?.group).toBe("minimum");
    expect(getScene("minimum")?.docs).toBe("/getting-started/quick-start");
    expect(getScene("saved-blocks")?.docs).toBe("/backend/saved-blocks");
    expect(getScene("templates")?.docs).toBe("/backend/templates");
    expect(getScene("version-history")?.docs).toBe("/backend/version-history");
    expect(getScene("comments")?.docs).toBe("/backend/comments");
    expect(getScene("media")?.docs).toBe("/backend/media");
    expect(getScene("test-email")?.docs).toBe("/backend/test-email");
    expect(getScene("render")?.docs).toBe("/backend/render");
    for (const id of STORAGE_IDS) {
      expect(getScene(id)?.group).toBe("storage");
    }
    for (const id of AUTHOR_IDS) {
      expect(getScene(id)?.group).toBe("author");
      expect(getScene(id)?.docs).toBe(AUTHOR_DOCS[id]);
    }
    expect(SCENES.map((s) => s.id)).not.toContain("content-direction");
    expect(SCENES.map((s) => s.id)).not.toContain("colors");
    expect(SCENES.map((s) => s.id)).not.toContain("html-block-preview");
    expect(getScene("example-launchpad-launch")?.group).toBe("examples");
    expect(getScene("example-launchpad-launch")?.docs).toBe(
      "/guide/examples#launchpad-launch",
    );
    expect(getScene("nope")).toBeUndefined();
  });

  it("groups minimum first, then storage, then author", () => {
    const groups = [...scenesByGroup().keys()];
    expect(groups[0]).toBe("minimum");
    expect(groups[1]).toBe("storage");
    expect(groups[2]).toBe("author");
  });

  it('i18n snippet contains locale: "de"', () => {
    expect(getScene("i18n")?.snippet).toMatch(/locale:\s*"de"/);
  });

  it("shadow-dom-off snippet contains shadowDom: false", () => {
    expect(getScene("shadow-dom-off")?.snippet).toMatch(/shadowDom:\s*false/);
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
