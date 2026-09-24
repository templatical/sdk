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

  it("flattens four container-frames to a single column", () => {
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
    expect(secs[0].columns).toBe("1");
    expect(secs[0].children).toHaveLength(1);
    const col = JSON.stringify(secs[0].children[0]);
    expect(col).toContain("Frame One");
    expect(col).toContain("Frame Four");
    expect(
      report.warnings.some((w) => w.includes("flattened to a single column")),
    ).toBe(true);
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

  it("injects plugin CSS so it is present in the document used for conversion", () => {
    const html = `<td class="esd-stripe"><td class="esd-structure"><td class="esd-container-frame"><td class="esd-block-text"><p>CSS Widget Copy</p></td></td></td></td>`;
    const { content } = convertStripoTemplate(html, {
      css: "p { color: #c01010; }",
    });
    expect(JSON.stringify(content)).toContain("CSS Widget Copy");
  });
});
