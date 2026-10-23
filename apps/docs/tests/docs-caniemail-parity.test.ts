import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANIEMAIL_DATA_DATE } from "../../../packages/quality/src/compatibility/data/caniemail.generated";
import pinnedNotes from "../../../packages/quality/src/compatibility/pinned-notes.json";
import slugs from "../../../packages/quality/src/compatibility/slugs.json";

/**
 * The compatibility pages restate two facts from @templatical/quality's
 * vendored caniemail snapshot: the date it was taken, and which caniemail
 * notes each rule narrows its verdict with (`pinned-notes.json`). A
 * `sync:caniemail` refresh changes both in the package and neither on the
 * page, so this fails until the pages are updated too.
 */

const DOCS = join(import.meta.dirname, "..");

function readDocs(rel: string): string {
  return readFileSync(join(DOCS, rel), "utf8");
}

const pinned: Record<string, Record<string, string>> = pinnedNotes;

const locales = [
  {
    name: "English",
    dir: "quality/compatibility",
    indexDate:
      /The bundled \[caniemail snapshot\]\(https:\/\/www\.caniemail\.com\/\) was updated \*\*(\d{4}-\d{2}-\d{2})\*\*\./,
    catalogDate:
      /use the bundled caniemail snapshot dated (\d{4}-\d{2}-\d{2})\./,
    narrowingLabel: "**Narrowing:**",
    noNarrowing: "No note narrowing.",
    noteNumbers: /\b[Nn]otes? (\d+)(?:[–-](\d+))?/g,
  },
  {
    name: "German",
    dir: "de/quality/compatibility",
    indexDate:
      /Der gebündelte caniemail-Datenstand ist vom \*\*(\d{4}-\d{2}-\d{2})\*\*\./,
    catalogDate: /nutzen den caniemail-Datenstand vom (\d{4}-\d{2}-\d{2})\./,
    narrowingLabel: "**Einschränkung:**",
    noNarrowing: "Keine Einschränkung durch Anmerkungen.",
    noteNumbers: /\bAnmerkung(?:en)? (\d+)(?:[–-](\d+))?/g,
  },
];

/** The text after each rule heading's narrowing label, keyed by rule slug. */
function narrowingLines(catalog: string, label: string): Map<string, string[]> {
  const lines = new Map<string, string[]>();
  for (const section of catalog.split(/^## /m).slice(1)) {
    const slug = /^`compat\.([a-z0-9-]+)`/.exec(section)?.[1];
    if (!slug) continue;
    lines.set(
      slug,
      section
        .split("\n")
        .filter((line) => line.startsWith(label))
        .map((line) => line.slice(label.length).trim()),
    );
  }
  return lines;
}

function citedNotes(line: string, pattern: RegExp): string[] {
  const numbers: number[] = [];
  for (const [, from, to] of line.matchAll(pattern)) {
    for (let n = Number(from); n <= Number(to ?? from); n++) numbers.push(n);
  }
  return numbers.sort((a, b) => a - b).map(String);
}

describe.each(locales)(
  "$name compatibility pages track the caniemail snapshot",
  (locale) => {
    const index = readDocs(`${locale.dir}/index.md`);
    const catalog = readDocs(`${locale.dir}/rule-catalog.md`);

    it("state the snapshot date", () => {
      expect(locale.indexDate.exec(index)?.[1]).toBe(CANIEMAIL_DATA_DATE);
      expect(locale.catalogDate.exec(catalog)?.[1]).toBe(CANIEMAIL_DATA_DATE);
    });

    it("give every data-backed rule exactly one narrowing line", () => {
      const lines = narrowingLines(catalog, locale.narrowingLabel);
      const withLine = [...lines]
        .filter(([, found]) => found.length > 0)
        .map(([slug]) => slug);
      expect(withLine.sort()).toEqual([...slugs].sort());
      for (const slug of slugs) expect(lines.get(slug)).toHaveLength(1);
    });

    it("cite exactly the notes each rule pins", () => {
      const lines = narrowingLines(catalog, locale.narrowingLabel);
      for (const slug of slugs) {
        const [line] = lines.get(slug) ?? [];
        const notes = Object.keys(pinned[slug] ?? {}).sort(
          (a, b) => Number(a) - Number(b),
        );
        if (notes.length === 0) {
          expect({ slug, line }).toEqual({ slug, line: locale.noNarrowing });
        } else {
          expect({ slug, notes: citedNotes(line, locale.noteNumbers) }).toEqual(
            {
              slug,
              notes,
            },
          );
        }
      }
    });
  },
);
