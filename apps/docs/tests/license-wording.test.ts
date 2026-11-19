import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");
const DOCS = join(REPO, "apps/docs");
const SKILL = join(REPO, "skills/templatical");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const SKIP_DIRS = new Set(["public", "node_modules", ".vitepress", "tests", "scripts"]);
const SKIP_FILES = new Set(["changelog.md", "de/changelog.md"]);

function docsPages(dir = DOCS, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      if (!SKIP_DIRS.has(name)) docsPages(abs, acc);
    } else if (rel.endsWith(".md") && !SKIP_FILES.has(rel)) {
      acc.push(`apps/docs/${rel}`);
    }
  }
  return acc;
}

function skillPages(dir = SKILL, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      if (name !== "node_modules") skillPages(abs, acc);
    } else if (name.endsWith(".md")) {
      acc.push(relative(REPO, abs).split(sep).join("/"));
    }
  }
  return acc;
}

/**
 * Every package is MIT. "source-available", "source available" and
 * "Functional Source" are banned on every line. FSL is banned unless every
 * occurrence sits inside one exact allowed sentence: the canonical licence
 * sentence (either language) or the licence page's history sentence. Matching
 * is the whole sentence, so a line that only contains 0.61.x and FSL-1.1-MIT
 * still fails. `\b` keeps proofsLabel from matching FSL.
 * .coderabbit.yaml may name the banned term on its policy line.
 * Changelogs are outside this scan: docs changelog is skipped below, and
 * package changelogs are not in COPY.
 */
const STALE_LICENCE = /source-available|source available|Functional Source/i;
const FSL_TOKEN = /\bFSL\b/i;
const CANONICAL_EN =
  "All Templatical packages are MIT-licensed (earlier releases up to 0.61.x were FSL-1.1-MIT).";
const CANONICAL_DE =
  "Alle Templatical-Pakete sind MIT-lizenziert (frühere Veröffentlichungen bis 0.61.x standen unter FSL-1.1-MIT).";
const HISTORY_EN =
  "Releases up to 0.61.x of `@templatical/editor`, `@templatical/core` and `@templatical/media-library` were published under FSL-1.1-MIT.";
const HISTORY_DE =
  "Veröffentlichungen bis 0.61.x von `@templatical/editor`, `@templatical/core` und `@templatical/media-library` erschienen unter FSL-1.1-MIT.";
const ALLOWED_SENTENCES = [CANONICAL_EN, CANONICAL_DE, HISTORY_EN, HISTORY_DE];
const CODERABBIT_POLICY = ".coderabbit.yaml";
const CODERABBIT_POLICY_LINE = 'All packages are MIT. "source-available" must not appear.';

/** A line an answer engine must not keep. FSL survives only inside an allowed sentence. */
function staleLicenceLine(line: string): boolean {
  if (STALE_LICENCE.test(line)) return true;
  if (!FSL_TOKEN.test(line)) return false;
  let rest = line;
  for (const sentence of ALLOWED_SENTENCES) {
    rest = rest.split(sentence).join("");
  }
  return FSL_TOKEN.test(rest);
}

function isCoderabbitPolicyLine(path: string, line: string): boolean {
  return path === CODERABBIT_POLICY && line.includes(CODERABBIT_POLICY_LINE);
}

const COPY = [
  ...docsPages(),
  "README.md",
  "CONTRIBUTING.md",
  ...readdirSync(join(REPO, "packages"))
    .map((dir) => `packages/${dir}/README.md`)
    .filter((path) => existsSync(join(REPO, path))),
  "examples/README.md",
  ...readdirSync(join(REPO, "examples"))
    .map((dir) => `examples/${dir}/README.md`)
    .filter((path) => existsSync(join(REPO, path))),
  ...skillPages(),
  "apps/playground/src/i18n/en.ts",
  "apps/playground/src/i18n/de.ts",
  "context7.json",
  ".github/SUPPORT.md",
  ".coderabbit.yaml",
  "apps/docs/public/robots.txt",
  "apps/docs/public/llms.txt",
  "apps/docs/scripts/build-agent-surface.mjs",
];

describe("licence wording in user-facing copy", () => {
  it("scans the docs, READMEs, contributing guide, skill and playground strings", () => {
    expect(COPY.length).toBeGreaterThan(100);
    expect(COPY).toContain("CONTRIBUTING.md");
    expect(COPY).toContain("packages/ai-kit/README.md");
    expect(COPY).toContain("skills/templatical/SKILL.md");
    expect(COPY).toContain("skills/templatical/reference/failure-modes.md");
    expect(COPY).toContain("examples/README.md");
    expect(COPY).toContain("examples/nextjs/README.md");
    expect(COPY).toContain("context7.json");
    expect(COPY).toContain(".github/SUPPORT.md");
    expect(COPY).toContain(".coderabbit.yaml");
    expect(COPY).toContain("apps/docs/public/robots.txt");
    expect(COPY).toContain("apps/docs/public/llms.txt");
    expect(COPY).toContain("apps/docs/scripts/build-agent-surface.mjs");
    expect(COPY.filter((path) => path.includes("node_modules"))).toEqual([]);
  });

  it("does not call the project source-available or FSL, except the 0.61.x history sentence", () => {
    const hits = COPY.flatMap((path) =>
      read(path)
        .split("\n")
        .flatMap((line, i) =>
          !isCoderabbitPolicyLine(path, line) && staleLicenceLine(line)
            ? [`${path}:${i + 1}: ${line.trim().slice(0, 160)}`]
            : [],
        ),
    );
    expect(hits).toEqual([]);
  });

  it("states the MIT licence where answer engines read first", () => {
    expect(read("README.md")).toContain(CANONICAL_EN);
    expect(read("apps/docs/index.md")).toContain(CANONICAL_EN);
    expect(read("apps/docs/de/index.md")).toContain(CANONICAL_DE);
    expect(read("apps/docs/license-faq.md")).toContain(CANONICAL_EN);
    expect(read("apps/docs/de/license-faq.md")).toContain(CANONICAL_DE);
    expect(read("apps/docs/getting-started/hosted-builders.md")).toContain(CANONICAL_EN);
    expect(read("apps/docs/getting-started/paths.md")).toContain(CANONICAL_EN);
    expect(read("apps/docs/de/getting-started/hosted-builders.md")).toContain(CANONICAL_DE);
    expect(read("apps/docs/de/getting-started/paths.md")).toContain(CANONICAL_DE);
  });

  it("states MIT in the agent summary", () => {
    const summary = read("apps/docs/public/llms.txt")
      .split("\n")
      .find((line) => line.startsWith("> "));
    expect(summary).toBe(`> ${CANONICAL_EN}`);
    expect(read("apps/docs/scripts/build-agent-surface.mjs")).toContain(
      `const SITE_SUMMARY =\n  "${CANONICAL_EN}";`,
    );
  });
});

describe("the stale-licence predicate", () => {
  it.each([
    "The editor is source-available.",
    "a source available SDK",
    "Functional Source License, Version 1.1",
    "licensed under FSL-1.1-MIT",
    "only the editor is FSL",
    "The editor is currently FSL-1.1-MIT; releases up to 0.61.x were FSL-1.1-MIT.",
    "Releases up to 0.61.x were published under FSL-1.1-MIT and each converts to MIT two years after its release.",
  ])("flags %j", (line) => {
    expect(staleLicenceLine(line)).toBe(true);
  });

  it.each([
    CANONICAL_EN,
    CANONICAL_DE,
    HISTORY_EN,
    HISTORY_DE,
    `${CANONICAL_EN} Terms: [MIT](./LICENSE).`,
    "Templatical is open source.",
    "ein quelloffener Agent Skill",
    "proofsLabel",
    "The OSS renderer emits a placeholder.",
  ])("passes %j", (line) => {
    expect(staleLicenceLine(line)).toBe(false);
  });
});

describe("the licence FAQ", () => {
  const published = readdirSync(join(REPO, "packages"))
    .map((dir) => join(REPO, "packages", dir, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")))
    .filter((pkg) => !pkg.private)
    .map((pkg) => ({ name: pkg.name as string, license: pkg.license as string }));

  it.each(["apps/docs/license-faq.md", "apps/docs/de/license-faq.md"])(
    "%s lists every published package with its licence",
    (page) => {
      const rows = new Map(
        [...read(page).matchAll(/^\| `(@templatical\/[a-z-]+)` \| \[([A-Z0-9.-]+)\]/gm)].map(
          ([, name, license]) => [name, license],
        ),
      );
      expect(published.length).toBeGreaterThan(10);
      for (const { name, license } of published) expect(rows.get(name), name).toBe(license);
      expect(rows.size).toBe(published.length);
    },
  );

  it.each([
    ["apps/docs/license-faq.md", "## Open source"],
    ["apps/docs/de/license-faq.md", "## Open Source"],
  ])("%s names open source as a topic", (page, heading) => {
    expect(read(page)).toContain(heading);
  });
});

it("states the shipped BYO collaboration route and excludes hosted Cloud collaboration", () => {
  for (const path of ["README.md", "apps/docs/license-faq.md"]) {
    expect(read(path)).toContain("Live collaboration runs over your own backend with `init({ collaboration })`.");
    expect(read(path)).toContain("Templatical Cloud's hosted collaboration isn't in this SDK release.");
  }
  expect(read("apps/docs/de/license-faq.md")).toContain("Live-Zusammenarbeit läuft über Ihr eigenes Backend mit `init({ collaboration })`.");
  expect(read("apps/docs/de/license-faq.md")).toContain("Die gehostete Zusammenarbeit von Templatical Cloud ist in dieser SDK-Version nicht enthalten.");
});
