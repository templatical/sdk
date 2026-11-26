import { describe, expect, it } from "vitest";
import { stripOutlookLineHeight } from "../outlook-line-height";

describe("stripOutlookLineHeight", () => {
  it("stops at an unterminated open tag", () => {
    const input = '<p style="mso-line-height-alt:21px';
    expect(stripOutlookLineHeight(input)).toBe(input);
  });

  it("ignores style text inside another attribute and strips a real style", () => {
    expect(
      stripOutlookLineHeight(
        `<p title="Example style='mso-line-height-alt:21px'" style="color:red;mso-line-height-alt:21px">Text</p>`,
      ),
    ).toBe(
      `<p title="Example style='mso-line-height-alt:21px'" style="color:red">Text</p>`,
    );
  });

  it.each([
    [
      '<li style="a:b;mso-line-height-alt:1px;c:d">X</li>',
      '<li style="a:b;c:d">X</li>',
    ],
    [
      '<h2 style="mso-line-height-alt:1px;c:d">X</h2>',
      '<h2 style="c:d">X</h2>',
    ],
  ])("strips the alternate on a foreign block element", (input, expected) => {
    expect(stripOutlookLineHeight(input)).toBe(expected);
  });
});
