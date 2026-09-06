import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectFormat,
  runImport,
  summarizeReport,
} from "../scripts/import.mjs";
import { validateTemplate } from "../scripts/validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoFile = (rel: string) => resolve(here, "../../..", rel);

describe("detectFormat", () => {
  it("detects html by extension", () => {
    expect(detectFormat("email.html", "anything")).toBe("html");
    expect(detectFormat("email.htm", "x")).toBe("html");
  });
  it("detects html by a leading angle bracket", () => {
    expect(detectFormat("export.txt", "  <table></table>")).toBe("html");
  });
  it("detects unlayer by body.rows", () => {
    expect(
      detectFormat("design.json", JSON.stringify({ body: { rows: [] } })),
    ).toBe("unlayer");
  });
  it("detects beefree by page.rows", () => {
    expect(
      detectFormat("template.json", JSON.stringify({ page: { rows: [] } })),
    ).toBe("beefree");
  });
  it("returns null when it can't tell", () => {
    expect(detectFormat("x.json", JSON.stringify({ foo: 1 }))).toBe(null);
    expect(detectFormat("x.json", "not json at all")).toBe(null);
  });
  it("detects mjml from the file extension", () => {
    expect(detectFormat("welcome.mjml", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects mjml from an <mjml> root even with an .html extension", () => {
    expect(detectFormat("weird.html", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects mjml from an mj-body when the root tag is missing", () => {
    expect(detectFormat("frag.txt", "<mj-body><mj-section /></mj-body>")).toBe("mjml");
  });
  it("still detects plain html as html", () => {
    expect(detectFormat("mail.html", "<html><body><table></table></body></html>")).toBe("html");
  });
  it("does not mistake html mentioning mjml in prose for mjml", () => {
    expect(
      detectFormat("mail.html", "<html><body><p>Built with mjml</p></body></html>"),
    ).toBe("html");
  });
});

describe("summarizeReport", () => {
  it("counts entries by status and passes warnings through", () => {
    const report = {
      entries: [
        { status: "converted" },
        { status: "converted" },
        { status: "approximated" },
        { status: "html-fallback" },
        { status: "skipped" },
      ],
      warnings: ["one header row moved"],
    };
    expect(summarizeReport(report)).toEqual({
      total: 5,
      converted: 2,
      approximated: 1,
      htmlFallback: 1,
      skipped: 1,
      warnings: ["one header row moved"],
    });
  });
  it("handles an absent report", () => {
    expect(summarizeReport(undefined)).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
      warnings: [],
    });
  });
});

// End-to-end against each importer's own fixture. The converter packages are
// optional (install-on-demand), so skip gracefully if one isn't resolvable —
// CI builds all packages before tests, so the real assertions run there. This
// mirrors the optional-quality-layer test in validate.test.ts.
describe("runImport — real fixtures convert to valid Templatical JSON", () => {
  const cases = [
    {
      format: "unlayer",
      fixture: "packages/import-unlayer/src/__tests__/fixtures/example-1.json",
    },
    {
      format: "beefree",
      fixture: "packages/import-beefree/src/__tests__/fixtures/example-1.json",
    },
    {
      format: "html",
      fixture: "packages/import-html/src/__tests__/fixtures/multi-column.html",
    },
    {
      format: "mjml",
      fixture: "packages/import-mjml/src/__tests__/fixtures/newsletter.mjml",
    },
  ] as const;

  it.each(cases)("imports a $format fixture", async ({ format, fixture }) => {
    const source = readFileSync(repoFile(fixture), "utf8");
    let result;
    try {
      result = await runImport(source, format);
    } catch (err) {
      if ((err as { missingPackage?: string }).missingPackage) return; // not built/installed → skip
      throw err;
    }
    const { valid, errors } = validateTemplate(result.content);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
    expect(result.report.entries.length).toBeGreaterThan(0);
  });
});
