import { describe, it, expect } from "vitest";
import { convertModule, skippedModuleEntry } from "../block-mapper";
import type { BeeFreeeImageContent, BeeFreeeModule } from "../types";

function makeModule(
  type: string,
  descriptor: BeeFreeeModule["descriptor"],
): BeeFreeeModule {
  return { type, descriptor };
}

describe("convertModule", () => {
  describe("text", () => {
    it("converts text module with HTML content and inline styles", () => {
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

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toContain("Hello World");
        expect(block.content).toContain("color: #555555");
        expect(block.content).toContain("font-size: 14px");
        expect(block.content).toContain("text-align: center");
        // Styles should be on <p> and <span>, not on a <div> wrapper
        expect(block.content).not.toContain("<div");
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("paragraph");
      expect(warnings).toHaveLength(0);
    });

    it("uses plain content when no non-default text style provided", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        text: {
          html: "<p>Plain</p>",
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        // No inline wrapper when all styles are defaults
        expect(block.content).toBe("<p>Plain</p>");
      }
    });

    // Regression: the old `/<p([^>]*)>([\s\S]*?)<\/p>/g` wrap pattern was
    // polynomial-ReDoS — every `<p` start re-scanned the rest of the input
    // for `</p>`. Adversarial input with many `<p>a` chunks but no `</p>`
    // used to stall the regex. The manual scanner is strictly linear.
    it("wraps paragraph content in linear time on `<p>a<p>a<p>a…` input (ReDoS regression)", () => {
      const warnings: string[] = [];
      const adversarial = "<p>a".repeat(10_000);
      const mod = makeModule("mailup-bee-newsletter-modules-text", {
        text: {
          style: {
            // Non-default style triggers the wrap branch
            color: "#123456",
          },
          html: adversarial,
        },
      });
      const start = Date.now();
      const { block } = convertModule(mod, warnings);
      const elapsed = Date.now() - start;
      expect(block.type).toBe("paragraph");
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe("heading", () => {
    it("converts heading module to title block with level and styles", () => {
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

      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe("<p>Big Title</p>");
        expect(block.level).toBe(1);
        expect(block.color).toBe("#111111");
        expect(block.textAlign).toBe("center");
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

    // `image.width` × `image.height` is the file BeeFree was given (1920 × 466
    // for the hero in a real export), so carrying the height over pins the
    // file's height under a narrower shown width and stretches the image.
    it("never carries image.height over", () => {
      const warnings: string[] = [];
      const withHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", width: "300px", height: "180px" },
        }),
        warnings,
      ).block;
      const auto = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", height: "auto" },
        }),
        warnings,
      ).block;

      if (withHeight.type !== "image" || auto.type !== "image")
        throw new Error("expected image blocks");
      expect(withHeight.width).toBe(300);
      expect(withHeight.height).toBeUndefined();
      expect(auto.height).toBeUndefined();
    });

    describe("shown width", () => {
      function shown(
        descriptor: BeeFreeeModule["descriptor"],
        columnWidth?: number,
      ) {
        const block = convertModule(
          makeModule("mailup-bee-newsletter-modules-image", descriptor),
          [],
          { columnWidth },
        ).block;
        if (block.type !== "image") throw new Error("expected an image block");
        return block;
      }

      // The two images of the real export in fixtures/example-1.json.
      it("reads computedStyle, not the file's size", () => {
        const logo = shown(
          {
            image: { src: "l.png", width: "254px", height: "59px" },
            computedStyle: { class: "left fixedwidth", width: "172.5px" },
          },
          600,
        );
        expect([logo.width, logo.height, logo.align]).toEqual([
          173,
          undefined,
          "left",
        ]);

        const hero = shown(
          {
            image: { src: "h.jpg", width: "1920px", height: "466px" },
            computedStyle: { class: "center autowidth", width: "600px" },
          },
          600,
        );
        expect([hero.width, hero.height, hero.align]).toEqual([
          "full",
          undefined,
          "center",
        ]);
      });

      it("stores the file's size as the natural size, only when both are stated", () => {
        const both = shown({
          image: { src: "p.jpg", width: "1920px", height: "466px" },
        });
        expect([both.naturalWidth, both.naturalHeight]).toEqual([1920, 466]);
        const auto = shown({
          image: { src: "p.jpg", width: "1920px", height: "auto" },
        });
        expect([auto.naturalWidth, auto.naturalHeight]).toEqual([
          undefined,
          undefined,
        ]);
      });

      // BeeFree shows an autowidth image at its file's width, capped at the
      // column, and records that in computedStyle.width: a 111px logo stays
      // 111px in an 800px template (#1069).
      it("shows an autowidth image at its computed width", () => {
        const logo = shown(
          {
            image: { src: "logo.png", alt: "Logo" },
            computedStyle: { class: "center autowidth", width: "111px" },
          },
          800,
        );
        expect([logo.width, logo.align]).toEqual([111, "center"]);
      });

      it("is full when an autowidth image's computed width reaches the room", () => {
        const at = (px: number) =>
          shown(
            {
              image: { src: "p.png" },
              computedStyle: { class: "autowidth", width: `${px}px` },
            },
            600,
          ).width;
        expect(at(600)).toBe("full");
        expect(at(599)).toBe(599);
      });

      it("falls back to the file's width for an autowidth image without a computed width", () => {
        const at = (file: string) =>
          shown(
            {
              image: { src: "p.png", width: file },
              computedStyle: { class: "center autowidth" },
            },
            600,
          ).width;
        expect(at("240px")).toBe(240);
        expect(at("1920px")).toBe("full");
      });

      // Older exports mark an image that fills its column `fullwidth`, and
      // record a computed width that leaves out the column's padding.
      it("imports a fullwidth image as full", () => {
        const image = shown(
          {
            image: { src: "p.png" },
            computedStyle: {
              class: "center  autowidth  fullwidth",
              width: 230,
            },
          },
          250,
        );
        expect(image.width).toBe("full");
      });

      // Older exports write computedStyle.width as a number of pixels.
      it("reads a numeric computed width", () => {
        const at = (width: number, columnWidth: number) =>
          shown(
            {
              image: { src: "p.png" },
              computedStyle: { class: "center fixedwidth", width },
            },
            columnWidth,
          ).width;
        expect(at(187.5, 250)).toBe(188);
        expect(at(500, 500)).toBe("full");
      });

      // The block stores px, which keeps its size on a phone where a
      // percentage would shrink, so a percentage under 100% is approximated.
      it("converts a computed percentage to px of the room", () => {
        const at = (width: string) => {
          const { block, entry } = convertModule(
            makeModule("mailup-bee-newsletter-modules-image", {
              image: { src: "p.png", width: "1920px" },
              computedStyle: { class: "center fixedwidth", width },
              style: { "padding-left": "10px", "padding-right": "10px" },
            }),
            [],
            { columnWidth: 600 },
          );
          if (block.type !== "image") throw new Error("expected an image");
          return { width: block.width, status: entry.status, note: entry.note };
        };
        expect(at("50%")).toEqual({
          width: 290,
          status: "approximated",
          note: "Image width 50% was converted to 290px.",
        });
        expect(at("33.3%").width).toBe(193);
        expect(at("100%")).toEqual({
          width: "full",
          status: "converted",
          note: undefined,
        });
        expect(at(" 120% ").width).toBe("full");

        // Without a column width there is no room to take a share of.
        const { block, entry } = convertModule(
          makeModule("mailup-bee-newsletter-modules-image", {
            image: { src: "p.png" },
            computedStyle: { width: "50%" },
          }),
          [],
          { columnWidth: undefined },
        );
        expect([block.type === "image" && block.width, entry.note]).toEqual([
          "full",
          "Image width 50% was converted to full width.",
        ]);
      });

      it("is full at exactly the room inside the image's padding", () => {
        const at = (px: number) =>
          shown(
            {
              style: { "padding-left": "20px", "padding-right": "20px" },
              image: { src: "p.jpg", width: "1200px" },
              computedStyle: { class: "fixedwidth", width: `${px}px` },
            },
            600,
          ).width;
        expect(at(560)).toBe("full");
        expect(at(559)).toBe(559);
      });

      it("falls back to image.width without computedStyle", () => {
        expect(
          shown({ image: { src: "p.jpg", width: "300px" } }, 600).width,
        ).toBe(300);
        expect(
          shown({ image: { src: "p.jpg", width: "600px" } }, 600).width,
        ).toBe("full");
      });

      it("keeps a px width as stated when the column is unknown", () => {
        expect(shown({ image: { src: "p.jpg", width: "900px" } }).width).toBe(
          900,
        );
      });

      it("imports an image with no width as full width", () => {
        expect(shown({ image: { src: "p.jpg" } }, 600).width).toBe("full");
      });

      it("prefers the image style's alignment over the class", () => {
        expect(
          shown({
            image: {
              src: "p.jpg",
              width: "100px",
              style: { "text-align": "right" },
            },
            computedStyle: { class: "left fixedwidth", width: "100px" },
          }).align,
        ).toBe("right");
      });

      it("resolves a percentage radius against the shown size", () => {
        const avatar = shown(
          {
            image: {
              src: "a.png",
              width: "400px",
              height: "400px",
              style: { "border-radius": "50%" },
            },
            computedStyle: { class: "center fixedwidth", width: "120px" },
          },
          600,
        );
        expect(avatar.borderRadius).toBe(60);
      });
    });

    // BeeFree keeps the radius in the image's own `style` map rather than
    // alongside width/height, so it is read from a different place than every
    // other image property here.
    it("carries a px corner radius from the image style", () => {
      const warnings: string[] = [];
      const rounded = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: {
            src: "https://x/p.jpg",
            width: "120px",
            style: { "border-radius": "60px" },
          },
        }),
        warnings,
      ).block;
      const square = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", {
          image: { src: "https://x/p.jpg", width: "120px" },
        }),
        warnings,
      ).block;

      if (rounded.type !== "image" || square.type !== "image")
        throw new Error("expected image blocks");
      expect(rounded.borderRadius).toBe(60);
      expect(square.borderRadius).toBeUndefined();
    });

    function imageWith(image: BeeFreeeImageContent) {
      const block = convertModule(
        makeModule("mailup-bee-newsletter-modules-image", { image }),
        [],
      ).block;
      if (block.type !== "image") throw new Error("expected an image block");
      return block;
    }

    // `border-radius: 50%` is the idiomatic way to write a circular avatar, so
    // it resolves against the width the template stated — a 120px square lands
    // on 60, the same block a literal `60px` produces.
    it("resolves a percentage radius against the stated width", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          width: "120px",
          style: { "border-radius": "50%" },
        }).borderRadius,
      ).toBe(60);
    });

    // 600 is `convertImage`'s fallback, not something BeeFree said.
    it("drops a percentage radius when no width was stated", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          style: { "border-radius": "50%" },
        }).borderRadius,
      ).toBeUndefined();
    });

    it("drops a negative radius", () => {
      expect(
        imageWith({
          src: "https://x/p.jpg",
          width: "120px",
          style: { "border-radius": "-5px" },
        }).borderRadius,
      ).toBeUndefined();
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

    it("carries the button's alignment across", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: {
          label: "Click Me",
          href: "https://example.com",
          style: { "text-align": "left" },
        },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.align).toBe("left");
      }
    });

    it("falls back to center when the button has no alignment", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: { label: "Click Me", href: "https://example.com", style: {} },
      });

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.align).toBe("center");
      }
    });

    it("uses default styles when no button descriptor", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {});

      const { block } = convertModule(mod, warnings);

      expect(block.type).toBe("button");
      if (block.type === "button") {
        expect(block.backgroundColor).toBe("#333333");
        expect(block.textColor).toBe("#ffffff");
      }
    });

    // Regression: the old `.replace(/<[^>]*>/g, "")` was both incomplete
    // sanitization (left an unterminated `<script` in the label) and
    // polynomial-ReDoS on `<<<<…` inputs. The new `stripTagsPlain` walks
    // the string linearly and discards trailing unterminated tags.
    it("strips unterminated `<script` from the button label (sanitizer regression)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: { label: "Hello <script", href: "https://x.test" },
      });
      const { block } = convertModule(mod, warnings);
      if (block.type === "button") {
        expect(block.text).toBe("Hello ");
        expect(block.text).not.toContain("<");
        expect(block.text).not.toContain(">");
      }
    });

    it("strips button label in linear time on adversarial `<<<<…` input (ReDoS regression)", () => {
      const warnings: string[] = [];
      const adversarial = "<".repeat(50_000) + "Buy";
      const start = Date.now();
      const mod = makeModule("mailup-bee-newsletter-modules-button", {
        button: { label: adversarial, href: "https://x.test" },
      });
      const { block } = convertModule(mod, warnings);
      const elapsed = Date.now() - start;
      if (block.type === "button") {
        // First `<` opens a tag that never closes — stripper bails and
        // discards the rest, leaving an empty label.
        expect(block.text).toBe("");
      }
      expect(elapsed).toBeLessThan(500);
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
        expect(block.width).toBe("75%");
      }
      expect(entry.status).toBe("converted");
      expect(entry.note).toBeUndefined();
    });

    function dividerWith(
      descriptor: BeeFreeeModule["descriptor"],
      context?: Parameters<typeof convertModule>[2],
    ) {
      const { block, entry } = convertModule(
        makeModule("mailup-bee-newsletter-modules-divider", descriptor),
        [],
        context,
      );
      if (block.type !== "divider") throw new Error("expected a divider block");
      return { block, entry };
    }

    // A numeric width means pixels, so a percentage must never come through
    // as a bare number: 100% would render as a 100px stub.
    it("imports 100% as full, not as 100 pixels", () => {
      const { block, entry } = dividerWith({
        divider: {
          style: { "border-top": "1px solid #aaaaaa", width: "100%" },
        },
      });
      expect(block.width).toBe("full");
      expect(entry.status).toBe("converted");
    });

    it("imports a divider with no width as full", () => {
      const { block } = dividerWith({
        divider: { style: { "border-top": "1px solid #aaaaaa" } },
      });
      expect(block.width).toBe("full");
    });

    it("keeps a px width as pixels when the column is unknown", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "580px" } },
      });
      expect(block.width).toBe(580);
      expect(entry.status).toBe("converted");
    });

    // MJML draws a full divider across the column minus the divider's own
    // padding, so a px width that reaches that already renders as full.
    it("reads a px width that reaches the column's content width as full", () => {
      const descriptor = (width: string): BeeFreeeModule["descriptor"] => ({
        divider: { style: { width } },
        style: { "padding-left": "10px", "padding-right": "10px" },
      });
      expect(
        dividerWith(descriptor("580px"), { columnWidth: 600 }).block.width,
      ).toBe("full");
      expect(
        dividerWith(descriptor("700px"), { columnWidth: 600 }).block.width,
      ).toBe("full");
      expect(
        dividerWith(descriptor("579px"), { columnWidth: 600 }).block.width,
      ).toBe(579);
    });

    it("clamps an out-of-range percentage and says so in the note", () => {
      const over = dividerWith({ divider: { style: { width: "150%" } } });
      expect(over.block.width).toBe("full");
      expect(over.entry.status).toBe("approximated");
      expect(over.entry.note).toBe("Divider width 150% was clamped to 100%.");

      const under = dividerWith({ divider: { style: { width: "-10%" } } });
      expect(under.block.width).toBe("0%");
      expect(under.entry.status).toBe("approximated");
      expect(under.entry.note).toBe("Divider width -10% was clamped to 0%.");
    });

    it("clamps a negative px width to zero and says so in the note", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "-5px" } },
      });
      expect(block.width).toBe(0);
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe("Divider width -5px was clamped to 0px.");
    });

    // A float printed in exponent form ("1e-7%") would fall outside
    // `DividerPercentWidth`'s pattern and fail validation.
    it("keeps a percentage to two decimals", () => {
      expect(
        dividerWith({ divider: { style: { width: "37.5%" } } }).block.width,
      ).toBe("37.5%");
      expect(
        dividerWith({ divider: { style: { width: "33.3333%" } } }).block.width,
      ).toBe("33.33%");
      expect(
        dividerWith({ divider: { style: { width: "0.0000001%" } } }).block
          .width,
      ).toBe("0%");
    });

    it("imports an unreadable width as full, and says so in the note", () => {
      const { block, entry } = dividerWith({
        divider: { style: { width: "auto" } },
      });
      expect(block.width).toBe("full");
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        'Divider width "auto" could not be read; imported as full width.',
      );
    });

    // Templatical centres every divider, so only a divider narrower than its
    // column loses anything by it.
    it("approximates a left- or right-aligned partial divider", () => {
      const left = dividerWith({
        divider: { style: { width: "50%" } },
        computedStyle: { align: "left" },
      });
      expect(left.block.width).toBe("50%");
      expect(left.entry.status).toBe("approximated");
      expect(left.entry.note).toBe(
        "BeeFree aligns this divider left; Templatical centres every divider.",
      );

      const right = dividerWith({
        divider: { style: { width: "200px" } },
        computedStyle: { align: "right" },
      });
      expect(right.entry.status).toBe("approximated");
      expect(right.entry.note).toBe(
        "BeeFree aligns this divider right; Templatical centres every divider.",
      );
    });

    it("reads the alignment from the module style when computedStyle has none", () => {
      const { entry } = dividerWith({
        divider: { style: { width: "50%" } },
        style: { "text-align": "right" },
      });
      expect(entry.status).toBe("approximated");
      expect(entry.note).toBe(
        "BeeFree aligns this divider right; Templatical centres every divider.",
      );
    });

    it("keeps a centred partial divider and an aligned full one converted", () => {
      const centred = dividerWith({
        divider: { style: { width: "50%" } },
        computedStyle: { align: "center" },
      });
      expect(centred.entry.status).toBe("converted");

      const full = dividerWith({
        divider: { style: { width: "100%" } },
        computedStyle: { align: "left" },
      });
      expect(full.block.width).toBe("full");
      expect(full.entry.status).toBe("converted");
      expect(full.entry.note).toBeUndefined();
    });
  });

  // BeeFree templates space content with dividers that draw nothing: only
  // their padding, and a transparent border's width, take up room (#1070).
  describe("divider that draws no line", () => {
    function invisible(
      borderTop: string,
      style: Record<string, string> = {
        "padding-top": "15px",
        "padding-right": "10px",
        "padding-bottom": "15px",
        "padding-left": "10px",
      },
    ) {
      return convertModule(
        makeModule("mailup-bee-newsletter-modules-divider", {
          divider: { style: { "border-top": borderTop, width: "100%" } },
          style,
        }),
        [],
        { columnWidth: 600 },
      );
    }

    function spacerHeight(borderTop: string): number {
      const { block } = invisible(borderTop);
      if (block.type !== "spacer") throw new Error(`expected a spacer`);
      return block.height;
    }

    it("imports a 0px border as a spacer as tall as the padding", () => {
      const { block, entry } = invisible("0px solid transparent");
      expect(block.type).toBe("spacer");
      if (block.type !== "spacer") return;
      expect(block.height).toBe(30);
      expect(block.styles.padding).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
      expect(entry).toEqual({
        beeFreeModuleType: "mailup-bee-newsletter-modules-divider",
        templaticalBlockType: "spacer",
        status: "converted",
        note: "The divider draws no line; imported as a 30px spacer.",
      });
    });

    it("adds a transparent border's width to the height", () => {
      expect(spacerHeight("10px solid transparent")).toBe(40);
      expect(spacerHeight("1px solid rgba(0, 0, 0, 0)")).toBe(31);
      expect(spacerHeight("2px solid #ffffff00")).toBe(32);
      expect(spacerHeight("2px solid hsl(0 0% 100% / 0%)")).toBe(32);
    });

    it("leaves out a 0px, none or hidden border's width", () => {
      expect(spacerHeight("0px solid #BBBBBB")).toBe(30);
      expect(spacerHeight("0 solid #BBBBBB")).toBe(30);
      expect(spacerHeight("3px none #BBBBBB")).toBe(30);
      expect(spacerHeight("3px hidden #BBBBBB")).toBe(30);
    });

    // CSS drops a negative padding, so it takes no room and takes none away.
    it("leaves out a negative padding", () => {
      const mixed = invisible("20px solid transparent", {
        "padding-top": "-30px",
        "padding-bottom": "5px",
      });
      expect(mixed.block.type === "spacer" && mixed.block.height).toBe(25);
      expect(
        skippedModuleEntry(
          makeModule("mailup-bee-newsletter-modules-divider", {
            divider: { style: { "border-top": "0px solid transparent" } },
            style: { "padding-top": "-10px" },
          }),
        )?.status,
      ).toBe("skipped");
    });

    it("keeps the module's background colour on the spacer", () => {
      const { block } = invisible("0px solid transparent", {
        "padding-top": "10px",
        "padding-bottom": "10px",
        "background-color": "#F0F0F0",
      });
      expect(block.styles.backgroundColor).toBe("#f0f0f0");
    });

    it("keeps a divider whose border is drawn", () => {
      for (const borderTop of [
        "1px solid #BBBBBB",
        "1px solid rgba(0, 0, 0, 0.5)",
        "2px solid #ffffff80",
      ]) {
        const { block, entry } = invisible(borderTop);
        expect([block.type, entry.status]).toEqual(["divider", "converted"]);
      }
      const { block } = invisible("1px solid rgba(0, 0, 0, 0.5)");
      if (block.type !== "divider") throw new Error("expected a divider");
      expect([block.thickness, block.color]).toEqual([1, "rgba(0, 0, 0, 0.5)"]);
    });
  });

  describe("icons", () => {
    const ICONS = "mailup-bee-newsletter-modules-icons";

    function iconsModule(
      icons: Array<Record<string, string>>,
      overrides: Partial<BeeFreeeModule["descriptor"]> = {},
    ): BeeFreeeModule {
      return makeModule(ICONS, {
        iconsList: { icons },
        computedStyle: {
          iconHeight: "32px",
          iconSpacing: {
            "padding-top": "5px",
            "padding-right": "6px",
            "padding-bottom": "5px",
            "padding-left": "5px",
          },
          itemSpacing: "0px",
        } as unknown as Record<string, string>,
        style: {
          color: "#9d9d9d",
          "font-family": "inherit",
          "font-size": "15px",
          "padding-top": "5px",
          "padding-right": "0px",
          "padding-bottom": "5px",
          "padding-left": "0px",
          "text-align": "center",
        },
        ...overrides,
      });
    }

    const gift = {
      image: "https://example.com/gift.png",
      alt: "Gift",
      href: "https://example.com/gift",
      target: "_blank",
      text: "",
      textPosition: "right",
      width: "48px",
      height: "48px",
    };

    it("imports a single icon without text as an image at the icon height", () => {
      const { block, entry } = convertModule(iconsModule([gift]), [], {
        columnWidth: 600,
      });
      expect(block.type).toBe("image");
      if (block.type !== "image") return;
      expect(block).toMatchObject({
        src: "https://example.com/gift.png",
        alt: "Gift",
        width: 32,
        naturalWidth: 48,
        naturalHeight: 48,
        align: "center",
        linkUrl: "https://example.com/gift",
      });
      // The module's padding plus the space BeeFree keeps around each icon.
      expect(block.styles.padding).toEqual({
        top: 10,
        right: 6,
        bottom: 10,
        left: 5,
      });
      expect(entry).toEqual({
        beeFreeModuleType: ICONS,
        templaticalBlockType: "image",
        status: "converted",
      });
    });

    it("keeps the icon's px width when the column is unknown", () => {
      const { block } = convertModule(iconsModule([gift]), []);
      expect(block.type === "image" && block.width).toBe(32);
    });

    it("keeps the icon's aspect ratio at the icon height", () => {
      const { block } = convertModule(
        iconsModule([{ ...gift, width: "325px", height: "303px" }]),
        [],
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.width).toBe(34);
    });

    function html(module: BeeFreeeModule): { content: string; entry: unknown } {
      const { block, entry } = convertModule(module, [], { columnWidth: 600 });
      if (block.type !== "html") throw new Error("expected an html block");
      return { content: block.content, entry };
    }

    it("rebuilds an icon with text as an HTML table", () => {
      const { content, entry } = html(
        iconsModule([{ ...gift, text: "Free gift", textPosition: "right" }]),
      );
      expect(entry).toEqual({
        beeFreeModuleType: ICONS,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: "Icons module rebuilt as an HTML table.",
      });
      expect(content).toContain('align="center"');
      expect(content).toContain(
        '<a href="https://example.com/gift" target="_blank" style="text-decoration: none;"><img src="https://example.com/gift.png" alt="Gift" width="32" height="32" style="display: block; width: 32px; height: 32px; border: 0;"></a>',
      );
      expect(content).toContain(
        "padding: 5px 6px 5px 5px; vertical-align: middle;",
      );
      expect(content).toContain(
        '<a href="https://example.com/gift" target="_blank" style="color: #9d9d9d; text-decoration: none;">Free gift</a>',
      );
      expect(content).toContain("font-size: 15px");
      expect(content).not.toContain("inherit");
    });

    it("places the text on the side textPosition names", () => {
      const order = (textPosition: string) => {
        const { content } = html(
          iconsModule([{ ...gift, text: "Gift", textPosition }]),
        );
        return content.indexOf("<img") < content.indexOf(">Gift</a>")
          ? "icon first"
          : "text first";
      };
      expect(order("right")).toBe("icon first");
      expect(order("bottom")).toBe("icon first");
      expect(order("left")).toBe("text first");
      expect(order("top")).toBe("text first");

      // top and bottom stack the text on its own row.
      const rows = (textPosition: string) =>
        html(
          iconsModule([{ ...gift, text: "Gift", textPosition }]),
        ).content.split("<tr>").length - 1;
      expect(rows("bottom")).toBe(rows("right") + 1);
      expect(rows("top")).toBe(rows("left") + 1);
    });

    it("rebuilds a row of icons with the items spacing between them", () => {
      const { content } = html(
        iconsModule(
          [
            { ...gift, image: "https://example.com/a.png", alt: "A" },
            { ...gift, image: "https://example.com/b.png", alt: "B" },
            { ...gift, image: "https://example.com/c.png", alt: "C" },
          ],
          {
            computedStyle: {
              iconHeight: "64px",
              itemsSpacing: "15px",
            },
          },
        ),
      );
      const srcs = [...content.matchAll(/<img src="([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(srcs).toEqual([
        "https://example.com/a.png",
        "https://example.com/b.png",
        "https://example.com/c.png",
      ]);
      expect(content.match(/height="64"/g)).toHaveLength(3);
      expect(content.match(/padding-left: 15px/g)).toHaveLength(2);
    });

    it("sizes an icon by height alone when its file size is unknown", () => {
      const { content } = html(
        iconsModule([{ image: "https://example.com/x.png", alt: "X" }]),
      );
      expect(content).toContain(
        '<img src="https://example.com/x.png" alt="X" height="32" style="display: block; height: 32px; border: 0;">',
      );
    });

    it("escapes what it writes into the HTML", () => {
      const { content } = html(
        iconsModule([
          {
            ...gift,
            alt: 'Say "hi"',
            href: "https://example.com/?a=1&b=2",
            text: "<b>Bold</b> & co",
          },
        ]),
      );
      expect(content).toContain('alt="Say &quot;hi&quot;"');
      expect(content).toContain('href="https://example.com/?a=1&amp;b=2"');
      expect(content).toContain("&lt;b&gt;Bold&lt;/b&gt; &amp; co");
      expect(content).not.toContain("<b>");
    });

    it("rebuilds an item without an image as its text alone", () => {
      const { content } = html(
        iconsModule([{ text: "Call us", textPosition: "right", href: "" }]),
      );
      expect(content).not.toContain("<img");
      expect(content).toContain(">Call us</td>");
    });

    // The table is markup the importer writes, and an HTML block is rendered
    // unsanitized, so an unsafe URL must never reach it.
    it("drops an unsafe icon link or image and says so", () => {
      const warnings: string[] = [];
      const { block } = convertModule(
        iconsModule([
          {
            ...gift,
            href: "javascript:alert(1)",
            text: "Free gift",
          },
          {
            ...gift,
            image: "javascript:alert(2)",
            href: "data:text/html,<b>x</b>",
          },
        ]),
        warnings,
        { columnWidth: 600 },
      );
      if (block.type !== "html") throw new Error("expected an html block");
      expect(block.content).not.toMatch(/javascript:|data:/);
      expect(block.content).not.toContain("<a ");
      expect(block.content).toContain(">Free gift</td>");
      expect(block.content.match(/<img /g)).toHaveLength(1);
      expect(warnings).toEqual([
        'Dropped the unsafe link "javascript:alert(1)" on an Icons item.',
        'Dropped the unsafe image "javascript:alert(2)" on an Icons item.',
        'Dropped the unsafe link "data:text/html,<b>x</b>" on an Icons item.',
      ]);
    });

    it("drops an unsafe link on a lone icon imported as an image", () => {
      const warnings: string[] = [];
      const { block } = convertModule(
        iconsModule([{ ...gift, href: " JavaScript:alert(1)" }]),
        warnings,
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.linkUrl).toBeUndefined();
      expect(warnings).toEqual([
        'Dropped the unsafe link " JavaScript:alert(1)" on an Icons item.',
      ]);
    });

    it("keeps safe and relative icon links", () => {
      for (const href of [
        "https://example.com",
        "mailto:hi@example.com",
        "/offers",
      ]) {
        const warnings: string[] = [];
        const { block } = convertModule(
          iconsModule([{ ...gift, href }]),
          warnings,
          {
            columnWidth: 600,
          },
        );
        expect([block.type === "image" && block.linkUrl, warnings]).toEqual([
          href,
          [],
        ]);
      }
    });

    it("links nothing when the icon has no href", () => {
      const { content } = html(
        iconsModule([{ ...gift, href: "", text: "Plain" }]),
      );
      expect(content).not.toContain("<a ");
      expect(content).toContain(">Plain</td>");
    });
  });

  // An addon keeps the payload of the module it stands in for, so it converts
  // as that module (#1071).
  describe("addon", () => {
    const ADDON = "mailup-bee-newsletter-modules-addon";

    // The shape of a GIPHY addon in a real export.
    it("converts an addon carrying an image as an image", () => {
      const { block, entry } = convertModule(
        makeModule(ADDON, {
          image: {
            alt: "Image",
            src: "https://media.giphy.com/cat.gif",
            href: "",
            url: "https://giphy.com/gifs/cat",
            width: "480px",
            height: "480px",
          } as BeeFreeeImageContent,
          style: { width: "100%" },
          computedStyle: { class: "center fixedwidth", width: "354.75px" },
        }),
        [],
        { columnWidth: 600 },
      );
      expect(block.type).toBe("image");
      if (block.type !== "image") return;
      expect([block.src, block.width, block.align]).toEqual([
        "https://media.giphy.com/cat.gif",
        355,
        "center",
      ]);
      // `url` is the GIF's page on giphy.com, not a link the author set.
      expect(block.linkUrl).toBeUndefined();
      expect(entry).toEqual({
        beeFreeModuleType: ADDON,
        templaticalBlockType: "image",
        status: "converted",
      });
    });

    it("reads a numeric computed width on an image addon", () => {
      const { block } = convertModule(
        makeModule(ADDON, {
          image: { src: "https://example.com/sticker.gif" },
          computedStyle: { class: "center fixedwidth", width: 256 },
          style: { width: "100%" },
        }),
        [],
        { columnWidth: 600 },
      );
      expect(block.type === "image" && block.width).toBe(256);
    });

    it("converts an addon carrying HTML as an HTML block", () => {
      const { block, entry } = convertModule(
        makeModule(ADDON, { html: { html: "<p>Countdown</p>" } }),
        [],
      );
      expect(block.type === "html" && block.content).toBe("<p>Countdown</p>");
      expect(entry.status).toBe("converted");
    });

    it("converts an addon carrying text, a button or icons as that module", () => {
      const typeOf = (descriptor: BeeFreeeModule["descriptor"]) =>
        convertModule(makeModule(ADDON, descriptor), [], { columnWidth: 600 })
          .block.type;
      expect(typeOf({ paragraph: { html: "<p>Hi</p>" } })).toBe("paragraph");
      expect(typeOf({ heading: { title: "h2", text: "Hi" } })).toBe("title");
      expect(typeOf({ button: { label: "Go" } })).toBe("button");
      expect(
        typeOf({
          iconsList: {
            icons: [
              {
                image: "https://example.com/i.png",
                width: "8px",
                height: "8px",
              },
            ],
          },
          computedStyle: { iconHeight: "16px" },
        }),
      ).toBe("image");
    });

    it("falls back to an HTML comment for an addon with nothing to read", () => {
      const { block, entry } = convertModule(makeModule(ADDON, {}), []);
      expect(block.type === "html" && block.content).toBe(
        `<!-- Unsupported BeeFree module: ${ADDON} -->`,
      );
      expect(entry).toEqual({
        beeFreeModuleType: ADDON,
        templaticalBlockType: "html",
        status: "html-fallback",
        note: "The addon carries no content Templatical reads; converted to an HTML block.",
      });
    });
  });

  describe("spacer", () => {
    it("uses height from descriptor or defaults to 24", () => {
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
        expect(b2.height).toBe(24);
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

  describe("heading edge cases", () => {
    it("falls back to level 2 for out-of-range heading level (h5)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h5",
          text: "Small Title",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.level).toBe(2);
      }
    });

    it("falls back to level 2 for non-heading tag", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "span",
          text: "Not a heading tag",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.level).toBe(2);
      }
    });
  });

  describe("video", () => {
    it("converts video without video descriptor to empty video block", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-video", {
        style: {
          "padding-top": "10px",
          "padding-right": "10px",
          "padding-bottom": "10px",
          "padding-left": "10px",
        },
      });

      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("video");
      if (block.type === "video") {
        expect(block.url).toBe("");
      }
    });

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

    // The video thumbnail ships as an mj-image, so a pinned height in the
    // source is the same fixed-box intent as on an image block.
    it("carries the thumbnail height from the style, and leaves it unset otherwise", () => {
      const warnings: string[] = [];
      const withHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-video", {
          video: {
            src: "https://youtube.com/watch?v=abc",
            style: { width: "500px", height: "280px" },
          },
        }),
        warnings,
      ).block;
      const withoutHeight = convertModule(
        makeModule("mailup-bee-newsletter-modules-video", {
          video: {
            src: "https://youtube.com/watch?v=abc",
            style: { width: "500px" },
          },
        }),
        warnings,
      ).block;

      if (withHeight.type !== "video" || withoutHeight.type !== "video")
        throw new Error("expected video blocks");
      expect(withHeight.height).toBe(280);
      expect(withoutHeight.height).toBeUndefined();
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

    it("strips HTML in cell content to plain text and flags it as approximated", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [
            {
              cells: [
                { html: "<b>Weight</b>" },
                { content: '<a href="https://example.com">Buy</a>' },
              ],
            },
          ],
        },
      });

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        // Tags removed; the cell keeps only its text (the link URL is lost).
        expect(block.rows[0].cells[0].content).toBe("Weight");
        expect(block.rows[0].cells[1].content).toBe("Buy");
      }
      expect(entry.status).toBe("approximated");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("table cells");
    });

    it("keeps a plain-text table as a clean conversion with no warning", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [{ cells: [{ content: "Weight" }, { html: "10kg" }] }],
        },
      });

      const { entry } = convertModule(mod, warnings);

      expect(entry.status).toBe("converted");
      expect(warnings).toHaveLength(0);
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
      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("");
      }
    });

    it("convertHeading without heading falls back to convertText (paragraph)", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        text: { html: "<p>Fallback text</p>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("paragraph");
      if (block.type === "paragraph") {
        expect(block.content).toBe("<p>Fallback text</p>");
      }
    });

    it("convertHeading without title defaults to level 2", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { text: "Untitled" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe("<p>Untitled</p>");
        expect(block.level).toBe(2);
      }
    });

    it("convertHeading strips heading tags from text that already has them", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-heading", {
        heading: { title: "h1", text: "<h1>Already Tagged</h1>" },
      });
      const { block } = convertModule(mod, warnings);
      expect(block.type).toBe("title");
      if (block.type === "title") {
        expect(block.content).toBe("<p>Already Tagged</p>");
        expect(block.level).toBe(1);
        // Must NOT contain raw heading tags — they are rendered by the block itself
        expect(block.content).not.toContain("<h1>");
      }
    });
  });

  describe("menu — no descriptor", () => {
    it("returns default MenuBlock when menu descriptor has no .menu property", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-menu", {});

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("menu");
      if (block.type === "menu") {
        expect(block.items).toHaveLength(0);
      }
      expect(entry.status).toBe("approximated");
      expect(entry.templaticalBlockType).toBe("menu");
    });
  });

  describe("table — no descriptor", () => {
    it("returns default TableBlock when table descriptor has no .table property", () => {
      const warnings: string[] = [];
      const mod = makeModule("mailup-bee-newsletter-modules-table", {});

      const { block, entry } = convertModule(mod, warnings);

      expect(block.type).toBe("table");
      if (block.type === "table") {
        // Default table block has 3 rows from createDefaultTableRows(3, 3)
        expect(block.rows).toHaveLength(3);
        expect(block.rows[0].cells).toHaveLength(3);
      }
      expect(entry.status).toBe("converted");
      expect(entry.templaticalBlockType).toBe("table");
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

  // Null-safety / malformed-input coverage for convertText's content-source
  // fan-out, the unknown-type html-fallback flow, inline font-weight emission,
  // and menu url precedence. Real exports carry partial descriptors.
  describe("malformed / null-safety", () => {
    describe("convertText with no content source", () => {
      it("returns an empty paragraph when text, paragraph, and list are all absent", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-text", {
          style: { "padding-top": "5px" },
        });

        const { block, entry } = convertModule(mod, warnings);

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          // textContent?.html ?? "" → "" with no wrapping applied.
          expect(block.content).toBe("");
        }
        expect(entry.status).toBe("converted");
        expect(entry.templaticalBlockType).toBe("paragraph");
        expect(warnings).toHaveLength(0);
      });

      it("returns an empty paragraph for a list module with no list content", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-list", {});

        const { block, entry } = convertModule(mod, warnings);

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("");
        }
        expect(entry.status).toBe("converted");
        expect(entry.templaticalBlockType).toBe("paragraph");
      });
    });

    describe("unknown module type — html-fallback flow", () => {
      it("emits an html block and a fully-populated html-fallback report entry", () => {
        const warnings: string[] = [];
        const mod = makeModule("mailup-bee-newsletter-modules-brand-new", {
          html: { html: "<section>hi</section>" },
        });

        const { block, entry } = convertModule(mod, warnings);

        // Unknown type short-circuits before the switch (MODULE_TYPE_MAP miss).
        expect(block.type).toBe("html");
        if (block.type === "html") {
          // convertHtmlFallback pulls html.html since text.html is absent.
          expect(block.content).toBe("<section>hi</section>");
        }
        expect(entry.status).toBe("html-fallback");
        expect(entry.templaticalBlockType).toBe("html");
        expect(entry.beeFreeModuleType).toBe(
          "mailup-bee-newsletter-modules-brand-new",
        );
        expect(entry.note).toBe(
          'Unknown module type "mailup-bee-newsletter-modules-brand-new" converted to HTML block.',
        );
        expect(warnings).toHaveLength(0);
      });
    });

    describe("inlineStylesToHtml font-weight emission", () => {
      it("does NOT emit a weight span for empty font-weight", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          // "" is falsy → guard skips it entirely.
          expect(block.content).toBe("<p>Hi</p>");
          expect(block.content).not.toContain("font-weight");
        }
      });

      it("does NOT emit a weight span for font-weight 'normal'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "normal" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("<p>Hi</p>");
          expect(block.content).not.toContain("font-weight");
        }
      });

      it("emits a weight span for font-weight 'bold'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "bold" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe(
            '<p><span style="font-weight: bold">Hi</span></p>',
          );
        }
      });

      it("emits a weight span for font-weight '700'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "700" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe(
            '<p><span style="font-weight: 700">Hi</span></p>',
          );
        }
      });

      // "400" is the numeric synonym for "normal", so it must not produce a
      // redundant span — matching the import-unlayer importer.
      it("does NOT emit a weight span for font-weight '400'", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-text", {
            text: { html: "<p>Hi</p>", style: { "font-weight": "400" } },
          }),
          [],
        );

        expect(block.type).toBe("paragraph");
        if (block.type === "paragraph") {
          expect(block.content).toBe("<p>Hi</p>");
        }
      });
    });

    // BeeFree's paragraph modules write `font-family: inherit`. Carried over,
    // the keyword becomes the block's own font and the sent email falls back
    // to the client's default face instead of the template's.
    describe("CSS-wide keywords as a font", () => {
      const KEYWORDS = ["inherit", "initial", "unset", "revert"];

      it.each(KEYWORDS)("leaves a title's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: {
              title: "h2",
              text: "Hello",
              style: { "font-family": keyword },
            },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)("leaves a button's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-button", {
            button: { label: "Go", style: { "font-family": keyword } },
          }),
          [],
        );
        if (block.type !== "button") throw new Error("expected a button block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)("leaves a menu's font unset for %s", (keyword) => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [{ text: "Home", link: "https://x.test" }],
              style: { "font-family": keyword },
            },
          }),
          [],
        );
        if (block.type !== "menu") throw new Error("expected a menu block");
        expect(block.fontFamily).toBeUndefined();
      });

      it.each(KEYWORDS)(
        "adds no font-family span to a paragraph for %s",
        (keyword) => {
          const { block } = convertModule(
            makeModule("mailup-bee-newsletter-modules-paragraph", {
              paragraph: {
                html: "<p>Hi</p>",
                style: { "font-family": keyword },
              },
            }),
            [],
          );
          if (block.type !== "paragraph")
            throw new Error("expected a paragraph block");
          expect(block.content).toBe("<p>Hi</p>");
        },
      );

      it("still carries a named font on a title, with its fallbacks", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: {
              text: "Hello",
              style: { "font-family": "'Open Sans', sans-serif" },
            },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect(block.fontFamily).toBe("'Open Sans', sans-serif");
      });

      it("carries a paragraph's whole font stack into its span", () => {
        const stack =
          "Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif";
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: {
              html: "<p>Hi</p>",
              style: { "font-family": stack },
            },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toContain(`font-family: ${stack}`);
      });

      it("adds no color span to a paragraph whose color is inherit", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color: "inherit" } },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toBe("<p>Hi</p>");
      });
    });

    // A title, menu or table without a color of its own inherits the
    // template's `textColor`, the body color the import writes.
    describe("text color", () => {
      it("leaves a title's color unset when the heading sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-heading", {
            heading: { text: "Hello", style: {} },
          }),
          [],
        );
        if (block.type !== "title") throw new Error("expected a title block");
        expect("color" in block).toBe(false);
      });

      it("leaves a menu's color unset when the menu sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: { items: [{ text: "Home", link: "https://x.test" }] },
          }),
          [],
        );
        if (block.type !== "menu") throw new Error("expected a menu block");
        expect("color" in block).toBe(false);
      });

      it("leaves a table's color unset when the table sets none", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-table", {
            table: { rows: [{ cells: [{ content: "A1" }] }] },
          }),
          [],
        );
        if (block.type !== "table") throw new Error("expected a table block");
        expect("color" in block).toBe(false);
      });

      it("compares a paragraph's color with the template's text color", () => {
        const paragraph = (color: string) =>
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color } },
          });
        const context = { textColor: "#333333" };

        const differs = convertModule(paragraph("#1a1a1a"), [], context).block;
        const same = convertModule(paragraph("#333333"), [], context).block;
        if (differs.type !== "paragraph" || same.type !== "paragraph")
          throw new Error("expected paragraph blocks");
        expect(differs.content).toBe(
          '<p><span style="color: #1a1a1a">Hi</span></p>',
        );
        expect(same.content).toBe("<p>Hi</p>");
      });

      it("compares with #1a1a1a when the template's text color is unknown", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-paragraph", {
            paragraph: { html: "<p>Hi</p>", style: { color: "#1a1a1a" } },
          }),
          [],
        );
        if (block.type !== "paragraph")
          throw new Error("expected a paragraph block");
        expect(block.content).toBe("<p>Hi</p>");
      });
    });

    describe("menu item url precedence", () => {
      it("prefers item.link over item.href when both are present", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [
                {
                  text: "Both",
                  link: "https://link.test",
                  href: "https://href.test",
                },
              ],
            },
          }),
          [],
        );

        expect(block.type).toBe("menu");
        if (block.type === "menu") {
          expect(block.items).toHaveLength(1);
          // `item.link || item.href || "#"` → link wins.
          expect(block.items[0].url).toBe("https://link.test");
        }
      });

      it("falls back to item.href when link is absent", () => {
        const { block } = convertModule(
          makeModule("mailup-bee-newsletter-modules-menu", {
            menu: {
              items: [{ text: "HrefOnly", href: "https://href.test" }],
            },
          }),
          [],
        );

        expect(block.type).toBe("menu");
        if (block.type === "menu") {
          expect(block.items[0].url).toBe("https://href.test");
        }
      });
    });
  });
});
