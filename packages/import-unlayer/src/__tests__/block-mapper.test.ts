import { describe, it, expect } from "vitest";
import { convertContent } from "../block-mapper";
import type { UnlayerContent, UnlayerContentValues } from "../types";

function makeContent(
  type: string,
  values: Partial<UnlayerContentValues>,
): UnlayerContent {
  return { type, values: values as UnlayerContentValues };
}

describe("convertContent", () => {
  describe("text", () => {
    it("converts text content with inline color, font-size, alignment", () => {
      const warnings: string[] = [];
      const content = makeContent("text", {
        text: "<p>Hello World</p>",
        color: "#555555",
        fontSize: "14px",
        textAlign: "center",
        containerPadding: "5px 10px",
      });

      const { block, entry } = convertContent(content, warnings);

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toContain("Hello World");
        expect(block.content).toContain("color: #555555");
        expect(block.content).toContain("font-size: 14px");
        expect(block.content).toContain("text-align: center");
        expect(block.styles?.padding).toEqual({
          top: 5,
          right: 10,
          bottom: 5,
          left: 10,
        });
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("paragraph");
      expect(warnings).toHaveLength(0);
    });

    it("leaves content untouched when no non-default styles provided", () => {
      const { block } = convertContent(
        makeContent("text", { text: "<p>Plain</p>" }),
        [],
      );

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("<p>Plain</p>");
      }
    });

    it("wraps bare text in <p> tags", () => {
      const { block } = convertContent(
        makeContent("text", { text: "Bare" }),
        [],
      );

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("<p>Bare</p>");
      }
    });
  });

  describe("heading", () => {
    it("maps headingType to level and applies styles", () => {
      const { block, entry } = convertContent(
        makeContent("heading", {
          headingType: "h1",
          text: "Big Title",
          color: "#111111",
          textAlign: "center",
          fontFamily: { value: "Helvetica, Arial, sans-serif" },
        }),
        [],
      );

      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.level).toBe(1);
        expect(block.color).toBe("#111111");
        expect(block.textAlign).toBe("center");
        expect(block.fontFamily).toBe("Helvetica");
        expect(block.content).toContain("Big Title");
      }
      expect(entry.status).toBe("converted");
    });

    it("falls back to level 2 for missing/invalid headingType", () => {
      const { block } = convertContent(
        makeContent("heading", { text: "x" }),
        [],
      );
      if (block.type === "title") {
        expect(block.level).toBe(2);
      }
    });
  });

  describe("image", () => {
    it("maps src/alt/link/align", () => {
      const { block, entry } = convertContent(
        makeContent("image", {
          src: { url: "https://cdn.test/i.jpg", width: 480, height: 200 },
          altText: "alt",
          textAlign: "left",
          action: {
            name: "web",
            values: { href: "https://x.test", target: "_blank" },
          },
        }),
        [],
      );

      expect(block.type).toBe("image");
      if (block.type === "image") {
        expect(block.src).toBe("https://cdn.test/i.jpg");
        expect(block.alt).toBe("alt");
        expect(block.width).toBe(480);
        expect(block.align).toBe("left");
        expect(block.linkUrl).toBe("https://x.test");
        expect(block.linkOpenInNewTab).toBe(true);
      }
      expect(entry.status).toBe("converted");
    });

    it("defaults width to 600 when src.width missing", () => {
      const { block } = convertContent(
        makeContent("image", { src: { url: "u" } }),
        [],
      );
      if (block.type === "image") {
        expect(block.width).toBe(600);
        expect(block.align).toBe("center");
      }
    });
  });

  describe("button", () => {
    it("maps text, href, colors, padding, fontSize", () => {
      const { block, entry } = convertContent(
        makeContent("button", {
          text: "<span>Click me</span>",
          href: { name: "web", values: { href: "https://t.test" } },
          buttonColors: { color: "#ffffff", backgroundColor: "#222222" },
          borderRadius: "8px",
          padding: "10px 20px",
          fontSize: "18px",
        }),
        [],
      );

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.text).toBe("Click me");
        expect(block.url).toBe("https://t.test");
        expect(block.backgroundColor).toBe("#222222");
        expect(block.textColor).toBe("#ffffff");
        expect(block.borderRadius).toBe(8);
        expect(block.fontSize).toBe(18);
        expect(block.buttonPadding).toEqual({
          top: 10,
          right: 20,
          bottom: 10,
          left: 20,
        });
      }
      expect(entry.status).toBe("converted");
    });

    it("uses default url '#' when href missing", () => {
      const { block } = convertContent(
        makeContent("button", { text: "Hi" }),
        [],
      );
      if (block.type === "button") {
        expect(block.url).toBe("#");
      }
    });
  });

  describe("divider", () => {
    it("maps border object and width", () => {
      const { block, entry } = convertContent(
        makeContent("divider", {
          border: {
            borderTopWidth: "2px",
            borderTopStyle: "dashed",
            borderTopColor: "#cccccc",
          },
          width: "80%",
        }),
        [],
      );

      expect(block.type).toBe("divider");
      if (block.type === "divider") {
        expect(block.thickness).toBe(2);
        expect(block.lineStyle).toBe("dashed");
        expect(block.color).toBe("#cccccc");
        expect(block.width).toBe(80);
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("html", () => {
    it("passes html through", () => {
      const { block, entry } = convertContent(
        makeContent("html", { html: "<div>raw</div>" }),
        [],
      );

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe("<div>raw</div>");
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("menu", () => {
    it("maps items and marks status as approximated", () => {
      const { block, entry } = convertContent(
        makeContent("menu", {
          menu: {
            items: [
              {
                key: "1",
                text: "About",
                link: { name: "web", values: { href: "/about" } },
              },
              {
                key: "2",
                text: "Contact",
                link: {
                  name: "web",
                  values: { href: "/contact", target: "_blank" },
                },
              },
            ],
          },
          separator: "-",
          fontSize: "14px",
        }),
        [],
      );

      expect(block.type).toBe("menu");
      if (block.type === "menu") {
        expect(block.items).toHaveLength(2);
        expect(block.items[0].text).toBe("About");
        expect(block.items[0].url).toBe("/about");
        expect(block.items[1].openInNewTab).toBe(true);
        expect(block.separator).toBe("-");
      }
      expect(entry.status).toBe("approximated");
      expect(entry.note).toContain("approximately");
    });
  });

  describe("social", () => {
    it("maps recognized icons by name", () => {
      const warnings: string[] = [];
      const { block, entry } = convertContent(
        makeContent("social", {
          icons: {
            icons: [
              { name: "Facebook", url: "https://fb.test/p" },
              { name: "X", url: "https://x.test/p" },
              { name: "MySpace", url: "https://nope.test/p" },
            ],
          },
        }),
        warnings,
      );

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(2);
        expect(block.icons[0].platform).toBe("facebook");
        expect(block.icons[1].platform).toBe("twitter");
      }
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("MySpace");
      expect(entry.status).toBe("converted");
    });
  });

  describe("video", () => {
    it("maps videoUrl/thumbnailUrl", () => {
      const { block, entry } = convertContent(
        makeContent("video", {
          videoUrl: "https://yt.test/abc",
          thumbnailUrl: "https://yt.test/abc.jpg",
          altText: "demo",
        }),
        [],
      );

      expect(block.type).toBe("video");
      if (block.type === "video") {
        expect(block.url).toBe("https://yt.test/abc");
        expect(block.thumbnailUrl).toBe("https://yt.test/abc.jpg");
        expect(block.alt).toBe("demo");
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("timer", () => {
    it("returns html-fallback with explanatory note", () => {
      const { block, entry } = convertContent(makeContent("timer", {}), []);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toContain("timer");
      }
      expect(entry.status).toBe("html-fallback");
      expect(entry.templaticalBlockType).toBe("html");
    });
  });

  describe("form", () => {
    it("returns skipped status with null block type and note", () => {
      const { block, entry } = convertContent(makeContent("form", {}), []);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toContain("form");
      }
      expect(entry.status).toBe("skipped");
      expect(entry.templaticalBlockType).toBeNull();
      expect(entry.note).toContain("forms");
    });
  });

  describe("unknown type", () => {
    it("falls back to HtmlBlock with note", () => {
      const { block, entry } = convertContent(
        makeContent("custom-foobar", {}),
        [],
      );

      expect(block.type).toBe("html");
      expect(entry.status).toBe("html-fallback");
      expect(entry.note).toContain("custom-foobar");
    });
  });

  describe("spacer", () => {
    it("derives height from containerPadding fallback", () => {
      const { block } = convertContent(
        makeContent("spacer", { containerPadding: "12px 0" }),
        [],
      );
      expect(block.type).toBe("spacer");
      if (block.type === "spacer") {
        expect(block.height).toBe(24);
      }
    });
  });
});
