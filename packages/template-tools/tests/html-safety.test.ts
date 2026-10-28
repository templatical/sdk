import { describe, expect, it } from "vitest";

describe("translation HTML safety", () => {
  it.each(["</table>", "</mj-text>", "<p>x</div>"])(
    "rejects explicit disallowed closing tags in %s without reading attribute text as tags",
    async (html) => {
      const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
      expect(isSafeTranslationHtml(html)).toBe(false);
      expect(
        isSafeTranslationHtml('<p title="</table> </mj-text> <div>">x</p>'),
      ).toBe(true);
    },
  );
  it.each([
    "<script>alert(1)</script>",
    '<img onerror="alert(1)" src="x">',
    '<a href=" JavaScript:alert(1)">x</a>',
    '<a href="&#x6a;avascript:alert(1)">x</a>',
    '<span ONCLICK="alert(1)">x</span>',
    '<span src=" javascript:x">x</span>',
    '<iframe src="https://x.test"></iframe>',
    '<x id="1"/>',
  ])("rejects %s", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(false);
  });
  it.each([
    '<p><strong>Hi</strong> <a href="https://x.test">x</a></p>',
    "<p><b>B</b><em>E</em><i>I</i><u>U</u><s>S</s><br><span>Text</span></p>",
    '<span data-merge-tag="{{name}}">Name</span><span data-logic-merge-tag="{% endif %}">ENDIF</span>',
  ])("accepts %s", async (html) => {
    const { isSafeTranslationHtml } = await import("../src/cli/html-safety");
    expect(isSafeTranslationHtml(html)).toBe(true);
  });
});
