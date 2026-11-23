import { describe, expect, it, vi } from "vitest";
import mjml2html from "mjml";
import {
  createCountdownBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { renderCountdownImage, renderToMjml } from "../src";

const block = createCountdownBlock({
  targetDate: "2026-12-24T17:00:00.000Z",
  timezone: "Europe/Berlin",
  styles: { padding: { top: 8, right: 12, bottom: 16, left: 20 } },
  visibility: { desktop: false, mobile: true },
});

describe("renderCountdownImage", () => {
  it("renders exact MJML with the image placement and visibility attributes", () => {
    expect(
      renderCountdownImage(block, "https://example.com/count.gif", {
        locale: "en",
      }),
    ).toBe(
      '<mj-image\n  src="https://example.com/count.gif"\n  alt="Countdown to December 24, 2026 at 6:00 PM (Europe/Berlin)"\n  fluid-on-mobile="true"\n  align="center"\n  padding="8px 12px 16px 20px" css-class="tpl-hide-desktop"\n/>',
    );
  });

  it("escapes a hostile source and omits a hidden block", () => {
    expect(renderCountdownImage(block, 'x" onerror="alert(1)')).toContain(
      'src="x&quot; onerror=&quot;alert(1)"',
    );
    expect(
      renderCountdownImage(
        { ...block, visibility: { desktop: false, mobile: false } },
        "x",
      ),
    ).toBe("");
  });

  it.each(["", "  \t  "])(
    "emits the existing unrenderable marker for an empty image URL: %j",
    (src) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(renderCountdownImage(block, src)).toBe(
          `<mj-raw><!-- templatical:unrenderable-block type="countdown" id="${block.id}" --></mj-raw>`,
        );
      } finally {
        warn.mockRestore();
      }
    },
  );

  it("survives an mjml@5 compile with source and alt intact", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [block];
    const mjml = await renderToMjml(content, {
      blockRenderers: {
        countdown: (item) =>
          renderCountdownImage(
            item as typeof block,
            "https://example.com/count.gif",
            { locale: "en" },
          ),
      },
    });
    const result = await mjml2html(mjml, { validationLevel: "strict" });
    expect(result.errors).toEqual([]);
    const imageTag = [...result.html.matchAll(/<(\w+)\b([^>]*)>/g)].find(
      (match) => match[1] === "img",
    )?.[0];
    expect(imageTag).toContain('src="https://example.com/count.gif"');
    expect(imageTag).toContain(
      'alt="Countdown to December 24, 2026 at 6:00 PM (Europe/Berlin)"',
    );
  });

  it("carries the countdown background through an mjml@5 compile", async () => {
    const colored = {
      ...block,
      styles: { ...block.styles, backgroundColor: "#fffbeb" },
    };
    const content = createDefaultTemplateContent();
    content.blocks = [colored];
    const mjml = await renderToMjml(content, {
      blockRenderers: {
        countdown: () =>
          renderCountdownImage(colored, "https://example.com/count.gif"),
      },
    });
    expect(mjml).toContain('container-background-color="#fffbeb"');

    const result = await mjml2html(mjml, { validationLevel: "strict" });
    expect(result.errors).toEqual([]);
    expect(result.html).toContain("#fffbeb");
  });
});
