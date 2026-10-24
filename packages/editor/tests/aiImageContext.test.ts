// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Block, TemplateContent } from "@templatical/types";
import { aiImageContext } from "../src/utils/aiImageContext";
const text = (id: string, content: string, type = "paragraph") =>
  (type === "button"
    ? { id, type, text: content }
    : { id, type, content }) as Block;
const image = {
  id: "img",
  type: "image",
  src: "https://example.com/a.png",
  alt: "Old",
  linkUrl: "https://example.com/shop",
} as Block;
const content = (blocks: Block[]) =>
  ({ blocks, settings: { locale: "en" } }) as TemplateContent;
const section = (children: Block[][]) =>
  ({ id: "s", type: "section", columns: "2", children }) as Block;
describe("aiImageContext", () => {
  it("reads an image inside a wrapper with its nearest text and link", () => {
    const input = content([
      {
        id: "wrapper",
        type: "wrapper",
        children: [
          text("before", "<h1>Autumn &amp; winter</h1>", "title"),
          image,
          text("after", "<b>Shop now</b>", "button"),
        ],
      } as Block,
    ]);
    expect(aiImageContext(input, "img")).toEqual({
      url: "https://example.com/a.png",
      currentAlt: "Old",
      linkHref: "https://example.com/shop",
      nearbyText: "Autumn & winter\nShop now",
    });
  });
  it("uses src, alt and linkUrl and the nearest text on each side in its column", () => {
    const input = content([
      section([
        [
          text("far", "Far"),
          text("before", "<h1>Autumn &amp; winter</h1>", "title"),
          image,
          { id: "sp", type: "spacer", height: 10 } as Block,
          text("after", "<b>Shop now</b>", "button"),
          text("far2", "Far after"),
        ],
        [text("other", "Other column")],
      ]),
    ]);
    expect(aiImageContext(input, "img")).toEqual({
      url: "https://example.com/a.png",
      currentAlt: "Old",
      linkHref: "https://example.com/shop",
      nearbyText: "Autumn & winter\nShop now",
    });
  });
  it("falls back to the containing section when the column has no text", () => {
    expect(
      aiImageContext(
        content([
          section([
            [text("before", "Before", "title")],
            [image],
            [text("after", "After", "button")],
          ]),
        ]),
        "img",
      )?.nearbyText,
    ).toBe("Before\nAfter");
  });
  it("does not borrow text from another section", () => {
    expect(
      aiImageContext(
        content([
          section([[image]]),
          {
            id: "s2",
            type: "section",
            columns: "1",
            children: [[text("other", "Outside")]],
          } as Block,
        ]),
        "img",
      )?.nearbyText,
    ).toBe("");
  });
  it("uses null for empty or decorative alt and absent links, ignoring placeholderUrl", () => {
    expect(
      aiImageContext(
        content([{ ...image, alt: "", linkUrl: "" } as Block]),
        "img",
      ),
    ).toMatchObject({ currentAlt: null, linkHref: null });
    expect(
      aiImageContext(content([{ ...image, decorative: true } as Block]), "img")
        ?.currentAlt,
    ).toBeNull();
    expect(
      aiImageContext(
        content([
          {
            ...image,
            src: "",
            placeholderUrl: "https://example.com/p.png",
          } as Block,
        ]),
        "img",
      ),
    ).toBeNull();
  });
  it("caps context at 2,000 code points without splitting supplementary characters", () => {
    const result = aiImageContext(
      content([text("before", "😀".repeat(2001)), image]),
      "img",
    )!;
    expect(Array.from(result.nearbyText)).toHaveLength(2000);
    expect(result.nearbyText).toBe("😀".repeat(2000));
  });
  it("returns null for missing blocks, non-images and missing src", () => {
    expect(aiImageContext(content([image]), "missing")).toBeNull();
    expect(aiImageContext(content([text("p", "Hi")]), "p")).toBeNull();
    expect(
      aiImageContext(content([{ id: "img", type: "image" } as Block]), "img"),
    ).toBeNull();
  });
});
