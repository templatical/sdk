import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `context7.json` at the repo root tells Context7, the docs index many coding
 * agents query, what to index and which instructions to show beside it. It
 * indexes the English docs and the examples' READMEs (Context7 reads
 * documentation formats, not source files): the German mirror duplicates every
 * page, the Cloud pages describe a tier that is not live, and `public/` holds
 * the generated `llms-full.txt`, which repeats the whole corpus. Because the
 * examples' code never reaches the index, one rule points agents at the
 * framework pages' served markdown, which includes it.
 *
 * The field limits and semantics are Context7's own
 * (https://context7.com/docs/library-owners). Context7 validates the file
 * against its published schema (https://context7.com/schema/context7.json)
 * and ignores all of it when one field fails: a single rule over 255
 * characters is enough to index the Cloud pages and generated output this
 * config excludes. So the schema's limits are asserted below, not trusted.
 * The description follows the
 * licence rule: the editor is source-available (FSL-1.1-MIT), so it is never
 * called open source. The rule that says what to install makes claims about the
 * editor's manifest, so the manifest is read here rather than trusted: the
 * rule must name each optional peer the manifest declares.
 */

const REPO = join(import.meta.dirname, "../../..");

interface Context7Config {
  $schema: string;
  projectTitle: string;
  description: string;
  folders: string[];
  excludeFolders: string[];
  excludeFiles: string[];
  rules: string[];
  url?: string;
  public_key?: string;
}

/** The top-level keys Context7's schema allows (it sets additionalProperties: false). */
const SCHEMA_KEYS = [
  "$schema",
  "projectTitle",
  "description",
  "branch",
  "folders",
  "excludeFolders",
  "excludeFiles",
  "rules",
  "disallow",
  "redirect",
  "previousVersions",
  "url",
  "public_key",
];

function loadConfig(): Context7Config {
  return JSON.parse(readFileSync(join(REPO, "context7.json"), "utf8"));
}

/** Workspace packages by published name, with their `exports` map. */
function workspacePackages(): Map<
  string,
  { exports?: Record<string, unknown> }
> {
  const dir = join(REPO, "packages");
  const manifests = readdirSync(dir)
    .map((name) => join(dir, name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")));
  return new Map(manifests.map((pkg) => [pkg.name, pkg]));
}

/** The editor's optional peers, read from its manifest rather than listed here. */
function editorOptionalPeers(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(REPO, "packages/editor/package.json"), "utf8"),
  );
  return Object.entries<{ optional?: boolean }>(
    manifest.peerDependenciesMeta ?? {},
  )
    .filter(([, meta]) => meta.optional === true)
    .map(([name]) => name)
    .sort();
}

const EXCLUDED_FOLDERS = [
  "apps/docs/de",
  "apps/docs/cloud",
  "apps/docs/public",
  "apps/docs/tests",
  "apps/docs/scripts",
  "apps/docs/.vitepress",
];

// What an agent integrating the editor must be told: a topic, then the
// distinctive substrings that one rule must carry together.
const ESSENTIALS: Array<[string, ...string[]]> = [
  ["mount with init({ container })", "init({ container })"],
  ["import the stylesheet", "@templatical/editor/style.css"],
  ["size the container", "definite height"],
  ["unmount in cleanup", "unmount()"],
  ["treat templates as TemplateContent JSON", "TemplateContent"],
  [
    "render MJML with the renderer and compile it with mjml",
    "renderToMjml",
    "mjml",
  ],
  ["describe storage features as providers", "savedBlocks"],
  ["name initCloud as the hosted variant", "initCloud()"],
  ["point at the framework pages", "docs.templatical.com/frameworks/"],
];

describe("context7.json", () => {
  it("declares Context7's schema", () => {
    expect(loadConfig().$schema).toBe(
      "https://context7.com/schema/context7.json",
    );
  });

  it("titles the project Templatical, within the 100 character limit", () => {
    const { projectTitle } = loadConfig();
    expect(projectTitle).toBe("Templatical");
    expect(projectTitle.length).toBeLessThanOrEqual(100);
  });

  it("describes the project on one line of at most 200 characters", () => {
    const { description } = loadConfig();
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description).not.toContain("\n");
  });

  it("states the licence as Source-available (FSL-1.1-MIT) and still fits the 200 character limit", () => {
    const { description } = loadConfig();
    expect(description).toContain("Source-available (FSL-1.1-MIT)");
    expect(description.length).toBeLessThanOrEqual(200);
  });

  it("never calls the editor open source, quelloffen or OSS", () => {
    expect(loadConfig().description).not.toMatch(
      /open[- ]?source|quelloffen|\bOSS\b/i,
    );
  });

  it("indexes the English docs and the examples, and nothing else", () => {
    expect(loadConfig().folders).toEqual(["apps/docs", "examples"]);
  });

  it("excludes the German mirror, Cloud, generated output, tests, scripts and VitePress internals", () => {
    const { excludeFolders } = loadConfig();
    expect(excludeFolders).toEqual(expect.arrayContaining(EXCLUDED_FOLDERS));
    expect(excludeFolders).not.toContain("apps/docs");
  });

  it("lists only folders that exist, so a rename cannot leave a dead entry", () => {
    const { folders, excludeFolders } = loadConfig();
    const missing = [...folders, ...excludeFolders].filter(
      (folder) => !existsSync(join(REPO, folder)),
    );
    expect(missing).toEqual([]);
  });

  it("excludes the changelog by file name, which Context7 matches without a path", () => {
    const { excludeFiles } = loadConfig();
    expect(excludeFiles).toContain("changelog.md");
    expect(excludeFiles.filter((file) => file.includes("/"))).toEqual([]);
    expect(existsSync(join(REPO, "apps/docs/changelog.md"))).toBe(true);
  });

  it("gives coding agents between 5 and 8 non-empty rules", () => {
    const { rules } = loadConfig();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(5);
    expect(rules.length).toBeLessThanOrEqual(8);
    expect(
      rules.filter((rule) => typeof rule !== "string" || rule.trim() === ""),
    ).toEqual([]);
  });

  it.each(ESSENTIALS)("has a rule to %s", (_topic, ...needles) => {
    const { rules } = loadConfig();
    expect(
      rules.some((rule) => needles.every((needle) => rule.includes(needle))),
    ).toBe(true);
  });

  it("names every framework page in the rule that points at them", () => {
    const pointer = loadConfig().rules.filter((rule) =>
      rule.includes("docs.templatical.com/frameworks/"),
    );
    expect(pointer).toHaveLength(1);
    const pages = readdirSync(join(REPO, "apps/docs/frameworks"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -".md".length));
    // Read from disk, so an empty list would pass the check below for the
    // wrong reason.
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.filter((page) => !pointer[0].includes(`\`${page}\``))).toEqual(
      [],
    );
  });

  describe("the rule that says what to install", () => {
    // It is the one rule that names `@templatical/core`, which the editor
    // bundles, so a reader knows the app needs neither it nor Vue.
    const installRule = (): string => {
      const found = loadConfig().rules.filter((rule) =>
        rule.includes("@templatical/core"),
      );
      expect(found).toHaveLength(1);
      return found[0];
    };

    it("names each optional peer the editor's manifest declares", () => {
      const peers = editorOptionalPeers();
      // Derived from the manifest, so an empty list would pass the check below
      // for the wrong reason.
      expect(peers.length).toBeGreaterThan(0);
      expect(peers.filter((peer) => !installRule().includes(peer))).toEqual([]);
    });

    it("names no other @templatical package than the editor, core and those peers", () => {
      const allowed = new Set([
        "@templatical/editor",
        "@templatical/core",
        ...editorOptionalPeers(),
      ]);
      const named = new Set(installRule().match(/@templatical\/[a-z0-9-]+/g));
      expect([...named].filter((name) => !allowed.has(name))).toEqual([]);
    });
  });

  it("names only packages and subpaths the workspace publishes", () => {
    const packages = workspacePackages();
    const mentioned = [
      ...loadConfig()
        .rules.join("\n")
        .matchAll(/@templatical\/([a-z0-9-]+)(?:\/([\w.-]*[\w-]))?/g),
    ].map(([, name, subpath]) => ({ name: `@templatical/${name}`, subpath }));

    expect([...new Set(mentioned.map(({ name }) => name))].sort()).toEqual(
      expect.arrayContaining(["@templatical/editor", "@templatical/renderer"]),
    );
    const unknown = mentioned.flatMap(({ name, subpath }) => {
      const pkg = packages.get(name);
      if (!pkg) return [name];
      return subpath && !(`./${subpath}` in (pkg.exports ?? {}))
        ? [`${name}/${subpath}`]
        : [];
    });
    expect(unknown).toEqual([]);
  });
});

describe("context7.json against Context7's schema", () => {
  it("uses only keys the schema allows", () => {
    const config = loadConfig() as unknown as Record<string, unknown>;
    expect(
      Object.keys(config).filter((key) => !SCHEMA_KEYS.includes(key)),
    ).toEqual([]);
  });

  it("keeps every rule within 255 characters, and at most 50 rules", () => {
    const { rules } = loadConfig();
    expect(rules.filter((rule) => rule.length > 255)).toEqual([]);
    expect(rules.length).toBeLessThanOrEqual(50);
  });

  it("keeps the description between 10 and 200 characters and the title within 100", () => {
    const { description, projectTitle } = loadConfig();
    expect(description.length).toBeGreaterThanOrEqual(10);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(projectTitle.length).toBeGreaterThanOrEqual(1);
    expect(projectTitle.length).toBeLessThanOrEqual(100);
  });

  it("keeps each folder list within 50 entries of at most 255 characters", () => {
    const { folders, excludeFolders } = loadConfig();
    for (const list of [folders, excludeFolders]) {
      expect(list.length).toBeLessThanOrEqual(50);
      expect(
        list.filter((entry) => entry.length === 0 || entry.length > 255),
      ).toEqual([]);
    }
  });

  it("names excluded files without a path, at most 100 of them", () => {
    const { excludeFiles } = loadConfig();
    expect(excludeFiles.length).toBeLessThanOrEqual(100);
    expect(excludeFiles.filter((name) => !/^[^/\\]+$/.test(name))).toEqual([]);
  });

  it("claims the library with its Context7 URL and public key", () => {
    const { url, public_key } = loadConfig();
    expect(url).toBe("https://context7.com/templatical/sdk");
    expect(public_key).toMatch(/^pk_[A-Za-z0-9]+$/);
  });
});
