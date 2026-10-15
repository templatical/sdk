import { describe, expect, it } from "vitest";
import { checkAccessibility } from "../src/custom-block/a11y";

const check = (html: string, state = "defaults") =>
  checkAccessibility([{ state: state as never, html }]);
const ids = (html: string) => check(html).map((i) => `${i.severity}:${i.ruleId}`);

describe("checkAccessibility", () => {
  it("passes a layout table with named links and readable colours", () => {
    expect(
      ids(
        '<table role="presentation"><tr><td style="background-color:#ffffff"><a href="/p" style="color:#1a1a1a">Shop the spring range</a> <a href="/t" aria-label="Twitter"><img src="t.png" alt="" width="20"></a></td></tr></table>',
      ),
    ).toEqual([]);
  });

  it("reports vague link text with quality's own message", () => {
    expect(check('<p><a href="/x">Click here</a></p>')).toEqual([
      expect.objectContaining({ ruleId: "a11y.link-vague-text", severity: "warning", message: expect.stringContaining("Click here") }),
    ]);
  });

  it("reports a link with no name, naming the state", () => {
    expect(check('<a href="/x"><img src="i.png" alt=""></a>', "empty")).toEqual([
      {
        ruleId: "a11y.link-no-name",
        severity: "warning",
        message: 'A link has no text, `aria-label` or image `alt` in the "empty" state, so a screen reader announces only "link".',
      },
    ]);
    expect(ids('<a href="/x"><img src="i.png" alt="Twitter"></a>')).toEqual([]);
    expect(ids('<a href="/x" title="Twitter"></a>')).toEqual([]);
  });

  it("asks a layout table for role=presentation, and leaves data tables alone", () => {
    expect(ids("<table><tr><td>x</td></tr></table>")).toEqual(["warning:a11y.table-role"]);
    expect(ids('<table role="none"><tr><td>x</td></tr></table>')).toEqual([]);
    expect(ids("<table><tr><th>Plan</th></tr><tr><td>Pro</td></tr></table>")).toEqual([]);
  });

  it("checks contrast where both colours are inline, inheriting from ancestors", () => {
    expect(check('<td style="background-color:#ffffff"><p style="color:#cccccc">Hi</p></td>')).toEqual([
      {
        ruleId: "a11y.contrast",
        severity: "warning",
        message: "Text in #cccccc on #ffffff has 1.61:1 contrast; it needs 4.5:1.",
      },
    ]);
    expect(ids('<td bgcolor="#000000"><span style="color:#222222">x</span></td>')).toEqual(["warning:a11y.contrast"]);
    expect(ids('<td style="background: #ffffff url(a.png)"><p style="color:#bbbbbb">x</p></td>')).toEqual(["warning:a11y.contrast"]);
  });

  it("relaxes to 3:1 for 24px text and skips text with only one known colour", () => {
    expect(ids('<td style="background-color:#ffffff"><p style="color:#888888;font-size:24px">Big</p></td>')).toEqual([]);
    expect(ids('<td style="background-color:#ffffff"><p style="color:#888888">Small</p></td>')).toEqual(["warning:a11y.contrast"]);
    expect(ids('<p style="color:#eeeeee">No background known</p>')).toEqual([]);
  });

  it("reads a background colour in linear time", () => {
    const t = performance.now();
    expect(ids(`<td style="background: #ffffff ${"url(".repeat(50000)}"><p style="color:#cccccc">x</p></td>`)).toEqual(["warning:a11y.contrast"]);
    expect(performance.now() - t).toBeLessThan(1000);
  });

  it("pops a void element's frame, so a later sibling doesn't inherit its parent's background", () => {
    expect(ids('<div style="background-color:#000000"><img src="a.png" alt="a" width="1"></div><p style="color:#111111">x</p>')).toEqual([]);
  });
});
