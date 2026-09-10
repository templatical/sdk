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
  it("detects topol from the design root tagName", () => {
    expect(detectFormat("design.json", JSON.stringify({ tagName: "mj-global-style", children: [] })))
      .toBe("topol");
  });
  it("detects topol regardless of file name", () => {
    expect(detectFormat("whatever.txt", JSON.stringify({ tagName: "mj-global-style" })))
      .toBe("topol");
  });
  it("does not mistake an unlayer design for topol", () => {
    expect(detectFormat("design.json", JSON.stringify({ body: { rows: [] } }))).toBe("unlayer");
  });
  it("does not mistake a beefree template for topol", () => {
    expect(detectFormat("page.json", JSON.stringify({ page: { rows: [] } }))).toBe("beefree");
  });
  it("does not mistake MJML markup for topol", () => {
    expect(detectFormat("welcome.mjml", "<mjml><mj-body /></mjml>")).toBe("mjml");
  });
  it("detects stripo compiled HTML even with an .html extension", () => {
    expect(
      detectFormat(
        "export.html",
        '<table class="es-wrapper"><tr><td>x</td></tr></table>',
      ),
    ).toBe("stripo");
  });
  it("detects stripo editor HTML from an esd-stripe class", () => {
    expect(detectFormat("plugin.html", '<td class="esd-stripe">x</td>')).toBe(
      "stripo",
    );
  });
  it("detects stripo plugin JSON from getTemplateData html", () => {
    expect(
      detectFormat(
        "data.json",
        JSON.stringify({ html: '<td class="esd-block-text">x</td>', css: "p{}" }),
      ),
    ).toBe("stripo");
  });
  it("does not treat a stylesheet-only esd leftover as stripo", () => {
    expect(
      detectFormat(
        "mail.html",
        "<html><head><style>.esd-block-html table { width:auto }</style></head><body><table></table></body></html>",
      ),
    ).toBe("html");
  });
  it("still detects plain html as html when no stripo class attributes exist", () => {
    expect(
      detectFormat("mail.html", "<html><body><table></table></body></html>"),
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
    {
      format: "topol",
      fixture: "packages/import-topol/src/__tests__/fixtures/example-1.json",
    },
    {
      format: "stripo",
      fixture:
        "packages/import-stripo/src/__tests__/fixtures/compiled-content.html",
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
