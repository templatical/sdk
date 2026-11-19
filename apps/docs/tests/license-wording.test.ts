import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const PLAIN_EN = "All Templatical packages are MIT-licensed.";
const PLAIN_DE = "Alle Templatical-Pakete stehen unter der MIT-Lizenz.";
const SHORT_EN = "MIT-licensed.";
const SHORT_DE = "MIT-lizenziert.";

describe("licence wording in user-facing copy", () => {
  it("states the MIT licence where answer engines read first", () => {
    expect(read("README.md")).toContain(PLAIN_EN);
    expect(read("apps/docs/index.md")).toContain(PLAIN_EN);
    expect(read("apps/docs/de/index.md")).toContain(PLAIN_DE);
    expect(read("apps/docs/license-faq.md")).toContain(PLAIN_EN);
    expect(read("apps/docs/de/license-faq.md")).toContain(PLAIN_DE);
    expect(read("apps/docs/getting-started/hosted-builders.md")).toContain(PLAIN_EN);
    expect(read("apps/docs/getting-started/paths.md")).toContain(PLAIN_EN);
    expect(read("apps/docs/de/getting-started/hosted-builders.md")).toContain(PLAIN_DE);
    expect(read("apps/docs/de/getting-started/paths.md")).toContain(PLAIN_DE);
    expect(read("apps/docs/.vitepress/config.ts")).toContain(SHORT_EN);
    expect(read("apps/docs/.vitepress/config.ts")).toContain(SHORT_DE);
    expect(read("CONTRIBUTING.md")).toContain(PLAIN_EN);
    expect(read("context7.json")).toContain(SHORT_EN);
  });

  it("states MIT in the agent summary", () => {
    const summary = read("apps/docs/public/llms.txt")
      .split("\n")
      .find((line) => line.startsWith("> "));
    expect(summary).toBe(`> ${SHORT_EN}`);
    expect(summary).toContain("MIT");
    expect(read("apps/docs/scripts/build-agent-surface.mjs")).toContain(
      `const SITE_SUMMARY = "${SHORT_EN}";`,
    );
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
