import { describe, expect, it } from "vitest";
import {
  SCENES,
  SCENE_GROUP_ORDER,
  getScene,
  parsePlaygroundRoute,
  scenesByGroup,
} from "../src/scenes/index";
import { sceneHref } from "../src/host/sceneHref";
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

const IMPORT_IDS = [
  "import-unlayer",
  "import-beefree",
  "import-html",
  "import-mjml",
  "import-topol",
  "import-stripo",
  "import-chamaileon",
  "import-easy-email-pro",
] as const;

const IMPORT_DOCS: Record<(typeof IMPORT_IDS)[number], string> = {
  "import-unlayer": "/guide/migration-from-unlayer",
  "import-beefree": "/guide/migration-from-beefree",
  "import-html": "/guide/migration-from-html",
  "import-mjml": "/guide/migration-from-mjml",
  "import-topol": "/guide/migration-from-topol",
  "import-stripo": "/guide/migration-from-stripo",
  "import-chamaileon": "/guide/migration-from-chamaileon",
  "import-easy-email-pro": "/guide/migration-from-easy-email-pro",
};

const IMPORT_CONVERT_FN: Record<(typeof IMPORT_IDS)[number], string> = {
  "import-unlayer": "convertUnlayerTemplate",
  "import-beefree": "convertBeeFreeTemplate",
  "import-html": "convertHtmlTemplate",
  "import-mjml": "convertMjmlTemplate",
  "import-topol": "convertTopolTemplate",
  "import-stripo": "convertStripoTemplate",
  "import-chamaileon": "convertChamaileonTemplate",
  "import-easy-email-pro": "convertEasyEmailProTemplate",
};

describe("registry", () => {
  it("registers minimum, storage, author, import scenes, then Launchpad launch", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "minimum",
      ...STORAGE_IDS,
      ...AUTHOR_IDS,
      ...IMPORT_IDS,
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
    for (const id of IMPORT_IDS) {
      expect(getScene(id)?.group).toBe("import");
      expect(getScene(id)?.docs).toBe(IMPORT_DOCS[id]);
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

  it("groups minimum first, then storage, author, import, examples", () => {
    const groups = [...scenesByGroup().keys()];
    expect(groups).toEqual([
      "minimum",
      "storage",
      "author",
      "import",
      "examples",
    ]);
  });

  it('i18n snippet contains locale: "de"', () => {
    expect(getScene("i18n")?.snippet).toMatch(/locale:\s*"de"/);
  });

  it("shadow-dom-off snippet contains shadowDom: false", () => {
    expect(getScene("shadow-dom-off")?.snippet).toMatch(/shadowDom:\s*false/);
  });

  it("does not advertise i18n English as a catalog variant", () => {
    expect(getScene("i18n")?.variants).toBeUndefined();
  });

  it("orders catalog groups with minimum first and examples last", () => {
    expect(SCENE_GROUP_ORDER[0]).toBe("minimum");
    expect(SCENE_GROUP_ORDER.at(-1)).toBe("examples");
  });
});

describe("sceneHref", () => {
  it("keeps the host shadowDom pin and drops other query keys", () => {
    expect(sceneHref("templates", "shadowDom=0&readonly=1")).toBe(
      "/scenes/templates?shadowDom=0",
    );
    expect(sceneHref("minimum")).toBe("/scenes/minimum");
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

  it.each(IMPORT_IDS)(
    "%s snippet is convertXTemplate + init({ content }), not a playground API",
    (id) => {
      const scene = getScene(id);
      if (!scene) throw new Error(`missing ${id}`);
      expect(scene.snippet).toContain(IMPORT_CONVERT_FN[id]);
      expect(scene.snippet).toContain("init(");
      expect(scene.snippet).toMatch(/content\s*[,}]/);
      expect(scene.snippet).not.toContain("setContent");
      expect(scene.snippet).not.toContain("tpl-playground");
      expect(scene.snippet).not.toContain("__tplPlayground");
    },
  );
});
