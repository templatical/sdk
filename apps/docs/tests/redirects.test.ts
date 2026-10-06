import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS = join(import.meta.dirname, "..");

type Rule = { from: string; to: string; status: string };

function rules(): Rule[] {
  return readFileSync(join(DOCS, "public/_redirects"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [from, to, status, ...rest] = line.split(/\s+/);
      expect(rest, line).toEqual([]);
      return { from, to, status };
    });
}

/** The markdown source a clean URL is served from, or null when nothing serves it. */
function sourceOf(url: string): string | null {
  const path = url.replace(/^\//, "");
  const candidates =
    path === "" || path.endsWith("/")
      ? [`${path}index.md`]
      : [`${path}.md`, `${path}/index.md`];
  return candidates.find((candidate) => existsSync(join(DOCS, candidate))) ?? null;
}

/**
 * Pages that moved or were removed keep answering: old links in issues,
 * search results and AI answers reach the current page instead of a 404.
 */
describe("retired docs routes", () => {
  const list = rules();

  it("redirects the routes retired so far", () => {
    expect(list.map((rule) => rule.from)).toEqual(
      expect.arrayContaining([
        "/guide/test-email",
        "/guide/saved-blocks",
        "/quality/rule-catalog",
        "/de/guide/test-email",
      ]),
    );
  });

  it("uses permanent redirects only", () => {
    expect(list.filter((rule) => rule.status !== "301")).toEqual([]);
  });

  it("never shadows a live page", () => {
    expect(list.filter((rule) => sourceOf(rule.from) !== null).map((r) => r.from)).toEqual([]);
  });

  it("always lands on a live page", () => {
    expect(list.filter((rule) => sourceOf(rule.to) === null).map((r) => r.to)).toEqual([]);
  });

  // The old page held the Install and "Wire into the editor" steps, which now
  // sit on the quality overview. Sending readers to the accessibility index
  // would strand them one click away from the content they followed the link for.
  it("sends the retired accessibility getting-started page to the overview that holds its steps", () => {
    const target = (from: string) =>
      list.find((rule) => rule.from === from)?.to;
    expect(target("/quality/accessibility/getting-started")).toBe("/quality/");
    expect(target("/de/quality/accessibility/getting-started")).toBe(
      "/de/quality/",
    );

    const overview = (page: string) => readFileSync(join(DOCS, page), "utf8");
    expect(overview("quality/index.md")).toMatch(/^## Install$/m);
    expect(overview("quality/index.md")).toContain("{#wire-into-the-editor}");
    expect(overview("de/quality/index.md")).toMatch(/^## Installation$/m);
    expect(overview("de/quality/index.md")).toContain(
      "{#wire-into-the-editor}",
    );
  });

  it("mirrors every English rule for German", () => {
    const german = new Set(
      list.filter((rule) => rule.from.startsWith("/de/")).map((r) => `${r.from} ${r.to}`),
    );
    expect(
      list
        .filter((rule) => !rule.from.startsWith("/de/"))
        .filter((rule) => !german.has(`/de${rule.from} /de${rule.to}`))
        .map((rule) => rule.from),
    ).toEqual([]);
  });
});
