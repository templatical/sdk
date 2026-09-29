import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  Block,
  DividerBlock,
  SectionBlock,
  SpacingValue,
} from "@templatical/types";
import { convertStripoTemplate } from "../converter";

function sections(blocks: Block[]): SectionBlock[] {
  return blocks.filter((b): b is SectionBlock => b.type === "section");
}

function flat(blocks: Block[]): Block[] {
  return blocks.flatMap((b) =>
    b.type === "section" ? b.children.flat() : [b],
  );
}

function dividers(blocks: Block[]): DividerBlock[] {
  return flat(blocks).filter((b): b is DividerBlock => b.type === "divider");
}

function compiled(inner: string, wrapper = "#ffffff"): string {
  return `<!DOCTYPE html><html><body>
<table class="es-wrapper" style="background-color:${wrapper}"><tr><td>
${inner}
</td></tr></table>
</body></html>`;
}

function contentBody(
  rows: string,
  options?: { band?: string; body?: string; width?: string | null },
): string {
  const band = options?.band ? ` style="background-color:${options.band}"` : "";
  const body = options?.body ? ` style="background-color:${options.body}"` : "";
  const width =
    options?.width === null ? "" : ` width="${options?.width ?? "600"}"`;
  return `<table class="es-content"${band}><tr><td>
<table class="es-content-body"${width}${body}><tbody>
${rows}
</tbody></table>
</td></tr></table>`;
}

function line(width: string, border = "1px solid #cccccc", align = ""): string {
  const alignAttr = align ? ` align="${align}"` : "";
  return `<table class="es-spacer"${alignAttr} width="${width}" style="width:${width}">
<tr><td style="border-bottom:${border}"></td></tr>
</table>`;
}

const ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };

describe("compiled structure rows", () => {
  it("emits one section per body row, in order", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:20px 20px 0 20px"><h2>Heading above</h2><a class="es-button" href="https://example.com/go">Go</a></td></tr>
        <tr><td style="padding:20px"><table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table><table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table></td></tr>
        <tr><td style="padding:20px"><p>Footnote below</p></td></tr>
      `),
    );
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs.map((s) => s.columns)).toEqual(["1", "2", "1"]);
    expect(JSON.stringify(secs[0])).toContain("Heading above");
    expect(JSON.stringify(secs[0])).toContain("Go");
    expect(JSON.stringify(secs[1].children[0])).toContain("Left copy");
    expect(JSON.stringify(secs[1].children[1])).toContain("Right copy");
    expect(JSON.stringify(secs[2])).toContain("Footnote below");
    expect(secs[0].styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 0,
      left: 20,
    });
    expect(secs[1].styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    });
    expect(report.entries.some((e) => /split across/i.test(e.note ?? ""))).toBe(
      false,
    );
  });

  it("keeps a heading that sits above the columns in the same cell", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:20px">
          <h2>Heading above</h2>
          <table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table>
          <table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table>
        </td></tr>
      `),
    );
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs.map((s) => s.columns)).toEqual(["1", "2"]);
    expect(JSON.stringify(secs[0])).toContain("Heading above");
    expect(JSON.stringify(secs[1].children[0])).toContain("Left copy");
    expect(secs[0].styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 0,
      left: 20,
    });
    expect(secs[1].styles.padding).toEqual({
      top: 0,
      right: 20,
      bottom: 20,
      left: 20,
    });
    expect(
      report.entries.filter((e) =>
        /padding was split across/i.test(e.note ?? ""),
      ),
    ).toHaveLength(2);
  });

  it("keeps a footnote that sits below the columns", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:10px">
          <table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table>
          <table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table>
          <p>Footnote below</p>
        </td></tr>
      `),
    );
    const { content } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs.map((s) => s.columns)).toEqual(["2", "1"]);
    expect(JSON.stringify(secs[1])).toContain("Footnote below");
  });

  it("places content that sat between columns after them", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0">
          <table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table>
          <p>Between the columns</p>
          <table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table>
        </td></tr>
      `),
    );
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs.map((s) => s.columns)).toEqual(["2", "1"]);
    expect(JSON.stringify(secs[0].children[0])).toContain("Left copy");
    expect(JSON.stringify(secs[0].children[1])).toContain("Right copy");
    expect(JSON.stringify(secs[1])).toContain("Between the columns");
    expect(
      report.entries.some(
        (e) =>
          e.status === "approximated" &&
          e.note === "Content between columns was placed after them.",
      ),
    ).toBe(true);
    expect(
      report.entries.some((e) => /padding was split/i.test(e.note ?? "")),
    ).toBe(false);
  });

  it("still finds columns nested in a wrapper table", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0">
          <table><tr><td>
            <table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table>
            <table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table>
          </td></tr></table>
        </td></tr>
      `),
    );
    const secs = sections(convertStripoTemplate(html).content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("2");
    expect(JSON.stringify(secs[0].children[0])).toContain("Left copy");
    expect(JSON.stringify(secs[0].children[1])).toContain("Right copy");
  });

  it("ignores MSO comments beside the columns", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0">
          <!--[if mso]><table role="presentation"><tr><td></td></tr></table><![endif]-->
          <table class="es-left" align="left"><tr><td><p>Left copy</p></td></tr></table>
          <!--[if mso]><table role="presentation"><tr><td></td></tr></table><![endif]-->
          <table class="es-right" align="right"><tr><td><p>Right copy</p></td></tr></table>
        </td></tr>
      `),
    );
    const secs = sections(convertStripoTemplate(html).content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("2");
  });

  it("skips a row that has no content", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:20px"><p>Only row</p></td></tr>
        <tr><td style="padding:20px"><!--[if mso]><table><tr><td></td></tr></table><![endif]--></td></tr>
      `),
    );
    const secs = sections(convertStripoTemplate(html).content.blocks);
    expect(secs).toHaveLength(1);
    expect(JSON.stringify(secs[0])).toContain("Only row");
  });
});

describe("compiled widget order", () => {
  it("keeps a button between the paragraphs around it", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0">
          <p>Before the button</p>
          <a class="es-button" href="https://example.com/go">Go</a>
          <p>After the button</p>
        </td></tr>
      `),
    );
    const blob = JSON.stringify(
      flat(convertStripoTemplate(html).content.blocks),
    );
    const before = blob.indexOf("Before the button");
    const go = blob.indexOf('"text":"Go"');
    const after = blob.indexOf("After the button");
    expect(before).toBeGreaterThanOrEqual(0);
    expect(go).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(go);
  });

  it("keeps text that shares an element with a button", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0">
          <center><b>Keep me</b><a class="es-button" href="https://example.com/go">Go</a></center>
        </td></tr>
      `),
    );
    const blob = JSON.stringify(
      flat(convertStripoTemplate(html).content.blocks),
    );
    expect(blob.indexOf("Keep me")).toBeGreaterThanOrEqual(0);
    expect(blob.indexOf("Keep me")).toBeLessThan(blob.indexOf('"text":"Go"'));
  });
});

describe("compiled lines and spacers", () => {
  it("reads a bordered es-spacer as a divider, with the cell's padding", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:20px">
          <p>Above</p>
          <table><tr><td style="padding:10px 0">
            ${line("100%", "2px dashed #cc0000")}
          </td></tr></table>
          <p>Below</p>
        </td></tr>
      `),
    );
    const { content } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    });
    const blob = JSON.stringify(secs[0].children);
    expect(blob.indexOf("Above")).toBeLessThan(
      blob.indexOf('"type":"divider"'),
    );
    expect(blob.indexOf('"type":"divider"')).toBeLessThan(
      blob.indexOf("Below"),
    );
    expect(dividers(content.blocks)).toHaveLength(1);
    expect(dividers(content.blocks)[0]).toMatchObject({
      type: "divider",
      lineStyle: "dashed",
      color: "#cc0000",
      thickness: 2,
      width: "full",
      styles: { padding: { top: 10, right: 0, bottom: 10, left: 0 } },
    });
    expect(flat(content.blocks).some((b) => b.type === "spacer")).toBe(false);
  });

  it("keeps a centred percentage and reports a left-aligned one", () => {
    const centred = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("50%", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(centred.content.blocks)[0].width).toBe("50%");
    expect(
      centred.report.entries.some((e) =>
        /centres every divider/.test(e.note ?? ""),
      ),
    ).toBe(false);

    const left = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("40%", "1px solid #cccccc", "left")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(left.content.blocks)[0].width).toBe("40%");
    expect(
      left.report.entries.some(
        (e) =>
          e.status === "approximated" &&
          e.note ===
            "The source aligns this divider left; Templatical centres every divider.",
      ),
    ).toBe(true);
  });

  it("treats a partial line with no alignment as left", () => {
    const { content, report } = convertStripoTemplate(
      compiled(
        contentBody(`<tr><td style="padding:0">${line("50%")}</td></tr>`),
      ),
    );
    expect(dividers(content.blocks)[0].width).toBe("50%");
    expect(
      report.entries.some(
        (e) =>
          e.note ===
          "The source aligns this divider left; Templatical centres every divider.",
      ),
    ).toBe(true);
  });

  it("does not report alignment of a full-width line", () => {
    const { report } = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("100%", "1px solid #cccccc", "left")}</td></tr>`,
        ),
      ),
    );
    expect(
      report.entries.some((e) => /centres every divider/.test(e.note ?? "")),
    ).toBe(false);
  });

  it("rounds, clamps and rejects divider widths", () => {
    const share = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("12.345%", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(share.content.blocks)[0].width).toBe("12.35%");

    const clamped = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("140%", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(clamped.content.blocks)[0].width).toBe("full");
    expect(
      clamped.report.entries.some((e) =>
        /Divider width 140% was clamped to 100%/.test(e.note ?? ""),
      ),
    ).toBe(true);

    const unread = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("wide", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(unread.content.blocks)[0].width).toBe("full");
    expect(
      unread.report.entries.some((e) => /could not be read/.test(e.note ?? "")),
    ).toBe(true);
  });

  it("turns a px line into full width once it fills the column", () => {
    const stays = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("200px", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(stays.content.blocks)[0].width).toBe(200);

    const fills = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("600px", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(fills.content.blocks)[0].width).toBe("full");

    const padded = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0 50px">${line("500px", "1px solid #cccccc", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(padded.content.blocks)[0].width).toBe("full");

    const assumed = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("700px", "1px solid #cccccc", "center")}</td></tr>`,
          { width: null },
        ),
      ),
    );
    expect(dividers(assumed.content.blocks)[0].width).toBe("full");
  });

  it("subtracts the divider's own side padding only when comparing px", () => {
    const cell = (width: string) =>
      `<tr><td style="padding:0"><table><tr><td style="padding:0 40px">${line(width, "1px solid #cccccc", "center")}</td></tr></table></td></tr>`;
    const stays = convertStripoTemplate(compiled(contentBody(cell("500px"))));
    expect(dividers(stays.content.blocks)[0].width).toBe(500);
    expect(dividers(stays.content.blocks)[0].styles.padding).toEqual({
      top: 0,
      right: 40,
      bottom: 0,
      left: 40,
    });

    const fills = convertStripoTemplate(compiled(contentBody(cell("520px"))));
    expect(dividers(fills.content.blocks)[0].width).toBe("full");
  });

  it("measures a column's room from its share and the edge it carries", () => {
    const html = compiled(
      contentBody(`
        <tr><td style="padding:0 0 0 100px">
          <table class="es-left" align="left"><tr><td style="padding:0">
            ${line("220px", "1px solid #111111", "center")}
          </td></tr></table>
          <table class="es-right" align="right"><tr><td><p>Other</p></td></tr></table>
        </td></tr>
      `),
    );
    expect(dividers(convertStripoTemplate(html).content.blocks)[0].width).toBe(
      "full",
    );
  });

  it("imports a double border as a solid line", () => {
    const { content, report } = convertStripoTemplate(
      compiled(
        contentBody(
          `<tr><td style="padding:0">${line("100%", "4px double #112233", "center")}</td></tr>`,
        ),
      ),
    );
    expect(dividers(content.blocks)[0]).toMatchObject({
      lineStyle: "solid",
      color: "#112233",
      thickness: 4,
    });
    expect(
      report.entries.some((e) =>
        /border style "double" was imported as solid/.test(e.note ?? ""),
      ),
    ).toBe(true);
  });
});

describe("compiled paint and padding", () => {
  it("reads an rgb() body fill", () => {
    const html = compiled(
      contentBody(`<tr><td style="padding:0"><p>Mint</p></td></tr>`, {
        body: "rgb(229, 251, 246)",
      }),
    );
    expect(
      sections(convertStripoTemplate(html).content.blocks)[0].styles
        .backgroundColor,
    ).toBe("#e5fbf6");
  });

  it("puts a band that differs from the page and the body on the wrapper", () => {
    const html = compiled(
      contentBody(`<tr><td style="padding:0"><p>Card</p></td></tr>`, {
        band: "#0f766e",
        body: "#ffffff",
      }),
      "#f3f4f6",
    );
    const { content, report } = convertStripoTemplate(html);
    const section = sections(content.blocks)[0];
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.wrapper).toEqual({ backgroundColor: "#0f766e" });
    expect(content.settings.backgroundColor).toBe("#f3f4f6");
    expect(
      report.entries.some(
        (e) =>
          e.status === "approximated" &&
          e.note === "The band colour was imported as a section wrapper.",
      ),
    ).toBe(true);
  });

  it("uses the band as the section fill when the body is transparent", () => {
    const html = compiled(
      contentBody(`<tr><td style="padding:0"><p>Band</p></td></tr>`, {
        band: "#112233",
        body: "transparent",
      }),
      "#f3f4f6",
    );
    const section = sections(convertStripoTemplate(html).content.blocks)[0];
    expect(section.styles.backgroundColor).toBe("#112233");
    expect(section.wrapper).toBeUndefined();
  });

  it("reports a background image and keeps the colour", () => {
    const html = compiled(
      `<table class="es-content" style="background-color:#222222;background-image:url(https://cdn.example/stripe.png)"><tr><td>
        <table class="es-content-body" width="600" style="background-color:#ffffff"><tr><td style="padding:0"><p>Photo</p></td></tr></table>
      </td></tr></table>`,
      "#ffffff",
    );
    const { content, report } = convertStripoTemplate(html);
    const section = sections(content.blocks)[0];
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.wrapper).toEqual({ backgroundColor: "#222222" });
    expect(JSON.stringify(content)).not.toContain("stripe.png");
    expect(
      report.entries.some((e) =>
        /background image was not imported/.test(e.note ?? ""),
      ),
    ).toBe(true);
  });

  it("maps structure padding onto the section, including an explicit 0", () => {
    const zero = sections(
      convertStripoTemplate(
        compiled(
          contentBody(`<tr><td style="padding:0"><p>Flush</p></td></tr>`),
        ),
      ).content.blocks,
    )[0];
    expect(zero.styles.padding).toEqual(ZERO);

    const asymmetric = sections(
      convertStripoTemplate(
        compiled(
          contentBody(
            `<tr><td style="padding:20px;padding-bottom:0"><p>Flush bottom</p></td></tr>`,
          ),
        ),
      ).content.blocks,
    )[0];
    expect(asymmetric.styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 0,
      left: 20,
    });

    const longhand = sections(
      convertStripoTemplate(
        compiled(
          contentBody(
            `<tr><td style="padding-top:32px;padding-right:20px;padding-bottom:0;padding-left:20px"><p>Sides</p></td></tr>`,
          ),
        ),
      ).content.blocks,
    )[0];
    expect(longhand.styles.padding).toEqual({
      top: 32,
      right: 20,
      bottom: 0,
      left: 20,
    });
  });

  it("takes the page background from es-wrapper", () => {
    const { content } = convertStripoTemplate(
      compiled(
        contentBody(`<tr><td style="padding:0"><p>Page</p></td></tr>`),
        "#f3f4f6",
      ),
    );
    expect(content.settings.backgroundColor).toBe("#f3f4f6");
  });
});

describe("compiled report", () => {
  it("counts the section it kept and drops the HTML row sections", () => {
    const { report } = convertStripoTemplate(
      compiled(
        contentBody(`<tr><td style="padding:0"><p>Only copy</p></td></tr>`),
      ),
    );
    expect(report.entries.some((e) => e.sourceTag === "tr")).toBe(false);
    expect(
      report.entries.some(
        (e) =>
          e.sourceTag === "es-content" && e.templaticalBlockType === "section",
      ),
    ).toBe(true);
  });
});

describe("editor fidelity", () => {
  function editorDoc(structure: string, stripeStyle = ""): string {
    return `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"${stripeStyle}>
<table class="es-content-body" width="600" style="background-color:#ffffff"><tr>
${structure}
</tr></table>
</td></tr></table>
</body></html>`;
  }

  it("reads es-p classes, then lets an inline side win", () => {
    const fromClass = convertStripoTemplate(
      editorDoc(
        `<td class="esd-structure es-p40t es-p10r es-p10b es-p20l"><table><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>Class pad</p></td></tr></table></td></tr></table></td>`,
      ),
    );
    expect(sections(fromClass.content.blocks)[0].styles.padding).toEqual({
      top: 40,
      right: 10,
      bottom: 10,
      left: 20,
    });

    const overridden = convertStripoTemplate(
      editorDoc(
        `<td class="esd-structure es-p40" style="padding-top:5px"><table><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>Inline pad</p></td></tr></table></td></tr></table></td>`,
      ),
    );
    expect(sections(overridden.content.blocks)[0].styles.padding).toEqual({
      top: 5,
      right: 40,
      bottom: 40,
      left: 40,
    });
  });

  it("wraps a stripe colour around a white body", () => {
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe" style="background-color:#0f766e">
<table><tr><td>
<table class="es-content-body" width="600" style="background-color:#ffffff"><tr>
<td class="esd-structure es-p40" style="padding:40px">
<table><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>Band copy</p></td></tr></table></td></tr></table>
</td>
</tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const section = sections(content.blocks)[0];
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.styles.padding).toEqual({
      top: 40,
      right: 40,
      bottom: 40,
      left: 40,
    });
    expect(section.wrapper).toEqual({ backgroundColor: "#0f766e" });
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(
      report.entries.some(
        (e) =>
          e.status === "approximated" && /section wrapper/.test(e.note ?? ""),
      ),
    ).toBe(true);
  });

  it("paints a stripe that has no body and no structure", () => {
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe" bgcolor="#112233">
<table><tr><td class="esd-block-text"><p>Stripe Copy</p></td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const section = sections(content.blocks)[0];
    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#112233");
    expect(section.wrapper).toBeUndefined();
    expect(JSON.stringify(section)).toContain("Stripe Copy");
    expect(report.entries.some((e) => e.sourceTag === "esd-stripe")).toBe(true);
  });

  it("reads an esd-block-spacer border as a divider", () => {
    const html = editorDoc(
      `<td class="esd-structure"><table><tr><td class="esd-container-frame"><table><tr>
<td class="esd-block-spacer" style="padding:10px 0">
<table class="es-spacer" width="100%"><tr><td style="border-bottom:3px dotted #336699"></td></tr></table>
</td>
</tr></table></td></tr></table></td>`,
    );
    const divider = dividers(convertStripoTemplate(html).content.blocks)[0];
    expect(divider).toMatchObject({
      type: "divider",
      lineStyle: "dotted",
      color: "#336699",
      thickness: 3,
      width: "full",
      styles: { padding: { top: 10, right: 0, bottom: 10, left: 0 } },
    });
  });

  it("applies plugin CSS to the paragraph and does not leak the rule", () => {
    const html = `<td class="esd-stripe"><td class="esd-structure"><td class="esd-container-frame"><td class="esd-block-text"><p>CSS Widget Copy</p></td></td></td></td>`;
    const { content } = convertStripoTemplate(html, {
      css: "p { color: #c01010; }",
    });
    const blob = JSON.stringify(content);
    expect(blob).toContain("CSS Widget Copy");
    expect(blob).toContain("color: #c01010");
    expect(blob).not.toContain("p { color");
  });
});

describe("Launchpad sample", () => {
  const html = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../apps/playground/src/scenes/import/samples/launchpad.stripo.html",
    ),
    "utf8",
  );

  it("keeps the email, the page colour and only the sections it emitted", () => {
    const { content, report } = convertStripoTemplate(html);
    expect(content.settings.backgroundColor).toBe("#f3f4f6");
    expect(report.summary.htmlFallback).toBe(0);
    expect(report.summary.skipped).toBe(0);
    expect(report.entries.some((e) => e.sourceTag === "tr")).toBe(false);
    expect(
      content.blocks.filter(
        (block) => block.type === "section" && block.children.length === 2,
      ),
    ).toHaveLength(2);
    expect(flat(content.blocks).some((b) => b.type === "divider")).toBe(true);
    expect(sections(content.blocks).every((s) => s.wrapper === undefined)).toBe(
      true,
    );
    const text = JSON.stringify(content);
    for (const phrase of [
      "launchpad",
      "Introducing Launchpad v2.0",
      "We have been working on something big.",
      "Redesigned Dashboard",
      "Ready to upgrade?",
    ]) {
      expect(text).toContain(phrase);
    }
  });
});
