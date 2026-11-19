import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const FACT_EN = "Templatical is open source: every package is MIT-licensed.";
const FACT_DE = "Templatical ist Open Source: Alle Pakete stehen unter der MIT-Lizenz.";
const SITE_EN =
  "Embeddable drag-and-drop email editor SDK for your own app and backend. Open source, MIT-licensed.";
const SITE_DE =
  "Einbettbares Drag-and-Drop-E-Mail-Editor-SDK für Ihre eigene App und Ihr eigenes Backend. Open Source, MIT-lizenziert.";
const SUMMARY =
  "Embeddable drag-and-drop email editor SDK: JSON templates in, MJML out, your own backend behind every storage feature. Open source, MIT-licensed.";
const HOME_EN = "Open source (MIT), free to embed and self-host.";
const HOME_DE = "Open Source (MIT), kostenlos einbettbar und selbst hostbar.";
const LICENSE_EN =
  "Every Templatical package is MIT-licensed: use, modify and embed it commercially, keeping the copyright notice.";
const LICENSE_DE =
  "Jedes Templatical-Paket steht unter der MIT-Lizenz: Sie dürfen es nutzen, ändern und kommerziell einbetten, solange der Urheberrechtshinweis erhalten bleibt.";

describe("licence wording in user-facing copy", () => {
  it("states the MIT licence where answer engines read first", () => {
    expect(read("README.md")).toContain(FACT_EN);
    expect(read("apps/docs/index.md")).toContain("Open source, MIT-licensed.");
    expect(read("apps/docs/index.md")).toContain(HOME_EN);
    expect(read("apps/docs/de/index.md")).toContain("Open Source, MIT-lizenziert.");
    expect(read("apps/docs/de/index.md")).toContain(HOME_DE);
    expect(read("apps/docs/license-faq.md")).toContain(FACT_EN);
    expect(read("apps/docs/license-faq.md")).toContain(LICENSE_EN);
    expect(read("apps/docs/de/license-faq.md")).toContain(FACT_DE);
    expect(read("apps/docs/de/license-faq.md")).toContain(LICENSE_DE);
    expect(read("apps/docs/getting-started/hosted-builders.md")).toContain(FACT_EN);
    expect(read("apps/docs/getting-started/paths.md")).toContain(FACT_EN);
    expect(read("apps/docs/de/getting-started/hosted-builders.md")).toContain(FACT_DE);
    expect(read("apps/docs/de/getting-started/paths.md")).toContain(FACT_DE);
    expect(read("apps/docs/.vitepress/config.ts")).toContain(SITE_EN);
    expect(read("apps/docs/.vitepress/config.ts")).toContain(SITE_DE);
    expect(read("CONTRIBUTING.md")).toContain(FACT_EN);
    expect(read("context7.json")).toContain("Open source, MIT-licensed.");
  });

  it("states MIT in the agent summary", () => {
    const summary = read("apps/docs/public/llms.txt")
      .split("\n")
      .find((line) => line.startsWith("> "));
    expect(summary).toBe(`> ${SUMMARY}`);
    expect(summary).toContain("MIT");
    expect(read("apps/docs/scripts/build-agent-surface.mjs")).toContain(SUMMARY);
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

it("states the shipped BYO collaboration route and does not mention Templatical Cloud", () => {
  for (const path of ["README.md", "apps/docs/license-faq.md"]) {
    expect(read(path)).toContain(
      "Live collaboration runs over your own backend with `init({ collaboration })`.",
    );
    expect(read(path)).not.toMatch(/Templatical Cloud|initCloud/);
  }
  expect(read("apps/docs/de/license-faq.md")).toContain(
    "Live-Zusammenarbeit läuft über Ihr eigenes Backend mit `init({ collaboration })`.",
  );
  expect(read("apps/docs/de/license-faq.md")).not.toMatch(/Templatical Cloud|initCloud/);
});
