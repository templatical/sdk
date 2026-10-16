import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";

/**
 * A shadow-mounted canvas renders with the editor's CSS and nothing else, as
 * it does for an npm or CDN install. The playground compiles the editor from
 * source, so its own stylesheet, Tailwind preflight included, could reach the
 * shadow root through `inline-style-css-plugin` (builds) or the dev style
 * mirror (`vite dev`, which this suite runs). With preflight there, titles
 * computed 400 instead of the browser's bold and lists lost their markers,
 * while real installs and the exported email show both.
 *
 * The title and list checks run in `chromium-shadow` only: a light-DOM mount
 * lives in the playground document, where the host's preflight applies by
 * design, as it would for any Tailwind host. The spacer and video checks hold
 * in both modes. The last check holds the editor's own chrome reset to the same
 * line: it must change nothing inside the email.
 */

const STYLES = { padding: { top: 10, right: 20, bottom: 10, left: 20 } };
const SPACER_HEIGHT = 32;

const title = (level: number) => ({
  id: `title-${level}`,
  type: "title",
  level,
  textAlign: "left",
  content: `<p>Heading ${level}</p>`,
  styles: STYLES,
});

const CONTENT = {
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily: "Arial",
    locale: "en",
  },
  blocks: [
    ...[1, 2, 3, 4].map(title),
    {
      id: "lists",
      type: "paragraph",
      content:
        "<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>one</p></li><li><p>two</p></li></ol>",
      styles: STYLES,
    },
    {
      id: "spacer",
      type: "spacer",
      height: SPACER_HEIGHT,
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    },
    {
      id: "video",
      type: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: "/examples/launchpad/dashboard.png",
      alt: "Video",
      width: "full",
      align: "center",
      styles: STYLES,
    },
  ],
};

/** What the browser computes for bare elements on a page with no CSS. */
async function userAgentStyles(page: Page) {
  const blank = await page.context().newPage();
  try {
    await blank.setContent(
      "<!doctype html><h1>a</h1><h2>a</h2><h3>a</h3><h4>a</h4><ul><li>a</li></ul><ol><li>a</li></ol>",
    );
    return await blank.evaluate(() => ({
      headings: [1, 2, 3, 4].map(
        (level) =>
          getComputedStyle(document.querySelector(`h${level}`)!).fontWeight,
      ),
      ul: getComputedStyle(document.querySelector("ul")!).listStyleType,
      ol: getComputedStyle(document.querySelector("ol")!).listStyleType,
    }));
  } finally {
    await blank.close();
  }
}

test.describe("canvas renders with the editor's CSS only", () => {
  test.beforeEach(async ({ openSharedContent }) => {
    await openSharedContent("canvas-editor-css-only", CONTENT);
  });

  test("titles keep the browser's heading weight, as the export does", async ({
    page,
    shadowDom,
  }) => {
    test.skip(
      !shadowDom,
      "a light-DOM mount gets the host page's preflight by design",
    );
    const ua = await userAgentStyles(page);
    // Guard against an oracle that matches the regression it should catch.
    expect(ua.headings.every((weight) => Number(weight) > 400)).toBe(true);

    const weights = await Promise.all(
      [1, 2, 3, 4].map((level) =>
        page
          .locator(`[data-block-id="title-${level}"] h${level}`)
          .evaluate((el) => getComputedStyle(el).fontWeight),
      ),
    );

    expect(weights).toEqual(ua.headings);
  });

  test("lists keep the browser's markers", async ({ page, shadowDom }) => {
    test.skip(
      !shadowDom,
      "a light-DOM mount gets the host page's preflight by design",
    );
    const ua = await userAgentStyles(page);
    const block = page.locator('[data-block-id="lists"]');

    const markers = {
      ul: await block
        .locator("ul")
        .evaluate((el) => getComputedStyle(el).listStyleType),
      ol: await block
        .locator("ol")
        .evaluate((el) => getComputedStyle(el).listStyleType),
    };

    expect(markers).toEqual({ ul: ua.ul, ol: ua.ol });
    expect(markers.ul).not.toBe("none");
  });

  test("no stylesheet in the shadow root carries the host's preflight", async ({
    page,
    shadowDom,
  }) => {
    test.skip(!shadowDom, "only a shadow root adopts stylesheets");

    const preflightRules = await page
      .locator('[data-block-id="title-2"]')
      .evaluate((el) => {
        const sheets = (el.getRootNode() as ShadowRoot).adoptedStyleSheets;
        const found: string[] = [];
        const walk = (rules: CSSRuleList) => {
          for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule) {
              const resetsHeadings =
                rule.selectorText.replace(/\s/g, "") === "h1,h2,h3,h4,h5,h6" &&
                rule.style.fontWeight === "inherit";
              const dropsMarkers =
                rule.selectorText.replace(/\s/g, "") === "ol,ul,menu" &&
                rule.style.listStyleType === "none";
              if (resetsHeadings || dropsMarkers) found.push(rule.cssText);
            }
            if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
          }
        };
        sheets.forEach((sheet) => walk(sheet.cssRules));
        return found;
      });

    expect(preflightRules).toEqual([]);
  });

  test("a spacer is as tall on the canvas as in the email", async ({
    page,
  }) => {
    // The edit-mode guide is a dashed top and bottom border; it must sit
    // inside the height rather than add to it, and draw no side borders.
    const guide = page.locator(
      '[data-block-id="spacer"] [style*="min-height"]',
    );

    const box = await guide.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        height: el.getBoundingClientRect().height,
        borderLeft: style.borderLeftWidth,
        borderRight: style.borderRightWidth,
        borderTopStyle: style.borderTopStyle,
      };
    });

    expect(box).toEqual({
      height: SPACER_HEIGHT,
      borderLeft: "0px",
      borderRight: "0px",
      borderTopStyle: "dashed",
    });
  });

  test("a video thumbnail sits flush, with no gap below it", async ({
    page,
  }) => {
    // The email's `mj-image` renders the thumbnail `display: block`; an inline
    // image would leave a descender gap the email doesn't have.
    const image = page.locator('[data-block-id="video"] img');
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);

    const fit = await image.evaluate((el) => ({
      display: getComputedStyle(el).display,
      gap:
        el.parentElement!.getBoundingClientRect().height -
        el.getBoundingClientRect().height,
    }));

    expect(fit).toEqual({ display: "block", gap: 0 });
  });

  test("the chrome reset never reaches the email", async ({
    page,
    shadowDom,
  }) => {
    test.skip(!shadowDom, "only a shadow root adopts the editor's stylesheet");
    // `styles/index.css` resets the chrome with a scoped preflight that skips
    // `.tpl-email-surface`, the subtree that renders the email. Every element
    // in it must compute and size the same with and without that reset, or
    // the canvas would stop matching what email clients render.
    const result = await page
      .locator('[data-block-id="title-2"]')
      .evaluate((el) => {
        const root = el.getRootNode() as ShadowRoot;
        const original = [...root.adoptedStyleSheets];
        let removed = 0;
        const rebuild = (dropReset: boolean) =>
          original.map((sheet) => {
            const kept = Array.from(sheet.cssRules).filter((rule) => {
              const isReset =
                rule instanceof CSSLayerBlockRule &&
                rule.name === "base" &&
                rule.cssText.includes(":where(.tpl) :where(*)");
              if (isReset && dropReset) removed++;
              return !(isReset && dropReset);
            });
            const copy = new CSSStyleSheet();
            copy.replaceSync(kept.map((rule) => rule.cssText).join("\n"));
            return copy;
          });
        const props = [
          "box-sizing",
          "margin-top",
          "margin-bottom",
          "padding-top",
          "padding-left",
          "border-top-width",
          "font-size",
          "font-weight",
          "line-height",
          "list-style-type",
          "display",
          "vertical-align",
          "color",
          "text-decoration-line",
        ];
        const all = Array.from(root.querySelectorAll("*"));
        const email = all.filter((node) => node.closest(".tpl-email-surface"));
        const chrome = all.filter(
          (node) => !node.closest(".tpl-email-surface"),
        );
        const snap = (sheets: CSSStyleSheet[], nodes: Element[]) => {
          root.adoptedStyleSheets = sheets;
          return nodes.map((node) => {
            const style = getComputedStyle(node);
            const box = node.getBoundingClientRect();
            return [
              ...props.map((prop) => style.getPropertyValue(prop)),
              box.width,
              box.height,
            ].join("|");
          });
        };
        const withReset = rebuild(false);
        const withoutReset = rebuild(true);
        const emailWith = snap(withReset, email);
        const emailWithout = snap(withoutReset, email);
        const chromeWith = snap(withReset, chrome);
        const chromeWithout = snap(withoutReset, chrome);
        root.adoptedStyleSheets = original;
        return {
          removed,
          emailElements: email.length,
          emailChanged: email
            .filter((_, i) => emailWith[i] !== emailWithout[i])
            .map((node) => node.outerHTML.slice(0, 100)),
          chromeChanged: chrome.filter(
            (_, i) => chromeWith[i] !== chromeWithout[i],
          ).length,
        };
      });

    // The reset was found and taken out, and taking it out moved the chrome:
    // without both, an empty email diff would prove nothing.
    expect(result.removed).toBeGreaterThan(0);
    expect(result.chromeChanged).toBeGreaterThan(0);
    expect(result.emailElements).toBeGreaterThan(20);
    expect(result.emailChanged).toEqual([]);
  });
});
