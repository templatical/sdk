import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Docs ↔ playground: every play.templatical.com/scenes/<id> in OSS docs is a
 * registry id, and every scene is linked from the place its own Docs button
 * opens. Scene ids are read from quoted `id: "…"` fields under
 * apps/playground/src/scenes (kebab-case only, so snippet `id: "u_7"` is not
 * a scene), each paired with the `docs: "…"` that follows it. No runtime
 * import of the playground package.
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
const FIELD = /\b(id|docs):\s*"([^"]+)"/g;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

/** Scene id → its docs target (`/guide/fonts#restricting-the-built-in-fonts`). */
function sceneDocs(): Map<string, string> {
  const docs = new Map<string, string>();
  for (const abs of walkFiles(SCENES_DIR)) {
    if (!abs.endsWith(".ts")) continue;
    let id: string | undefined;
    for (const m of readFileSync(abs, "utf8").matchAll(FIELD)) {
      if (m[1] === "id") {
        id = KEBAB.test(m[2]!) ? m[2] : undefined;
      } else if (id) {
        docs.set(id, m[2]!);
        id = undefined;
      }
    }
  }
  return docs;
}

interface Heading {
  line: number;
  level: number;
  text: string;
  id?: string;
}

/** Headings outside fenced code, with any explicit `{#id}`. */
function headingsOf(src: string): Heading[] {
  const found: Heading[] = [];
  let fenced = false;
  src.split("\n").forEach((raw, line) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      fenced = !fenced;
      return;
    }
    const m = fenced ? null : /^(#{1,6})\s+(.*?)\s*$/.exec(raw);
    if (!m) return;
    const id = /\{#([\w-]+)\}$/.exec(m[2]!)?.[1];
    found.push({
      line,
      level: m[1]!.length,
      text: m[2]!.replace(/\s*\{#[\w-]+\}$/, ""),
      id,
    });
  });
  return found;
}

/** Lines a heading's section covers, up to the next heading at its level. */
function sectionLines(src: string, heading: Heading): [number, number] {
  const next = headingsOf(src).find(
    (other) => other.line > heading.line && other.level <= heading.level,
  );
  return [heading.line, next ? next.line : src.split("\n").length];
}

/** Lines holding a link to this scene (and not to one whose id extends it). */
function linkLines(src: string, id: string): number[] {
  const link = new RegExp(`play\\.templatical\\.com/scenes/${id}(?![a-z0-9-])`);
  return src.split("\n").flatMap((raw, line) => (link.test(raw) ? [line] : []));
}

function pageFor(docs: string, locale: "en" | "de"): string {
  const path = docs.split("#")[0]!.replace(/^\//, "");
  const rel = path.endsWith("/") ? `${path}index.md` : `${path}.md`;
  return locale === "de" ? `de/${rel}` : rel;
}

/** The closing section for a scene that covers its whole page. */
const PLAYGROUND_SECTION = { en: "In the playground", de: "Im Playground" };
/** Closing link lists, which "In the playground" sits above. */
const LINK_LISTS = {
  en: ["See also", "Reference"],
  de: ["Siehe auch", "Referenz"],
};

/** Sections that link a scene besides the one its Docs button opens. */
const EXTRA_LINKS = [
  ["guide/merge-tags.md", "sample-values", "merge-tags-samples"],
  ["guide/merge-tags.md", "logic-tag-highlighting", "logic-tags"],
] as const;

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

  it("pairs every scene with its docs target", () => {
    const docs = sceneDocs();
    expect(docs.get("minimum")).toBe(
      "/getting-started/quick-start#mount-the-editor",
    );
    expect(docs.get("templates")).toBe("/backend/templates");
    expect(docs.get("import-mjml")).toBe("/guide/migration-from-mjml#usage");
    expect(docs.get("example-sable-order")).toBe("/guide/examples#sable-order");
    for (const id of ids) {
      if (id.startsWith("example-") || id.startsWith("import-")) {
        expect(docs.has(id), id).toBe(true);
      }
    }
  });

  it("links every scene from the section its Docs button opens", () => {
    // A scene that shows one section deep-links to it; one that covers the
    // whole page is linked from the page's closing "In the playground".
    const misplaced: string[] = [];
    for (const [id, docs] of sceneDocs()) {
      const anchor = docs.split("#")[1];
      for (const locale of ["en", "de"] as const) {
        const rel = pageFor(docs, locale);
        const src = readDocs(rel);
        const heads = headingsOf(src);
        const home = anchor
          ? heads.find((h) => h.id === anchor)
          : heads.find(
              (h) => h.level === 2 && h.text === PLAYGROUND_SECTION[locale],
            );
        if (!home) {
          misplaced.push(
            `${rel}: no ${anchor ? `{#${anchor}}` : PLAYGROUND_SECTION[locale]} for ${id}`,
          );
          continue;
        }
        const [start, end] = sectionLines(src, home);
        if (!linkLines(src, id).some((line) => line > start && line < end)) {
          misplaced.push(`${rel}: ${id} is not linked under "${home.text}"`);
        }
        const seeAlso = heads.find(
          (h) => h.level === 2 && LINK_LISTS[locale].includes(h.text),
        );
        if (!anchor && seeAlso && seeAlso.line < home.line) {
          misplaced.push(
            `${rel}: "${home.text}" comes after "${seeAlso.text}"`,
          );
        }
      }
    }
    expect(misplaced).toEqual([]);
  });

  it("links other sections that show a scene, in both languages", () => {
    const missing: string[] = [];
    for (const [page, anchor, id] of EXTRA_LINKS) {
      for (const rel of [page, `de/${page}`]) {
        const src = readDocs(rel);
        const home = headingsOf(src).find((h) => h.id === anchor);
        const [start, end] = home ? sectionLines(src, home) : [0, 0];
        if (!linkLines(src, id).some((line) => line > start && line < end)) {
          missing.push(`${rel}#${anchor}: ${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("never links a scene above a page's first section", () => {
    // The title's own line is where these links used to sit, all of them.
    const early: string[] = [];
    for (const rel of pages) {
      const src = readDocs(rel);
      const first = headingsOf(src).find((h) => h.level === 2);
      const cutoff = first ? first.line : Infinity;
      for (const id of playgroundIdsIn(src)) {
        if (linkLines(src, id).some((line) => line < cutoff)) {
          early.push(`${rel}: ${id}`);
        }
      }
    }
    expect([...new Set(early)]).toEqual([]);
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
