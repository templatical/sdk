import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCENES,
  SCENE_GROUP_ORDER,
  getScene,
  parsePlaygroundRoute,
  sceneNeighbours,
  scenesByGroup,
} from "../src/scenes/index";
import { RAIL_NAV_GROUPS } from "../src/host/catalogNav";
import { SCENE_ICONS } from "../src/host/catalogIcons";
import { sceneHref } from "../src/host/sceneHref";
import { configKeys, snippetContainsKeys } from "../src/host/snippet-keys";

const DOCS_ROOT = join(import.meta.dirname, "../../docs");

function docsFileFor(docs: string): string {
  const path = (docs.split("#")[0] ?? docs).replace(/^\//, "");
  if (path === "" || path.endsWith("/")) {
    return join(DOCS_ROOT, path, "index.md");
  }
  return join(DOCS_ROOT, `${path}.md`);
}

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

const CONFIGURE_IDS = [
  "fonts",
  "defaults",
  "theming",
  "layout",
  "i18n",
  "shadow-dom-off",
  "issues",
  "custom-blocks",
] as const;

const PERSONALIZATION_IDS = [
  "merge-tags",
  "merge-tags-on-request",
  "merge-tags-samples",
  "merge-tags-resolve-preview",
  "logic-tags",
  "display-conditions",
] as const;

const BACKEND_IDS = [
  "templates",
  "version-history",
  "comments",
  "saved-blocks",
  "media",
  "test-email",
  "render",
] as const;

const AUTHOR_IDS = [...PERSONALIZATION_IDS, ...CONFIGURE_IDS] as const;

const AUTHOR_DOCS: Record<(typeof AUTHOR_IDS)[number], string> = {
  "merge-tags": "/guide/merge-tags#configuration",
  "merge-tags-on-request": "/guide/merge-tags#dynamic-tag-loading",
  "merge-tags-samples": "/guide/preview-rendering#sample-values",
  "merge-tags-resolve-preview":
    "/guide/preview-rendering#resolved-data-with-resolvepreview",
  "logic-tags": "/guide/logic-tags",
  "display-conditions": "/guide/display-conditions",
  "custom-blocks": "/guide/custom-blocks",
  issues: "/quality/#wire-into-the-editor",
  fonts: "/guide/fonts#restricting-the-built-in-fonts",
  defaults: "/guide/defaults#block-defaults",
  theming: "/guide/theming#themeoverrides-config",
  layout: "/guide/layout",
  i18n: "/guide/i18n#setting-the-locale",
  "shadow-dom-off": "/guide/shadow-dom#opt-out-shadowdom-false",
};

const IMPORT_IDS = [
  "import-unlayer",
  "import-beefree",
  "import-stripo",
  "import-topol",
  "import-chamaileon",
  "import-easy-email-pro",
  "import-mjml",
  "import-html",
] as const;

const IMPORT_DOCS: Record<(typeof IMPORT_IDS)[number], string> = {
  "import-unlayer": "/guide/migration-from-unlayer#usage",
  "import-beefree": "/guide/migration-from-beefree#usage",
  "import-html": "/guide/migration-from-html#usage",
  "import-mjml": "/guide/migration-from-mjml#usage",
  "import-topol": "/guide/migration-from-topol#usage",
  "import-stripo": "/guide/migration-from-stripo#usage",
  "import-chamaileon": "/guide/migration-from-chamaileon#usage",
  "import-easy-email-pro": "/guide/migration-from-easy-email-pro#usage",
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
  it("registers minimum, then configure, personalization, backend, import, examples", () => {
    expect(SCENES.map((s) => s.id)).toEqual([
      "minimum",
      ...CONFIGURE_IDS,
      ...PERSONALIZATION_IDS,
      ...BACKEND_IDS,
      ...IMPORT_IDS,
      "example-launchpad-launch",
      "example-launchpad-reset",
      "example-flowwork-welcome",
      "example-flowwork-newsletter",
      "example-sable-order",
      "example-sable-friday",
      "example-northstage-event",
      "example-northstage-ar",
    ]);
    expect(getScene("minimum")?.group).toBe("minimum");
    expect(getScene("minimum")?.docs).toBe(
      "/getting-started/quick-start#mount-the-editor",
    );
    expect(getScene("saved-blocks")?.docs).toBe("/backend/saved-blocks");
    expect(getScene("templates")?.docs).toBe("/backend/templates");
    expect(getScene("version-history")?.docs).toBe("/backend/version-history");
    expect(getScene("comments")?.docs).toBe("/backend/comments");
    expect(getScene("media")?.docs).toBe("/backend/media");
    expect(getScene("test-email")?.docs).toBe("/backend/test-email");
    expect(getScene("render")?.docs).toBe("/backend/render");
    for (const id of CONFIGURE_IDS) {
      expect(getScene(id)?.group).toBe("configure");
    }
    for (const id of PERSONALIZATION_IDS) {
      expect(getScene(id)?.group).toBe("personalization");
    }
    for (const id of BACKEND_IDS) {
      expect(getScene(id)?.group).toBe("backend");
    }
    for (const id of AUTHOR_IDS) {
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
    expect(getScene("example-launchpad-reset")?.docs).toBe(
      "/guide/examples#launchpad-reset",
    );
    expect(getScene("example-flowwork-welcome")?.docs).toBe(
      "/guide/examples#flowwork-welcome",
    );
    expect(getScene("example-flowwork-newsletter")?.docs).toBe(
      "/guide/examples#flowwork-newsletter",
    );
    expect(getScene("example-sable-order")?.docs).toBe(
      "/guide/examples#sable-order",
    );
    expect(getScene("example-sable-friday")?.docs).toBe(
      "/guide/examples#sable-friday",
    );
    expect(getScene("example-northstage-event")?.docs).toBe(
      "/guide/examples#northstage-event",
    );
    expect(getScene("example-northstage-ar")?.docs).toBe(
      "/guide/examples#northstage-ar",
    );
    expect(getScene("example-northstage-event")?.group).toBe("examples");
    expect(getScene("nope")).toBeUndefined();
  });

  it("groups minimum, configure, personalization, backend, import, examples", () => {
    const groups = [...scenesByGroup().keys()];
    expect(groups).toEqual([
      "minimum",
      "configure",
      "personalization",
      "backend",
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

  it.each(SCENES.map((s) => [s.id, s.docs] as const))(
    "%s docs path exists as a file under apps/docs",
    (_id, docs) => {
      expect(existsSync(docsFileFor(docs)), docs).toBe(true);
    },
  );
});

describe("sceneNeighbours", () => {
  it("walks the same order the rail lists scenes in", () => {
    const railOrder = RAIL_NAV_GROUPS.flatMap(
      (group) => scenesByGroup().get(group) ?? [],
    ).map((scene) => scene.id);
    expect(SCENES.map((scene) => scene.id)).toEqual(railOrder);
  });

  it("crosses from the last scene of one group to the first of the next", () => {
    const { previous, next } = sceneNeighbours("custom-blocks");
    expect(previous?.id).toBe("issues");
    expect(next?.id).toBe("merge-tags");
    expect(next?.group).toBe("personalization");
  });

  it("stops at both ends instead of wrapping", () => {
    expect(sceneNeighbours("minimum").previous).toBeUndefined();
    expect(sceneNeighbours("minimum").next?.id).toBe("fonts");
    const last = SCENES.at(-1)!;
    expect(sceneNeighbours(last.id).next).toBeUndefined();
    expect(sceneNeighbours(last.id).previous?.id).toBe(SCENES.at(-2)!.id);
  });

  it("has no neighbours for an unknown id", () => {
    expect(sceneNeighbours("nope")).toEqual({});
  });
});

describe("catalog copy", () => {
  it("every scene has a short job", () => {
    for (const scene of SCENES) {
      const words = scene.job.trim().split(/\s+/);
      expect(words.length, scene.id).toBeGreaterThanOrEqual(3);
      expect(words.length, scene.id).toBeLessThanOrEqual(8);
      expect(scene.job, scene.id).not.toMatch(/init\(/);
    }
  });

  it("every scene outside the examples has a rail icon", () => {
    const missing = SCENES.filter((s) => s.group !== "examples")
      .map((s) => s.id)
      .filter((id) => !(id in SCENE_ICONS));
    expect(missing).toEqual([]);
  });

  it("no rail icon points at a scene that does not exist", () => {
    const stale = Object.keys(SCENE_ICONS).filter((id) => !getScene(id));
    expect(stale).toEqual([]);
  });
});

describe("importer order", () => {
  it("follows the docs sidebar's migration guides", () => {
    const config = readFileSync(
      join(import.meta.dirname, "../../docs/.vitepress/config.ts"),
      "utf8",
    );
    const docsOrder = [
      ...new Set(
        [...config.matchAll(/"\/guide\/migration-from-([a-z-]+)"/g)].map(
          (match) => `import-${match[1]}`,
        ),
      ),
    ];
    const playgroundOrder = SCENES.filter((s) => s.group === "import").map(
      (s) => s.id,
    );
    expect(docsOrder).toHaveLength(8);
    expect(playgroundOrder).toEqual(docsOrder);
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

  it("Chamaileon snippet does not bind convert() to window.document", () => {
    const snippet = getScene("import-chamaileon")?.snippet ?? "";
    expect(snippet).toContain("chamaileonJson");
    expect(snippet).not.toMatch(/convertChamaileonTemplate\(\s*document\s*\)/);
  });

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
