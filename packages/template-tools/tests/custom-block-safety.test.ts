import { describe, expect, it } from "vitest";
import { checkEmailSafety, stripCssComments, stripCssUrlsAndStrings } from "../src/custom-block/safety";

const def = (stylesheet = "") => ({ type: "promo", name: "P", fields: [], template: "", stylesheet }) as never;
const lint = (html: string, stylesheet = "", state = "defaults") =>
  checkEmailSafety(def(stylesheet), [{ state: state as never, html }]).map((i) => `${i.severity}:${i.ruleId}`);

describe("checkEmailSafety authoring rules", () => {
  it("keeps only authoring diagnostics", () => {
    const issues = checkEmailSafety(def(), [{ state: "defaults", html: '<style>p{color:red}</style><img src="" width="4"><img src="a.png" alt="x">' }]);
    expect(issues.map((issue) => issue.ruleId)).toEqual([
      "safety.style-tag", "safety.img-alt", "safety.empty-img-src", "safety.img-width",
    ]);
    expect(issues[2].message).toContain('"defaults" state');
    expect(issues[2].suggestion).toBe("Wrap the image in a Liquid condition that checks the source against blank.");
  });

  it("finds unscoped stylesheet classes without reading URLs or strings", () => {
    const issues = checkEmailSafety(def('.tplc-promo-a { background: url(icon.png); content: "x.y" } .hero {}'), [{ state: "defaults", html: "<p>x</p>" }]);
    expect(issues.map(({ ruleId, severity, path }) => ({ ruleId, severity, path }))).toEqual([
      { ruleId: "safety.unscoped-class", severity: "warning", path: "/stylesheet" },
    ]);
    expect(issues[0].suggestion).toBe("Prefix each class with tplc-promo-.");
  });

  it("does not duplicate authoring findings across specimen states", () => {
    const issues = checkEmailSafety(def(), [
      { state: "defaults", html: "<style>p{color:red}</style>" },
      { state: "long", html: "<style>p{color:red}</style>" },
    ]);
    expect(issues.map((issue) => issue.ruleId)).toEqual(["safety.style-tag"]);
  });

  it("does not repeat client-fact diagnostics", () => {
    expect(lint('<div style="display:flex;position:absolute;width:200px"><svg></svg><form></form></div>')).toEqual([]);
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
