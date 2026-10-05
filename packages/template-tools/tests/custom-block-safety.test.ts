import { describe, expect, it } from "vitest";
import { checkEmailSafety, stripCssComments, stripCssUrlsAndStrings } from "../src/custom-block/safety";

const def = (stylesheet = "") => ({ type: "promo", name: "P", fields: [], template: "", stylesheet }) as never;
const lint = (html: string, stylesheet = "", state = "defaults") =>
  checkEmailSafety(def(stylesheet), [{ state: state as never, html }]).map((i) => `${i.severity}:${i.ruleId}`);

describe("checkEmailSafety", () => {
  it("passes table-based, inline-styled markup", () => {
    expect(lint('<table role="presentation" width="100%"><tr><td style="padding:8px;background-color:#fff"><img src="a.png" alt="" width="40"></td></tr></table>')).toEqual([]);
  });
  it.each([
    ['<div style="display:flex">x</div>', "error:safety.flex-grid"],
    ['<td style="display: inline-grid">x</td>', "error:safety.flex-grid"],
    ['<td style="position:absolute">x</td>', "error:safety.position"],
    ["<script>x</script>", "error:safety.script"],
    ['<link rel="stylesheet" href="x.css">', "error:safety.external-stylesheet"],
    ['<img src="a.png" width="4">', "warning:safety.img-alt"],
    ['<img src="a.png" alt="x">', "warning:safety.img-width"],
    ['<div style="width:300px">x</div>', "warning:safety.div-layout"],
    ['<td style="background-image:url(a.png)">x</td>', "warning:safety.bg-image-fallback"],
  ])("flags %s", (html, expected) => {
    expect(lint(html)).toEqual([expected]);
  });
  it("flags a template <style> tag, and @import inside it", () => {
    expect(lint("<style>@import url(x.css); .a{}</style>")).toEqual(["warning:safety.style-tag", "error:safety.import"]);
  });
  it("names the state for an empty image src", () => {
    const issues = checkEmailSafety(def(), [{ state: "empty", html: '<img src="" alt="" width="4">' }]);
    expect(issues).toEqual([expect.objectContaining({ ruleId: "safety.empty-img-src", severity: "warning" })]);
    expect(issues[0].message).toContain("empty");
    // Liquid treats "" as truthy, and a cleared field is "", so a bare
    // `{% if <field> %}` guard still renders the image.
    expect(issues[0].message).toContain("`{% if <field> != blank %}`");
  });
  it("checks the stylesheet: @import is an error, unprefixed classes warn, url() and decimals don't false-positive", () => {
    expect(lint("<p>x</p>", '@import "x.css"; .tplc-promo-a { margin: 0.5em; background: url(x.png); } .hero {}'))
      .toEqual(["error:safety.import", "warning:safety.unscoped-class"]);
  });
  it.each([
    [".tplc-promo-a { display: flex; }", "error:safety.flex-grid"],
    [".tplc-promo-a{display:inline-grid}", "error:safety.flex-grid"],
    [".tplc-promo-a {\n  position: fixed;\n}", "error:safety.position"],
  ])("checks layout in the stylesheet: %s", (css, expected) => {
    const issues = checkEmailSafety(def(css), [{ state: "defaults", html: "<p>x</p>" }]);
    expect(issues.map((i) => `${i.severity}:${i.ruleId}:${i.path}`)).toEqual([`${expected}:/stylesheet`]);
  });
  it("leaves harmless stylesheet display and position values alone", () => {
    expect(lint("<p>x</p>", ".tplc-promo-a { display: block; position: relative; }")).toEqual([]);
  });
  it("checks layout inside a template <style> tag", () => {
    expect(lint("<style>.a { display: grid } .b{position:absolute}</style>"))
      .toEqual(["warning:safety.style-tag", "error:safety.flex-grid", "error:safety.position"]);
  });
  it("de-duplicates the same finding across states", () => {
    const r = checkEmailSafety(def(), [
      { state: "defaults", html: '<div style="display:flex"></div>' },
      { state: "long", html: '<div style="display:flex"></div>' },
    ]);
    expect(r.map((i) => i.ruleId)).toEqual(["safety.flex-grid"]);
  });
});

describe("stripCssComments", () => {
  it("removes closed comments and keeps the text around them", () => {
    expect(stripCssComments("a/* x */b/**/c")).toBe("abc");
  });
  it("drops everything after an unterminated comment", () => {
    expect(stripCssComments("a{}/* never closed")).toBe("a{}");
  });
  it("leaves text without comments untouched", () => {
    expect(stripCssComments(".a { color: red }")).toBe(".a { color: red }");
  });
  it("scans adversarial input in linear time", () => {
    for (const input of ["/*" + "a/*".repeat(50000), "/*/".repeat(60000), "/* */".repeat(40000)]) {
      const t = performance.now();
      stripCssComments(input);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});

describe("stripCssUrlsAndStrings", () => {
  it("removes url(...) and quoted strings, keeping selectors", () => {
    expect(stripCssUrlsAndStrings('.a { background: URL(x.png) } .b::after { content: "x.y" } .c { font: \'p.q\' }'))
      .toBe(".a { background:  } .b::after { content:  } .c { font:  }");
  });
  it("drops everything after an unterminated url( or quote", () => {
    expect(stripCssUrlsAndStrings(".a{} url(never closed .b{}")).toBe(".a{} ");
    expect(stripCssUrlsAndStrings('.a{} "never closed .b{}')).toBe(".a{} ");
  });
  it("leaves text without urls or strings untouched", () => {
    expect(stripCssUrlsAndStrings(".a { color: red } .curl { x: 1 }")).toBe(".a { color: red } .curl { x: 1 }");
  });
  it("scans adversarial input in linear time", () => {
    for (const input of ["url(".repeat(50000), "uRl(".repeat(50000), '"'.repeat(1) + "a".repeat(200000), "url(\")".repeat(40000)]) {
      const t = performance.now();
      stripCssUrlsAndStrings(input);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});
