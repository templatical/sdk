import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

/**
 * The canvas must space rich text exactly as the exported email does — the
 * renderer's side of that is unit-tested against the real MJML compiler, and
 * `richTextSpacingParity.test.ts` locks the two sets of values together.
 *
 * What neither can see is whether the stylesheet carrying those rules actually
 * reaches the canvas at runtime. The editor mounts into a Shadow DOM by
 * default and its CSS is injected by `inline-style-css-plugin`, so a rule can
 * be perfectly correct in `dist/style.css` and still never apply. These specs
 * assert computed values in the live mount, in both the shadow and light-DOM
 * projects.
 */

/** Values mirror `RICH_TEXT_SPACING` in `@templatical/types`. */
const EXPECTED = {
  paragraphMargin: "0px 0px 8px",
  listMargin: "8px 0px",
  listPaddingLeft: "24px",
  listItemMargin: "4px 0px",
};

test.describe("Rich text spacing on the canvas", () => {
  test("a real paragraph block resolves the shared margins", async ({
    editorReady,
    page,
  }) => {
    void editorReady;

    const content = page
      .locator(`${blockByType("paragraph")} .tpl-text-content`)
      .first();
    await expect(content).toBeVisible();

    const margins = await content.evaluate((el) =>
      [...el.querySelectorAll("p")].map((p) => {
        const style = getComputedStyle(p);
        return { top: style.marginTop, bottom: style.marginBottom };
      }),
    );

    // Guard against the selector silently matching nothing, which would make
    // every assertion below vacuously true.
    expect(margins.length).toBeGreaterThan(0);

    for (const margin of margins) {
      expect(margin.top).toBe("0px");
    }
    // Every paragraph carries the gap except the last, whose reset keeps the
    // block's own padding the only space below it — in the canvas and in the
    // email alike.
    for (const margin of margins.slice(0, -1)) {
      expect(margin.bottom).toBe("8px");
    }
    expect(margins.at(-1)!.bottom).toBe("0px");
  });

  test("the canvas stylesheet reaches every rich-text selector", async ({
    editorReady,
    page,
  }) => {
    void editorReady;

    // A probe rather than authored content: this asserts stylesheet *delivery*
    // into the mount for all four selectors at once, including the multi-
    // paragraph and list cases the default template has no blocks for.
    const computed = await page.evaluate((selector) => {
      const host = document.querySelector(selector)!;
      // Shadow mode puts the canvas inside the shadow root; light mode leaves
      // it in the host's own subtree. Same assertion either way.
      const root: ParentNode = host.shadowRoot ?? host;
      const canvas = root.querySelector(".tpl-body") ?? root;

      const probe = document.createElement("div");
      probe.className = "tpl-text-content";
      probe.innerHTML =
        "<p>one</p><p>two</p><ul><li>a</li><li>b</li></ul>";
      canvas.appendChild(probe);

      const [first, second] = [...probe.querySelectorAll("p")];
      const list = probe.querySelector("ul") as HTMLElement;
      const item = probe.querySelector("li") as HTMLElement;

      const out = {
        firstMargin: getComputedStyle(first).margin,
        // The second `<p>` is followed by the `<ul>`, so it is not
        // `:last-child` and must keep its gap.
        secondMargin: getComputedStyle(second).margin,
        listMargin: getComputedStyle(list).margin,
        listPaddingLeft: getComputedStyle(list).paddingLeft,
        listItemMargin: getComputedStyle(item).margin,
        gap:
          list.getBoundingClientRect().top -
          second.getBoundingClientRect().bottom,
      };

      probe.remove();
      return out;
    }, SELECTORS.editorContainer);

    expect(computed.firstMargin).toBe(EXPECTED.paragraphMargin);
    expect(computed.secondMargin).toBe(EXPECTED.paragraphMargin);
    expect(computed.listMargin).toBe(EXPECTED.listMargin);
    expect(computed.listPaddingLeft).toBe(EXPECTED.listPaddingLeft);
    expect(computed.listItemMargin).toBe(EXPECTED.listItemMargin);
    // The paragraph's 8px bottom margin collapses with the list's 8px top
    // margin, so the rendered gap is 8px and not 16px — the same collapsing
    // the exported email relies on.
    expect(computed.gap).toBeCloseTo(8, 0);
  });
});
