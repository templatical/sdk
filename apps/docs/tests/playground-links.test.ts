import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Docs ↔ playground: every play.templatical.com/scenes/<id> in OSS docs is a
 * registry id. Scene ids are read from quoted `id: "…"` fields under
 * apps/playground/src/scenes (kebab-case only, so snippet `id: "u_7"` is not
 * a scene). No runtime import of the playground package.
 */

const DOCS = join(import.meta.dirname, "..");
const REPO = join(DOCS, "../..");
const SCENES_DIR = join(REPO, "apps/playground/src/scenes");

const SKIP_DIRS = new Set([
  "cloud",
  "de/cloud",
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

const SCENE_ID = /\bid:\s*"([a-z0-9]+(?:-[a-z0-9]+)*)"/g;
const PLAY_SCENE =
  /https:\/\/play\.templatical\.com\/scenes\/([a-z0-9]+(?:-[a-z0-9]+)*)/g;

const AUTHOR_FEATURE_IDS = [
  "templates",
  "version-history",
  "comments",
  "saved-blocks",
  "media",
  "test-email",
  "render",
  "merge-tags",
  "display-conditions",
  "issues",
  "custom-blocks",
] as const;

const EXAMPLE_HASHES = [
  "launchpad-launch",
  "launchpad-reset",
  "flowwork-welcome",
  "flowwork-newsletter",
  "sable-order",
  "sable-friday",
  "northstage-event",
  "northstage-ar",
] as const;

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      walkFiles(abs, acc);
      continue;
    }
    acc.push(abs);
  }
  return acc;
}

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      const top = rel.split("/")[0];
      if (SKIP_DIRS.has(top) || SKIP_DIRS.has(rel)) continue;
      walkMarkdown(abs, acc);
      continue;
    }
    if (!rel.endsWith(".md")) continue;
    acc.push(rel);
  }
  return acc;
}

function sceneIds(): Set<string> {
  const ids = new Set<string>();
  for (const abs of walkFiles(SCENES_DIR)) {
    if (!abs.endsWith(".ts")) continue;
    const src = readFileSync(abs, "utf8");
    for (const m of src.matchAll(SCENE_ID)) ids.add(m[1]!);
  }
  return ids;
}

function playgroundIdsIn(src: string): string[] {
  return [...src.matchAll(PLAY_SCENE)].map((m) => m[1]!);
}

function readDocs(rel: string): string {
  return readFileSync(join(DOCS, rel), "utf8");
}

describe("docs playground links", () => {
  const ids = sceneIds();
  const pages = walkMarkdown(DOCS);

  it("discovers kebab-case scene ids from the playground registry sources", () => {
    expect(ids.has("minimum")).toBe(true);
    expect(ids.has("example-launchpad-launch")).toBe(true);
    expect(ids.has("import-unlayer")).toBe(true);
    expect(ids.has("u_7")).toBe(false);
    expect(ids.size).toBeGreaterThan(20);
  });

  it("points every play.templatical.com/scenes/<id> at a SCENES id", () => {
    const unknown: string[] = [];
    for (const rel of pages) {
      for (const id of playgroundIdsIn(readDocs(rel))) {
        if (!ids.has(id)) unknown.push(`${rel}: ${id}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("author-features Playground column matches the registry rows", () => {
    for (const rel of [
      "getting-started/author-features.md",
      "de/getting-started/author-features.md",
    ]) {
      expect(playgroundIdsIn(readDocs(rel)), rel).toEqual([
        ...AUTHOR_FEATURE_IDS,
      ]);
    }
  });

  it("Examples page has a playground link for every example-* scene", () => {
    const en = readDocs("guide/examples.md");
    const de = readDocs("de/guide/examples.md");
    const exampleIds = [...ids].filter((id) => id.startsWith("example-"));
    expect(exampleIds.length).toBeGreaterThan(0);
    for (const id of exampleIds) {
      expect(en).toContain(`https://play.templatical.com/scenes/${id}`);
      expect(de).toContain(`https://play.templatical.com/scenes/${id}`);
    }
  });

  it("Examples page uses the scene docs hashes", () => {
    for (const rel of ["guide/examples.md", "de/guide/examples.md"]) {
      const src = readDocs(rel);
      for (const hash of EXAMPLE_HASHES) {
        expect(src, `${rel} #${hash}`).toContain(`{#${hash}}`);
      }
    }
  });
});

describe("skill playground fetch", () => {
  const src = readFileSync(
    join(REPO, "skills/templatical/reference/docs.md"),
    "utf8",
  );

  it("fetches playground llms.txt then /scenes/<id>.md", () => {
    expect(src).toMatch(/https:\/\/play\.templatical\.com\/llms\.txt/);
    expect(src).toMatch(/\/scenes\/<id>\.md/);
    expect(src).toMatch(/three fetches|third fetch/i);
  });
});
