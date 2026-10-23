import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
} from "@templatical/types";
import {
  lintCompatibility,
  lintCompiledHtml,
  lintHtmlFragment,
  DEFAULT_COMPATIBILITY_THRESHOLDS,
} from "../../src";
import { CANIEMAIL_DATA } from "../../src/compatibility/data/caniemail.generated";
import { supportFor } from "../../src/compatibility/support";
import { detect } from "../../src/compatibility/detect";
import { scanHtml } from "../../src/compatibility/scan";

describe("compatibility rules", () => {
  it("ignores unknown detector IDs and disabled compatibility checks", () => {
    expect(detect(scanHtml("<p>Hi</p>"), "compat.unknown")).toBeNull();
    const content = createDefaultTemplateContent();
    content.blocks = [createHtmlBlock({ content: "<script>x</script>" })];
    expect(lintCompatibility(content, { compatibility: false })).toEqual([]);
    expect(
      lintHtmlFragment("<script>x</script>", { compatibility: false }),
    ).toEqual([]);
    expect(lintCompiledHtml("x".repeat(100_000), { disabled: true })).toEqual(
      [],
    );
  });

  it("scans a reused block for each occurrence", () => {
    const content = createDefaultTemplateContent();
    const block = createHtmlBlock({ content: "<script>x</script>" });
    content.blocks = [block, block];
    expect(
      lintCompatibility(content)
        .filter(({ ruleId }) => ruleId === "compat.html-script")
        .map(({ blockId }) => blockId),
    ).toEqual([block.id, block.id]);
  });
  it("narrows a dataset-supported flex client only for inline-flex", () => {
    const narrowedCell = Object.entries(
      CANIEMAIL_DATA["css-display-flex"].cells,
    ).find(([, cell]) => cell.value === "y" && cell.notes.includes(2));
    expect(narrowedCell).toBeDefined();
    const id = narrowedCell![0];
    expect(
      supportFor("css-display-flex", "flex").find((client) => client.id === id),
    ).toBeUndefined();
    expect(
      supportFor("css-display-flex", "inline-flex").find(
        (client) => client.id === id,
      )?.support,
    ).toBe("unsupported");
  });

  it("flags pass-through flex with a data-backed Outlook verdict", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createHtmlBlock({
        content: '<div style="display: inline-flex">Hello</div>',
      }),
    ];
    const issue = lintCompatibility(content).find(
      (entry) => entry.ruleId === "compat.css-display-flex",
    )!;
    expect(issue.blockId).toBe(content.blocks[0].id);
    expect(issue.severity).toBe("warning");
    expect(issue.excerpt).toBe("display: inline-flex");
    expect(issue.suggestion).toBe(
      "Lay the content out with a section and columns, or with a table.",
    );
    expect(issue.reference).toBe(
      "https://www.caniemail.com/features/css-display-flex/",
    );
    expect(
      issue.clients?.find((client) => client.id === "outlook.windows")?.support,
    ).toBe("unsupported");
  });

  it("scans rich text and ignores renderer-authored image styling", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ content: '<p style="position: sticky">Hi</p>' }),
      createImageBlock({ src: "https://example.com/image.png", alt: "Image" }),
    ];
    expect(lintCompatibility(content).map((i) => i.ruleId)).toEqual([
      "compat.css-position",
    ]);
  });

  it("narrows body style and width notes", () => {
    const issues = lintHtmlFragment(
      '<style>p{color:red}</style><div style="width:200px">x</div>',
    );
    expect(issues.map((i) => i.ruleId)).toEqual([
      "compat.html-style",
      "compat.css-width",
    ]);
    expect(
      issues
        .find((i) => i.ruleId === "compat.css-width")
        ?.clients?.find((c) => c.id === "outlook.windows")?.support,
    ).toBe("unsupported");
  });

  it("keeps hand-written warnings free of client claims", () => {
    const issues = lintHtmlFragment(
      "<script>alert(1)</script><iframe></iframe>",
    );
    expect(issues.map((i) => i.ruleId)).toEqual([
      "compat.html-script",
      "compat.html-iframe",
    ]);
    expect(issues.map((i) => i.clients)).toEqual([undefined, undefined]);
    expect(issues[0].reference).toBe(
      "https://docs.templatical.com/quality/compatibility/rule-catalog#compat-html-script",
    );
  });

  it("measures UTF-8 bytes over the strict 90 KiB boundary", () => {
    const max = DEFAULT_COMPATIBILITY_THRESHOLDS.maxHtmlBytes;
    expect(lintCompiledHtml("x".repeat(max))).toEqual([]);
    const issue = lintCompiledHtml("x".repeat(max - 1) + "é")[0];
    expect(issue.ruleId).toBe("compat.gmail-clipping");
    expect(issue.severity).toBe("warning");
    expect(issue.message).toContain("90.0 KB");
    expect(issue.suggestion).toContain("90.0 KB");
    expect(
      lintCompiledHtml("x".repeat(max + 1), {
        compatibility: { rules: { "compat.gmail-clipping": "off" } },
      }),
    ).toEqual([]);
  });
});

describe("curated detector coverage", () => {
  const cases: Array<[string, string, string]> = [
    [
      "compat.css-display-grid",
      '<div style="display:grid">x</div>',
      "display: grid",
    ],
    [
      "compat.css-variables",
      '<div style="color:var(--brand)">x</div>',
      "color: var(--brand)",
    ],
    [
      "compat.css-at-import",
      "<style>@import url('https://x.test/a.css');</style>",
      "@import",
    ],
    [
      "compat.html-link",
      '<link rel="alternate stylesheet" href="https://x.test/a.css">',
      '<link rel="stylesheet">',
    ],
    ["compat.html-svg", "<svg></svg>", "<svg>"],
    ["compat.html-form", "<form><input></form>", "<form>"],
    ["compat.html-object", "<object></object>", "<object>"],
    ["compat.html-video", "<video></video>", "<video>"],
    ["compat.html-audio", "<audio></audio>", "<audio>"],
    [
      "compat.css-max-width",
      '<div style="max-width:400px">x</div>',
      "max-width: 400px",
    ],
    ["compat.css-float", '<div style="float:left">x</div>', "float: left"],
    [
      "compat.css-background-image",
      '<div style="background:url(https://x.test/a.png)">x</div>',
      "background: url(https://x.test/a.png)",
    ],
    [
      "compat.image-base64",
      '<img src="data:image/png;base64,AAAA">',
      "data:image/png",
    ],
    ["compat.html-script", "<script>alert(1)</script>", "<script>"],
    ["compat.html-iframe", "<iframe></iframe>", "<iframe>"],
  ];
  it.each(cases)("detects %s with a short excerpt", (id, html, excerpt) => {
    const issue = lintHtmlFragment(html).find((entry) => entry.ruleId === id);
    expect(issue?.excerpt).toBe(excerpt);
    expect(issue?.message).toBeTruthy();
    expect(issue?.suggestion).toBeTruthy();
  });

  it("does not flag degraded-only features or supported forms", () => {
    const ids = lintHtmlFragment(
      '<div style="border-radius:8px;box-shadow:0 1px black;opacity:.8;position:relative">x</div><img width="100" style="width:100px" src="https://x.test/a.svg"><table style="max-width:600px"></table>',
    ).map((i) => i.ruleId);
    expect(ids).toEqual([]);
  });

  it("does not mistake a data URL in CSS text for an image URL", () => {
    const issues = lintHtmlFragment(
      "<div style=\"content:'data:image/png;base64,AAAA'\">x</div>",
    );
    expect(issues.map((i) => i.ruleId)).not.toContain("compat.image-base64");
  });

  it("does not treat CSS string content as an @import rule", () => {
    const issues = lintHtmlFragment(
      '<style>.label::before { content: "@import"; }</style>',
    );
    expect(issues.map((entry) => entry.ruleId)).not.toContain(
      "compat.css-at-import",
    );
  });

  it("does not treat quoted var text as a CSS variable reference", () => {
    const issues = lintHtmlFragment(
      '<style>.label::before { content: "var(--brand)"; }</style>',
    );
    expect(issues.map((entry) => entry.ruleId)).not.toContain(
      "compat.css-variables",
    );
  });

  it("scans image sources without treating unrelated src attributes as images", () => {
    const issues = lintHtmlFragment(
      '<script src="data:image/png;base64,AAAA"></script><img src="data:image/gif;base64,AAAA">',
    );
    expect(
      issues.filter((issue) => issue.ruleId === "compat.image-base64"),
    ).toHaveLength(1);
    expect(
      issues.find((issue) => issue.ruleId === "compat.image-base64")?.excerpt,
    ).toBe("data:image/gif");
  });

  it("checks each CSS rule's own background fallback", () => {
    const issues = lintHtmlFragment("", {
      stylesheet:
        ".a{background:url(https://x.test/a.png)} .b{background-color:#fff}",
    });
    expect(issues.map((i) => i.ruleId)).toContain(
      "compat.css-background-image",
    );
  });

  it("describes stylesheet float without inventing an HTML element", () => {
    const issue = lintHtmlFragment("", {
      stylesheet: "p { float: left }",
    }).find((entry) => entry.ruleId === "compat.css-float");
    expect(issue?.message).toContain("source: stylesheet");
    expect(issue?.message).not.toContain("<stylesheet>");
  });

  it.each([
    "data:image/png,SECRET_PAYLOAD",
    "data:image/png;base64,SECRET_PAYLOAD",
  ])("keeps image data payloads out of CSS excerpts (%s)", (url) => {
    const issue = lintHtmlFragment(
      `<div style="background-image:url(${url})">x</div>`,
    ).find((entry) => entry.ruleId === "compat.css-background-image");
    expect(issue?.excerpt).toBe("background-image: url(data:image/png)");
    expect(issue?.excerpt).not.toContain("SECRET_PAYLOAD");
  });

  it("does not treat a hosted URL containing data:image as an embedded image", () => {
    const issues = lintHtmlFragment(
      '<img src="https://example.test/assets/data:image/png">',
    );
    expect(issues.map((entry) => entry.ruleId)).not.toContain(
      "compat.image-base64",
    );
  });
});
