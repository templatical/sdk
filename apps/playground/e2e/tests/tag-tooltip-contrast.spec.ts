import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test("merge and logic tag tooltips remain readable in both UI themes", async ({
  scenePage,
  editorPage,
  page,
}) => {
  const tagTypes = [
    {
      source: "span[data-logic-merge-tag]",
      badge: ".tpl-logic-merge-tag-node .tpl-tooltip",
    },
    {
      source: "span[data-merge-tag]",
      badge: ".tpl-merge-tag-node .tpl-tooltip",
    },
  ];

  for (const theme of ["light", "dark"] as const) {
    await scenePage.goto("example-sable-order");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    if (theme === "dark") {
      await editorPage.chooseTheme("dark");
    }
    await expect(page.locator(`.tpl[data-tpl-theme="${theme}"]`)).toBeVisible();

    const canvas = page.locator(SELECTORS.canvasBody);
    for (const tag of tagTypes) {
      await canvas
        .locator(`.tpl-text-content ${tag.source}`)
        .first()
        .dblclick();
      const badge = canvas.locator(tag.badge).first();
      await expect(badge).toBeVisible();
      await badge.hover();
      await expect
        .poll(() =>
          badge.evaluate((el) => getComputedStyle(el, "::after").opacity),
        )
        .toBe("1");

      const colors = await badge.evaluate((el) => {
        const tooltip = getComputedStyle(el, "::after");
        const arrow = getComputedStyle(el, "::before");
        const pixel = (color: string): number[] => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d")!;
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };
        const luminance = (rgb: number[]): number => {
          const [red, green, blue] = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        const background = luminance(pixel(tooltip.backgroundColor));
        const foreground = luminance(pixel(tooltip.color));
        const contrast =
          (Math.max(background, foreground) + 0.05) /
          (Math.min(background, foreground) + 0.05);
        return {
          contrast,
          background: tooltip.backgroundColor,
          arrow: arrow.borderBottomColor,
        };
      });

      expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
      expect(colors.arrow).toBe(colors.background);
    }
  }
});
