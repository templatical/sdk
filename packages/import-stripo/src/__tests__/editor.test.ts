import { describe, expect, it } from "vitest";
import { convertStripoTemplate } from "../converter";
import type { Block, SectionBlock } from "@templatical/types";

const editorTwoCol = `<!DOCTYPE html>
<html><body>
<table>
  <tr>
    <td class="esd-stripe">
      <table>
        <tr>
          <td class="esd-structure">
            <table class="es-left" align="left">
              <tr>
                <td class="esd-container-frame">
                  <table><tr><td class="esd-block-text"><h2>Hello Widget</h2></td></tr></table>
                </td>
              </tr>
            </table>
            <table class="es-right" align="right">
              <tr>
                <td class="esd-container-frame">
                  <table><tr><td class="esd-block-button"><a class="es-button" href="https://example.com/cta" target="_blank" style="color:#FFFFFF;background:#113F37;border-radius:30px">Shop Now</a></td></tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;

function sections(blocks: Block[]): SectionBlock[] {
  return blocks.filter((b): b is SectionBlock => b.type === "section");
}

function structureDoc(frames: string, stripe = ""): string {
  return `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"${stripe}><table class="es-content-body" width="600"><tr><td class="esd-structure">
${frames}
</td></tr></table></td></tr></table>
</body></html>`;
}

/** A column frame. `table` is the `es-left` / `es-right` width; `frame` is the frame's. */
function sizedFrame(
  copy: string,
  width: {
    table?: string;
    tableStyle?: string;
    frame?: string;
    style?: string;
    side?: "es-left" | "es-right";
  } = {},
): string {
  const side = width.side ?? "es-left";
  const align = side === "es-right" ? "right" : "left";
  const tableWidth = width.table ? ` width="${width.table}"` : "";
  const tableStyle = width.tableStyle ? ` style="${width.tableStyle}"` : "";
  const frameWidth = width.frame ? ` width="${width.frame}"` : "";
  const frameStyle = width.style ? ` style="${width.style}"` : "";
  return `<table class="${side}" align="${align}"${tableWidth}${tableStyle}><tr><td class="esd-container-frame"${frameWidth}${frameStyle}><table><tr><td class="esd-block-text"><p>${copy}</p></td></tr></table></td></tr></table>`;
}

describe("editor pipeline", () => {
  it("maps esd-structure container-frames to two columns", () => {
    const { content, report } = convertStripoTemplate(editorTwoCol);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("2");
    expect(secs[0].children).toHaveLength(2);
    const left = JSON.stringify(secs[0].children[0]);
    const right = JSON.stringify(secs[0].children[1]);
    expect(left).toContain("Hello Widget");
    expect(right).toContain("Shop Now");
    const button = secs[0].children[1].find((b) => b.type === "button");
    expect(button).toMatchObject({
      type: "button",
      backgroundColor: "#113f37",
      textColor: "#ffffff",
      borderRadius: 30,
    });
    expect(report.entries.some((e) => e.sourceTag === "esd-structure")).toBe(
      true,
    );
    expect(report.entries.some((e) => e.sourceTag === "esd-block-button")).toBe(
      true,
    );
  });

  it("keeps four container-frames as four columns", () => {
    const frame = (copy: string) =>
      `<table class="es-left" align="left"><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>${copy}</p></td></tr></table></td></tr></table>`;
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"><table><tr><td class="esd-structure">
${frame("Frame One")}${frame("Frame Two")}${frame("Frame Three")}${frame("Frame Four")}
</td></tr></table></td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("4");
    expect(secs[0].children).toHaveLength(4);
    expect(JSON.stringify(secs[0].children[0])).toContain("Frame One");
    expect(JSON.stringify(secs[0].children[3])).toContain("Frame Four");
    expect(
      report.warnings.some((w) => w.includes("flattened to a single column")),
    ).toBe(false);
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      expect.objectContaining({
        templaticalBlockType: "section",
        status: "converted",
      }),
    ]);
  });

  it("flattens five container-frames and names the four-column limit", () => {
    const frame = (copy: string) =>
      `<table class="es-left" align="left"><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>${copy}</p></td></tr></table></td></tr></table>`;
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"><table><tr><td class="esd-structure">
${frame("Frame One")}${frame("Frame Two")}${frame("Frame Three")}${frame("Frame Four")}${frame("Frame Five")}
</td></tr></table></td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("1");
    expect(secs[0].children).toHaveLength(1);
    expect(JSON.stringify(secs[0].children[0])).toContain("Frame Five");
    expect(report.warnings).toContain(
      "Row with 5 columns was flattened to a single column. Templatical supports up to four columns per section.",
    );
  });

  it("preserves an esd-block-html as html-fallback", () => {
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"><table><tr><td class="esd-structure">
<table class="es-left"><tr><td class="esd-container-frame">
<table><tr><td class="esd-block-html"><table><tr><td>Raw Widget</td></tr></table></td></tr></table>
</td></tr></table>
</td></tr></table></td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const htmlBlocks = content.blocks.flatMap((b) =>
      b.type === "section" ? b.children.flat() : [b],
    );
    expect(htmlBlocks.some((b) => b.type === "html")).toBe(true);
    expect(JSON.stringify(htmlBlocks)).toContain("Raw Widget");
    expect(
      report.entries.some(
        (e) => e.sourceTag === "esd-block-html" && e.status === "html-fallback",
      ),
    ).toBe(true);
  });

  it("builds a 1-col section from a stripe that has no inner structure", () => {
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe" bgcolor="#112233">
<table><tr><td class="esd-block-text"><p>Stripe Copy</p></td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(1);
    expect(secs[0].columns).toBe("1");
    expect(JSON.stringify(secs[0])).toContain("Stripe Copy");
    expect(report.entries.some((e) => e.sourceTag === "esd-stripe")).toBe(true);
  });

  it("maps three container-frames to layout 3", () => {
    const frame = (copy: string) =>
      `<table class="es-left" align="left"><tr><td class="esd-container-frame"><table><tr><td class="esd-block-text"><p>${copy}</p></td></tr></table></td></tr></table>`;
    const html = `<!DOCTYPE html><html><body>
<table><tr><td class="esd-stripe"><table><tr><td class="esd-structure">
${frame("Col A")}${frame("Col B")}${frame("Col C")}
</td></tr></table></td></tr></table>
</body></html>`;
    const { content } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs[0].columns).toBe("3");
    expect(secs[0].children).toHaveLength(3);
    expect(JSON.stringify(secs[0].children[2])).toContain("Col C");
  });

  it("reports four unequal frame widths as four equal columns", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "180" }),
        sizedFrame("B", { frame: "220" }),
        sizedFrame("C", { frame: "100" }),
        sizedFrame("D", { frame: "100" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    const secs = sections(content.blocks);
    expect(secs[0].columns).toBe("4");
    expect(secs[0].children).toHaveLength(4);
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px, 220px, 100px and 100px became four equal columns.",
      },
    ]);
  });

  it("treats equal inline column-table widths as converted", () => {
    const html = structureDoc(
      [
        sizedFrame("Left", {
          table: "200",
          tableStyle: "width:100px",
          frame: "100",
        }),
        sizedFrame("Right", {
          table: "400",
          tableStyle: "width:100px",
          frame: "100",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("reports unequal inline column-table widths over the width attributes", () => {
    const html = structureDoc(
      [
        sizedFrame("Left", {
          table: "400",
          tableStyle: "width:180px",
          frame: "100",
        }),
        sizedFrame("Right", {
          table: "180",
          tableStyle: "width:420px",
          frame: "100",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px and 420px became two equal columns.",
      },
    ]);
  });

  it("uses the width attribute when the inline width is not a px length", () => {
    const html = structureDoc(
      [
        sizedFrame("Left", {
          table: "200",
          tableStyle: "width:50%",
          frame: "10",
        }),
        sizedFrame("Right", {
          table: "400",
          tableStyle: "width:80%",
          frame: "10",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px and 400px became two equal columns.",
      },
    ]);
  });

  it("reads an inline width on the column table", () => {
    const html = structureDoc(
      [
        sizedFrame("Left", { tableStyle: "width:180px", frame: "100" }),
        sizedFrame("Right", {
          tableStyle: "width:420px",
          frame: "100",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px and 420px became two equal columns.",
      },
    ]);
  });

  it("keeps three equal frame widths converted", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "200" }),
        sizedFrame("B", { frame: "200" }),
        sizedFrame("C", { frame: "200" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("reports a spread over 1px across three frames", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "201" }),
        sizedFrame("B", { frame: "200" }),
        sizedFrame("C", { frame: "202" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 201px, 200px and 202px became three equal columns.",
      },
    ]);
  });

  it("treats frame widths within 1px as equal", () => {
    const bare = (copy: string, style: string) =>
      `<table><tr><td class="esd-container-frame" style="${style}"><table><tr><td class="esd-block-text"><p>${copy}</p></td></tr></table></td></tr></table>`;
    const { content, report } = convertStripoTemplate(
      structureDoc(`${bare("A", "width:200px")}${bare("B", "width:201px")}`),
    );
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("names an unstated width when the readable widths differ", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "200" }),
        sizedFrame("B", { frame: "400" }),
        sizedFrame("C"),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px, 400px and an unstated width became three equal columns.",
      },
    ]);
  });

  it("keeps an unstated width in its column's place", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "200" }),
        sizedFrame("B"),
        sizedFrame("C", { frame: "400" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px, an unstated width and 400px became three equal columns.",
      },
    ]);
  });

  it("stays converted when fewer than two frames state a width", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "200" }),
        sizedFrame("B"),
        sizedFrame("C"),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("stays converted when readable widths are within 1px and one is unstated", () => {
    const html = structureDoc(
      [
        sizedFrame("A", { frame: "200" }),
        sizedFrame("B", { frame: "201" }),
        sizedFrame("C"),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("joins an unequal-width note onto the section's other notes", () => {
    const html = structureDoc(
      [
        sizedFrame("Left", { table: "200" }),
        sizedFrame("Right", { table: "400" }),
      ].join(""),
      ` style="background-color:#112233"`,
    ).replace(
      'class="es-content-body" width="600"',
      'class="es-content-body" width="600" style="background-color:#abcdef"',
    );
    const { report } = convertStripoTemplate(html);
    expect(
      report.entries.filter((e) => e.sourceTag === "esd-structure"),
    ).toEqual([
      {
        sourceTag: "esd-structure",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px and 400px became two equal columns.",
      },
    ]);
  });

  it("injects plugin CSS so it is present in the document used for conversion", () => {
    const html = `<td class="esd-stripe"><td class="esd-structure"><td class="esd-container-frame"><td class="esd-block-text"><p>CSS Widget Copy</p></td></td></td></td>`;
    const { content } = convertStripoTemplate(html, {
      css: "p { color: #c01010; }",
    });
    expect(JSON.stringify(content)).toContain("CSS Widget Copy");
  });
});
