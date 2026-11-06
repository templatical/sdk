import { elementIdIssues } from "@templatical/types";
import { describe, expect, it } from "vitest";
import { convertStripoTemplate } from "../converter";
import type { Block, SectionBlock, SocialIconsBlock } from "@templatical/types";

function sections(blocks: Block[]): SectionBlock[] {
  return blocks.filter((b): b is SectionBlock => b.type === "section");
}

/** One floated column. Widths may sit on the `es-left` / `es-right` table or its cell. */
function floatedColumn(
  copy: string,
  width: {
    table?: string;
    tableStyle?: string;
    cell?: string;
    cellStyle?: string;
    side?: "es-left" | "es-right";
  } = {},
): string {
  const side = width.side ?? "es-left";
  const align = side === "es-right" ? "right" : "left";
  const tableWidth = width.table ? ` width="${width.table}"` : "";
  const tableStyle = width.tableStyle ? ` style="${width.tableStyle}"` : "";
  const cellWidth = width.cell ? ` width="${width.cell}"` : "";
  const cellStyle = width.cellStyle ? ` style="${width.cellStyle}"` : "";
  return `<table class="${side}" align="${align}"${tableWidth}${tableStyle}><tr><td${cellWidth}${cellStyle}><p>${copy}</p></td></tr></table>`;
}

function floatedRow(columns: string): string {
  return `<!DOCTYPE html><html><body>
<table class="es-wrapper"><tr><td>
<table class="es-content"><tr><td>
${columns}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function socialTable(cells: string): string {
  return `<!DOCTYPE html>
<html><body>
<table class="es-content-body">
  <tr><td>
    <table class="es-social">
      <tr>${cells}</tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function iconCell(href: string, img: string): string {
  return `<td><a href="${href}">${img}</a></td>`;
}

function socialBlocks(blocks: Block[]): SocialIconsBlock[] {
  return blocks
    .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
    .filter((b): b is SocialIconsBlock => b.type === "social");
}

function socialEntry(
  report: ReturnType<typeof convertStripoTemplate>["report"],
) {
  const entry = report.entries.find((e) => e.sourceTag === "es-social");
  if (!entry) throw new Error("missing es-social entry");
  return entry;
}

const threeCol = `<!DOCTYPE html>
<html><body>
<table class="es-wrapper">
  <tr><td>
    <table class="es-content">
      <tr>
        <td>
          <table class="es-left" align="left">
            <tr><td>
              <img src="https://example.com/alpha.png" alt="Alpha gem" width="180">
              <p>Alpha gem copy</p>
              <a class="es-button" href="https://example.com/a">Buy Alpha</a>
            </td></tr>
          </table>
          <table class="es-left" align="left">
            <tr><td>
              <img src="https://example.com/beta.png" alt="Beta gem" width="180">
              <p>Beta gem copy</p>
              <a class="es-button" href="https://example.com/b">Buy Beta</a>
            </td></tr>
          </table>
          <table class="es-right" align="right">
            <tr><td>
              <img src="https://example.com/gamma.png" alt="Gamma gem" width="180">
              <p>Gamma gem copy</p>
              <a class="es-button" href="https://example.com/c">Buy Gamma</a>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const headerContentFooter = `<!DOCTYPE html>
<html><body>
<table class="es-wrapper">
  <tr><td>
    <table class="es-header" style="background-color:transparent"><tr><td>
      <table class="es-header-body" bgcolor="#ffffff" style="background-color:#E5FBF6"><tr><td><p>Header Widget Brand</p></td></tr></table>
    </td></tr></table>
    <table class="es-content"><tr><td><p>Body Widget Story</p></td></tr></table>
    <table class="es-footer"><tr><td><p>Footer Widget Legal</p></td></tr></table>
  </td></tr>
</table>
</body></html>`;

const styledButton = `<!DOCTYPE html>
<html><body>
<table class="es-content">
  <tr><td>
    <span class="es-button-border" style="background:#113F37;border-radius:30px">
      <a class="es-button" href="https://example.com/reset" style="color:#FFFFFF;background:#113F37;border-radius:30px">Reset password</a>
    </span>
  </td></tr>
</table>
</body></html>`;

const navMenu = `<!DOCTYPE html>
<html><body>
<table class="es-content-body">
  <tr><td>
    <table class="es-menu">
      <tr>
        <td><a href="https://example.com/home">Home Link</a></td>
        <td><a href="https://example.com/shop">Shop Link</a></td>
        <td><a href="https://example.com/about">About Link</a></td>
        <td><a href="https://example.com/contact">Contact Link</a></td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const oneItemMenu = `<!DOCTYPE html>
<html><body>
<table class="es-content-body">
  <tr><td>
    <table class="es-menu">
      <tr>
        <td width="100%"><a href="https://example.com/step">Enter a new password</a></td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

const social = `<!DOCTYPE html>
<html><body>
<table class="es-content-body">
  <tr><td>
    <table class="es-social">
      <tr>
        <td><a href="https://facebook.com/brand"><img title="Facebook" src="https://cdn.example/facebook.png" alt="Fb"></a></td>
        <td><a href="https://x.com/brand"><img title="X" src="https://cdn.example/x-logo.png" alt="X"></a></td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

describe("compiled pipeline", () => {
  it("maps header/content/footer stripes to three sections", () => {
    const { content } = convertStripoTemplate(headerContentFooter);
    const secs = sections(content.blocks);
    expect(secs).toHaveLength(3);
    expect(secs.map((s) => s.columns)).toEqual(["1", "1", "1"]);
    expect(JSON.stringify(secs[0])).toContain("Header Widget Brand");
    expect(JSON.stringify(secs[1])).toContain("Body Widget Story");
    expect(JSON.stringify(secs[2])).toContain("Footer Widget Legal");
    expect(secs[0].styles.backgroundColor).toBe("#e5fbf6");
  });

  it("keeps a stripe colour on the section when the stripe has no body", () => {
    const html = `<!DOCTYPE html><html><body>
<table class="es-wrapper"><tr><td>
<table class="es-content" bgcolor="#112233"><tr><td><p>Stripe copy</p></td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const section = sections(content.blocks)[0];
    expect(section.styles.backgroundColor).toBe("#112233");
    expect(section.wrapper).toBeUndefined();
    expect(JSON.stringify(section)).toContain("Stripe copy");
    expect(
      report.entries.filter(
        (entry) => entry.templaticalBlockType === "section",
      ),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("copies es-button inline paint onto the button block", () => {
    const { content } = convertStripoTemplate(styledButton);
    const buttons = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatchObject({
      type: "button",
      text: "Reset password",
      url: "https://example.com/reset",
      backgroundColor: "#113f37",
      textColor: "#ffffff",
      borderRadius: 30,
    });
  });

  it("maps es-left/es-right siblings to three columns", () => {
    const { content, report } = convertStripoTemplate(threeCol);
    const secs = sections(content.blocks);
    expect(secs.length).toBeGreaterThanOrEqual(1);
    const product = secs.find((s) => s.columns === "3");
    expect(product).toBeTruthy();
    expect(product!.children).toHaveLength(3);
    expect(JSON.stringify(product!.children[0])).toContain("Alpha gem copy");
    expect(JSON.stringify(product!.children[1])).toContain("Beta gem copy");
    expect(JSON.stringify(product!.children[2])).toContain("Gamma gem copy");
    expect(report.warnings.some((w) => w.includes("flattened"))).toBe(false);
    expect(report.summary.htmlFallback).toBe(0);
  });

  it("maps a multi-item es-menu to one menu block, not columns", () => {
    const { content, report } = convertStripoTemplate(navMenu);
    expect(elementIdIssues(content)).toEqual([]);
    const menus = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "menu");
    expect(menus).toHaveLength(1);
    expect(menus[0].type).toBe("menu");
    if (menus[0].type === "menu") {
      expect(menus[0].items.map((i) => i.text)).toEqual([
        "Home Link",
        "Shop Link",
        "About Link",
        "Contact Link",
      ]);
    }
    expect(report.warnings.some((w) => w.includes("flattened"))).toBe(false);
  });

  it("does not treat a one-item es-menu as a menu", () => {
    const { content } = convertStripoTemplate(oneItemMenu);
    const all = content.blocks.flatMap((b) =>
      b.type === "section" ? b.children.flat() : [b],
    );
    expect(all.some((b) => b.type === "menu")).toBe(false);
    expect(JSON.stringify(all)).toContain("Enter a new password");
  });

  it("keeps four floated columns", () => {
    const html = `<!DOCTYPE html><html><body>
<table class="es-wrapper"><tr><td>
<table class="es-content"><tr><td>
  <table class="es-left"><tr><td><p>Col Alpha</p></td></tr></table>
  <table class="es-left"><tr><td><p>Col Beta</p></td></tr></table>
  <table class="es-left"><tr><td><p>Col Gamma</p></td></tr></table>
  <table class="es-right"><tr><td><p>Col Delta</p></td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const product = sections(content.blocks).find((s) => s.columns === "4");
    expect(product).toBeTruthy();
    expect(product!.children).toHaveLength(4);
    expect(JSON.stringify(product!.children[0])).toContain("Col Alpha");
    expect(JSON.stringify(product!.children[1])).toContain("Col Beta");
    expect(JSON.stringify(product!.children[2])).toContain("Col Gamma");
    expect(JSON.stringify(product!.children[3])).toContain("Col Delta");
    expect(report.warnings.some((w) => w.includes("was flattened"))).toBe(
      false,
    );
    expect(
      report.entries.some(
        (e) => e.status === "approximated" && e.sourceTag === "es-content",
      ),
    ).toBe(false);
  });

  it("merges a fifth floated column into the fourth slot", () => {
    const html = `<!DOCTYPE html><html><body>
<table class="es-wrapper"><tr><td>
<table class="es-content"><tr><td>
  <table class="es-left"><tr><td><p>Col Alpha</p></td></tr></table>
  <table class="es-left"><tr><td><p>Col Beta</p></td></tr></table>
  <table class="es-left"><tr><td><p>Col Gamma</p></td></tr></table>
  <table class="es-left"><tr><td><p>Col Delta</p></td></tr></table>
  <table class="es-right"><tr><td><p>Col Epsilon</p></td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
    const { content, report } = convertStripoTemplate(html);
    const product = sections(content.blocks).find((s) => s.columns === "4");
    expect(product).toBeTruthy();
    expect(product!.children).toHaveLength(4);
    expect(JSON.stringify(product!.children[3])).toContain("Col Delta");
    expect(JSON.stringify(product!.children[3])).toContain("Col Epsilon");
    expect(report.warnings).toContain(
      "Row with 5 columns was flattened; extra columns merged into the fourth slot. Templatical supports up to four columns per section.",
    );
  });

  it("reports two unequal column widths as two equal columns", () => {
    const html = floatedRow(
      [
        floatedColumn("Left", { table: "200" }),
        floatedColumn("Right", { table: "400", side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px and 400px became two equal columns.",
      },
    ]);
  });

  it("reports three unequal cell widths as three equal columns", () => {
    const html = floatedRow(
      [
        floatedColumn("A", { cellStyle: "padding:0;width:180px" }),
        floatedColumn("B", { cellStyle: "padding:0;width:240px" }),
        floatedColumn("C", {
          cellStyle: "padding:0;width:180px",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px, 240px and 180px became three equal columns.",
      },
    ]);
  });

  it("reports four unequal declared widths as four equal columns", () => {
    const html = floatedRow(
      [
        floatedColumn("A", { table: "100" }),
        floatedColumn("B", { table: "200" }),
        floatedColumn("C", { table: "150" }),
        floatedColumn("D", { table: "150", side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("4");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 100px, 200px, 150px and 150px became four equal columns.",
      },
    ]);
  });

  it("treats equal inline column widths as converted", () => {
    const html = floatedRow(
      [
        floatedColumn("Left", { table: "200", tableStyle: "width:100px" }),
        floatedColumn("Right", {
          table: "400",
          tableStyle: "width:100px",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("reports unequal inline column widths over the width attributes", () => {
    const html = floatedRow(
      [
        floatedColumn("Left", { table: "400", tableStyle: "width:180px" }),
        floatedColumn("Right", {
          table: "180",
          tableStyle: "width:420px",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px and 420px became two equal columns.",
      },
    ]);
  });

  it("lets an inline cell width win over the cell's width attribute", () => {
    const html = floatedRow(
      [
        floatedColumn("Left", { cell: "400", cellStyle: "width:180px" }),
        floatedColumn("Right", {
          cell: "180",
          cellStyle: "width:420px",
          side: "es-right",
        }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 180px and 420px became two equal columns.",
      },
    ]);
  });

  it("names an unstated compiled column beside widths that differ", () => {
    const html = floatedRow(
      [
        floatedColumn("A", { table: "200" }),
        floatedColumn("B", { table: "400" }),
        floatedColumn("C", { side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Columns of 200px, 400px and an unstated width became three equal columns.",
      },
    ]);
  });

  it("keeps compiled widths within 1px converted", () => {
    const html = floatedRow(
      [
        floatedColumn("A", { cellStyle: "width:200px" }),
        floatedColumn("B", { cellStyle: "width:200px" }),
        floatedColumn("C", { cellStyle: "width:201px", side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("3");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("stays converted when fewer than two compiled columns state a width", () => {
    const html = floatedRow(
      [
        floatedColumn("Left", { table: "200" }),
        floatedColumn("Right", { side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("2");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "converted",
      },
    ]);
  });

  it("names unequal widths when a fifth column folds into the fourth", () => {
    const html = floatedRow(
      [
        floatedColumn("A", { table: "100" }),
        floatedColumn("B", { table: "200" }),
        floatedColumn("C", { table: "300" }),
        floatedColumn("D", { table: "400" }),
        floatedColumn("E", { table: "500", side: "es-right" }),
      ].join(""),
    );
    const { content, report } = convertStripoTemplate(html);
    expect(sections(content.blocks)[0].columns).toBe("4");
    expect(
      report.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "es-content",
        templaticalBlockType: "section",
        status: "approximated",
        note: "Row with 5 columns was flattened; extra columns merged into the fourth slot. Templatical supports up to four columns per section. Columns of 100px, 200px, 300px, 400px and 500px became four equal columns.",
      },
    ]);
  });

  it("falls back to the root when there are no header/content/footer stripes", () => {
    const html = `<table class="es-wrapper"><tr><td><a class="es-button" href="https://example.com/x" style="background:#000;color:#fff">Go</a></td></tr></table>`;
    const { content } = convertStripoTemplate(html);
    const buttons = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(buttons)).toContain("Go");
  });

  it("maps an es-spacer", () => {
    const html = `<!DOCTYPE html><html><body>
<table class="es-wrapper"><tr><td>
<table class="es-content"><tr><td>
  <div class="es-spacer" style="height:24px"></div>
</td></tr></table>
</td></tr></table>
</body></html>`;
    const { content } = convertStripoTemplate(html);
    const spacers = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "spacer");
    expect(spacers.length).toBeGreaterThanOrEqual(1);
  });

  it("maps es-social icons from title/src/alt", () => {
    const { content, report } = convertStripoTemplate(social);
    const icons = socialBlocks(content.blocks);
    expect(icons).toHaveLength(1);
    expect(icons[0].icons.map((i) => i.platform)).toEqual([
      "facebook",
      "twitter",
    ]);
    expect(icons[0].icons[0].url).toBe("https://facebook.com/brand");
    expect(socialEntry(report)).toEqual({
      sourceTag: "es-social",
      templaticalBlockType: "social",
      status: "converted",
    });
  });

  it("reports an unmatched social icon as a generic website icon", () => {
    const { content, report } = convertStripoTemplate(
      socialTable(
        iconCell(
          "https://example.com/xing",
          `<img src="https://cdn.example/xing/other.png">`,
        ),
      ),
    );
    const icons = socialBlocks(content.blocks);
    expect(icons).toHaveLength(1);
    expect(icons[0].type).toBe("social");
    expect(icons[0].icons.map((i) => i.platform)).toEqual(["website"]);
    expect(socialEntry(report)).toEqual({
      sourceTag: "es-social",
      templaticalBlockType: "social",
      status: "approximated",
      note: "1 icon became a generic website icon.",
    });
  });

  it("counts one unmatched icon when the block also has a matched icon", () => {
    const { content, report } = convertStripoTemplate(
      socialTable(
        iconCell(
          "https://facebook.com/brand",
          `<img title="Facebook" src="https://cdn.example/facebook.png" alt="Fb">`,
        ) +
          iconCell(
            "https://example.com/xing",
            `<img src="https://cdn.example/xing/other.png">`,
          ),
      ),
    );
    const icons = socialBlocks(content.blocks);
    expect(icons[0].icons.map((i) => i.platform)).toEqual([
      "facebook",
      "website",
    ]);
    expect(socialEntry(report)).toEqual({
      sourceTag: "es-social",
      templaticalBlockType: "social",
      status: "approximated",
      note: "1 icon became a generic website icon.",
    });
  });

  it("counts every unmatched icon in one note", () => {
    const { content, report } = convertStripoTemplate(
      socialTable(
        iconCell(
          "https://example.com/xing",
          `<img src="https://cdn.example/xing/other.png">`,
        ) +
          iconCell(
            "https://example.com/other",
            `<img src="https://cdn.example/icons/mailbox.png">`,
          ),
      ),
    );
    expect(
      socialBlocks(content.blocks)[0].icons.map((i) => i.platform),
    ).toEqual(["website", "website"]);
    expect(socialEntry(report)).toMatchObject({
      status: "approximated",
      note: "2 icons became generic website icons.",
    });
  });

  it("keeps an icon explicitly named website, web, or link converted", () => {
    const { content, report } = convertStripoTemplate(
      socialTable(
        [
          iconCell(
            "https://example.com",
            `<img title="Website" src="https://cdn.example/icons/other.png" alt="Website">`,
          ),
          iconCell(
            "https://example.com/web",
            `<img title="Web" src="https://cdn.example/icons/other.png" alt="Web">`,
          ),
          iconCell(
            "https://example.com/link",
            `<img title="Link" src="https://cdn.example/icons/other.png" alt="Link">`,
          ),
          iconCell(
            "https://example.com/globe",
            `<img src="https://cdn.example/icons/web-circle-colored.png">`,
          ),
        ].join(""),
      ),
    );
    expect(
      socialBlocks(content.blocks)[0].icons.map((i) => i.platform),
    ).toEqual(["website", "website", "website", "website"]);
    expect(socialEntry(report)).toEqual({
      sourceTag: "es-social",
      templaticalBlockType: "social",
      status: "converted",
    });
  });
});
