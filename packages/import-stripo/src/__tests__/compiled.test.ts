import { describe, expect, it } from "vitest";
import { convertStripoTemplate } from "../converter";
import type { Block, SectionBlock } from "@templatical/types";

function sections(blocks: Block[]): SectionBlock[] {
  return blocks.filter((b): b is SectionBlock => b.type === "section");
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

  it("merges a fourth floated column into the third slot", () => {
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
    const product = sections(content.blocks).find((s) => s.columns === "3");
    expect(product).toBeTruthy();
    expect(product!.children).toHaveLength(3);
    expect(JSON.stringify(product!.children[0])).toContain("Col Alpha");
    expect(JSON.stringify(product!.children[1])).toContain("Col Beta");
    expect(JSON.stringify(product!.children[2])).toContain("Col Gamma");
    expect(JSON.stringify(product!.children[2])).toContain("Col Delta");
    expect(
      report.warnings.some((w) => w.includes("4 columns was flattened")),
    ).toBe(true);
    expect(
      report.entries.some(
        (e) => e.status === "approximated" && e.sourceTag === "es-content",
      ),
    ).toBe(true);
  });

  it("maps es-social icons from title/src/alt", () => {
    const { content } = convertStripoTemplate(social);
    const icons = content.blocks
      .flatMap((b) => (b.type === "section" ? b.children.flat() : [b]))
      .filter((b) => b.type === "social");
    expect(icons).toHaveLength(1);
    if (icons[0].type === "social") {
      expect(icons[0].icons.map((i) => i.platform)).toEqual([
        "facebook",
        "twitter",
      ]);
      expect(icons[0].icons[0].url).toBe("https://facebook.com/brand");
    }
  });
});
