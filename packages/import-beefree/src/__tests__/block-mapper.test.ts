import { describe, it, expect } from "vitest";
import { convertModule } from "../block-mapper";
import type { BeeFreeeModule } from "../types";

function makeModule(
  type: string,
  descriptor: BeeFreeeModule["descriptor"],
): BeeFreeeModule {
  return { type, descriptor };
}

describe("convertModule", () => {
  describe("text", () => {
    it("converts text module with HTML content", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        style: {
          "padding-top": "5px",
          "padding-right": "10px",
          "padding-bottom": "5px",
          "padding-left": "10px",
        },
        text: {
          style: {
            color: "#555555",
            "font-size": "14px",
            "text-align": "center",
          },
          html: "<p>Hello World</p>",
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<p>Hello World</p>");
        expect(block.color).toBe("#555555");
        expect(block.fontSize).toBe(14);
        expect(block.textAlign).toBe("center");
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("text");
      expect(warnings).toHaveLength(0);
    });

    it("uses default styles when no text style provided", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        text: {
          html: "<p>Plain</p>",
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<p>Plain</p>");
        expect(block.fontSize).toBe(16);
        expect(block.color).toBe("#333333");
        expect(block.textAlign).toBe("left");
      }
    });
  });

  describe("heading", () => {
    it("converts heading module with text and tag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h1",
          text: "Big Title",
          style: {
            "font-size": "32px",
            color: "#111111",
            "text-align": "center",
            "font-weight": "bold",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<h1>Big Title</h1>");
        expect(block.fontSize).toBe(32);
        expect(block.color).toBe("#111111");
        expect(block.textAlign).toBe("center");
        expect(block.fontWeight).toBe("bold");
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("image", () => {
    it("converts image with src, alt, width", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-image", {
        image: {
          src: "https://example.com/photo.jpg",
          alt: "A photo",
          width: "300px",
          href: "https://example.com",
          style: {
            "text-align": "center",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("image");
      if (block.type === "image") {
        expect(block.src).toBe("https://example.com/photo.jpg");
        expect(block.alt).toBe("A photo");
        expect(block.width).toBe(300);
        expect(block.linkUrl).toBe("https://example.com");
        expect(block.align).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });

    it("creates default block when no image descriptor", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-image", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("image");
      if (block.type === "image") {
        expect(block.src).toBe("");
      }
    });
  });

  describe("button", () => {
    it("strips HTML tags from button label", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: {
          label: "<span>Click <b>Me</b></span>",
          href: "https://example.com",
          style: {
            "background-color": "#ff0000",
            color: "#ffffff",
            "border-radius": "8px",
            "font-size": "18px",
          },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.text).toBe("Click Me");
        expect(block.url).toBe("https://example.com");
        expect(block.backgroundColor).toBe("#ff0000");
        expect(block.textColor).toBe("#ffffff");
        expect(block.borderRadius).toBe(8);
        expect(block.fontSize).toBe(18);
      }
    });

    it("uses default styles when no button descriptor", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.backgroundColor).toBe("#007bff");
        expect(block.textColor).toBe("#ffffff");
      }
    });
  });

  describe("divider", () => {
    it("parses border-top from divider style", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-divider", {
        divider: {
          style: {
            "border-top": "3px dashed #aabbcc",
            width: "75%",
          },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("divider");
      if (block.type === "divider") {
        expect(block.thickness).toBe(3);
        expect(block.lineStyle).toBe("dashed");
        expect(block.color).toBe("#aabbcc");
        expect(block.width).toBe(75);
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("spacer", () => {
    it("uses height from descriptor or defaults to 20", () => {
      const warnings: string[] = [];

      const withHeight = makeModule("mailup-bee-newsletter-modules-spacer", {
        spacer: { style: { height: "40px" } },
      });
      const { block: b1 } = convertModule(withHeight, warnings);
      expect(b1.type).toBe("spacer");
      if (b1.type === "spacer") {
        expect(b1.height).toBe(40);
      }

      const noHeight = makeModule("mailup-bee-newsletter-modules-spacer", {});
      const { block: b2 } = convertModule(noHeight, warnings);
      expect(b2.type).toBe("spacer");
      if (b2.type === "spacer") {
        expect(b2.height).toBe(20);
      }
    });
  });

  describe("social", () => {
    it("maps known platform names to SocialPlatform values", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              name: "facebook",
              image: { href: "https://facebook.com/page" },
            },
            {
              name: "twitter",
              image: { href: "https://twitter.com/user" },
            },
            {
              id: "instagram",
              image: { href: "https://instagram.com/user" },
            },
          ],
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(3);
        expect(block.icons[0].platform).toBe("facebook");
        expect(block.icons[0].url).toBe("https://facebook.com/page");
        expect(block.icons[1].platform).toBe("twitter");
        expect(block.icons[2].platform).toBe("instagram");
      }
      expect(warnings).toHaveLength(0);
    });

    it("warns and skips unknown platforms", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            { name: "facebook", image: { href: "#" } },
            { name: "myspace", image: { href: "#" } },
          ],
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(1);
        expect(block.icons[0].platform).toBe("facebook");
      }
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("myspace");
    });

    it("creates default block when no iconsList", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-social", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("social");
      if (block.type === "social") {
        expect(block.icons).toHaveLength(0);
      }
    });
  });

  describe("video", () => {
    it("converts video with src and thumbnail", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-video", {
        video: {
          src: "https://youtube.com/watch?v=abc",
          thumbnail: "https://img.youtube.com/vi/abc/0.jpg",
          alt: "Video",
          style: { width: "500px", "text-align": "center" },
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("video");
      if (block.type === "video") {
        expect(block.url).toBe("https://youtube.com/watch?v=abc");
        expect(block.thumbnailUrl).toBe("https://img.youtube.com/vi/abc/0.jpg");
        expect(block.alt).toBe("Video");
        expect(block.width).toBe(500);
        expect(block.align).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("menu", () => {
    it("converts menu items with separator and colors", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {
        menu: {
          items: [
            { text: "Home", link: "https://example.com", target: "_blank" },
            { text: "About", href: "https://example.com/about" },
          ],
          separator: "-",
          separatorColor: "#666666",
          style: {
            "font-size": "12px",
            color: "#444444",
            "text-align": "center",
          },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("menu");
      if (block.type === "menu") {
        expect(block.items).toHaveLength(2);
        expect(block.items[0].text).toBe("Home");
        expect(block.items[0].url).toBe("https://example.com");
        expect(block.items[0].openInNewTab).toBe(true);
        expect(block.items[1].text).toBe("About");
        expect(block.items[1].url).toBe("https://example.com/about");
        expect(block.items[1].openInNewTab).toBe(false);
        expect(block.separator).toBe("-");
        expect(block.separatorColor).toBe("#666666");
        expect(block.fontSize).toBe(12);
        expect(block.color).toBe("#444444");
      }
    });

    it("report entry has isApproximation status", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {
        menu: {
          items: [{ text: "Link", link: "#" }],
        },
      });

      const { entry } = convertModule(mod, warnings);

      expect(entry.status).toBe("approximated");
      expect(entry.templaticalBlockType).toBe("menu");
    });
  });

  describe("table", () => {
    it("converts rows and cells", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [
            { cells: [{ content: "A1" }, { content: "B1" }] },
            { cells: [{ html: "A2" }, { content: "B2" }] },
          ],
          style: {
            "border-color": "#eeeeee",
            "border-width": "2px",
            "font-size": "13px",
            color: "#222222",
            "text-align": "center",
          },
          cellPadding: 10,
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        expect(block.rows).toHaveLength(2);
        expect(block.rows[0].cells).toHaveLength(2);
        expect(block.rows[0].cells[0].content).toBe("A1");
        expect(block.rows[0].cells[1].content).toBe("B1");
        expect(block.rows[1].cells[0].content).toBe("A2");
        expect(block.borderColor).toBe("#eeeeee");
        expect(block.borderWidth).toBe(2);
        expect(block.cellPadding).toBe(10);
        expect(block.fontSize).toBe(13);
        expect(block.color).toBe("#222222");
        expect(block.textAlign).toBe("center");
      }
      expect(entry.status).toBe("converted");
    });

    it("respects hasHeaderRow flag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [{ cells: [{ content: "Header" }] }],
          hasHeaderRow: true,
          headerBackgroundColor: "#dddddd",
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        expect(block.hasHeaderRow).toBe(true);
        expect(block.headerBackgroundColor).toBe("#dddddd");
      }
    });
  });

  describe("html", () => {
    it("passes through HTML content", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-html", {
        html: {
          html: '<div class="custom">Custom HTML</div>',
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe('<div class="custom">Custom HTML</div>');
      }
      expect(entry.status).toBe("converted");
    });
  });

  describe("edge cases", () => {
    it("convertText with all content sources undefined returns empty", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {});
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("");
      }
    });

    it("convertHeading without heading falls back to convertText", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        text: { html: "<p>Fallback text</p>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<p>Fallback text</p>");
      }
    });

    it("convertHeading without title defaults to h2 tag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { text: "Untitled" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<h2>Untitled</h2>");
      }
    });

    it("convertHeading does not double-wrap when text already has HTML tag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { title: "h1", text: "<h1>Already Tagged</h1>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("text");
      if (block.type === "text") {
        expect(block.content).toBe("<h1>Already Tagged</h1>");
        // Must NOT double-wrap to <h1><h1>...</h1></h1>
        expect(block.content).not.toContain("<h1><h1>");
      }
    });
  });

  describe("unknown type", () => {
    it("falls back to HTML block with html-fallback status", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-magic-widget", {
        text: {
          html: "<p>Some content</p>",
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("html");
      if (block.type === "html") {
        expect(block.content).toBe("<p>Some content</p>");
      }
      expect(entry.status).toBe("html-fallback");
      expect(entry.templaticalBlockType).toBe("html");
      expect(entry.note).toContain("Unknown module type");
    });

    it("tries multiple descriptor fields for content extraction", () => {
      const warnings: string[] = [];

      // Falls back to html.html
      const mod1 = makeModule("some-unknown-type", {
        html: { html: "<div>Fallback HTML</div>" },
      });
      const { block: b1 } = convertModule(mod1, warnings);
      if (b1.type === "html") {
        expect(b1.content).toBe("<div>Fallback HTML</div>");
      }

      // Falls back to heading.text
      const mod2 = makeModule("some-unknown-type", {
        heading: { text: "Heading fallback" },
      });
      const { block: b2 } = convertModule(mod2, warnings);
      if (b2.type === "html") {
        expect(b2.content).toBe("Heading fallback");
      }

      // Falls back to comment when nothing found
      const mod3 = makeModule("some-unknown-type", {});
      const { block: b3 } = convertModule(mod3, warnings);
      if (b3.type === "html") {
        expect(b3.content).toContain("Unsupported BeeFree module");
        expect(b3.content).toContain("some-unknown-type");
      }
    });
  });
});
