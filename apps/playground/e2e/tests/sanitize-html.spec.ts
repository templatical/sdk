import type { TemplateContent } from "@templatical/types";
import { test, expect } from "../fixtures/editor.fixture";

function contentWithParagraph(html: string): TemplateContent {
  return {
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      linkUnderline: true,
      fontFamily: "Arial",
      locale: "en",
    },
    blocks: [
      {
        id: "sanitizer-payload",
        type: "paragraph",
        content: html,
        styles: {
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      },
    ],
  } satisfies TemplateContent;
}

test.describe("rich-text HTML sanitization", () => {
  for (const [label, html] of [
    [
      "noscript comment mutation",
      "<noscript><!--</noscript><img src=x onerror=window.fire(1)>--></noscript>",
    ],
    [
      "SVG animate href mutation",
      '<svg><a><animate attributeName="href" values="javascript:window.fire(1)"></animate></a></svg>',
    ],
  ] as const) {
    test(`does not activate the ${label} payload`, async ({
      page,
      openSharedContent,
    }) => {
      await page.addInitScript(() => {
        const marker = window as typeof window & {
          fire: () => void;
          __sanitizerFired: boolean;
        };
        marker.__sanitizerFired = false;
        marker.fire = () => {
          marker.__sanitizerFired = true;
        };
      });

      await openSharedContent("sanitizer-payload", contentWithParagraph(html));
      const block = page.locator('[data-block-id="sanitizer-payload"]');
      await expect(block).toBeVisible();
      await expect(block.locator("img[onerror], svg animate")).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            (window as typeof window & { __sanitizerFired: boolean })
              .__sanitizerFired,
        ),
      ).toBe(false);
    });
  }
});
