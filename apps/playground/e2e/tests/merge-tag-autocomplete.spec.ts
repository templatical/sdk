import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Helpers — keep test bodies focused on assertions.
 */
async function openParagraphEditor(editorPage: {
  doubleClickBlock(t: string): Promise<void>;
  getEditableFor(t: string): import("@playwright/test").Locator;
}) {
  await editorPage.doubleClickBlock("paragraph");
  const editable = editorPage.getEditableFor("paragraph");
  await editable.click();
  await editable.press("End");
  return editable;
}

test.describe("Merge tag autocomplete", () => {
  // The bug that motivated this suite: clicking a suggestion item used to
  // close the inline text editor right after the merge tag was inserted.
  // The popup mounts inside .tpl-text-editor-wrapper, mousedown.prevent.stop
  // on items prevents the document handler in useRichTextEditor from
  // tearing down the editor.
  test("clicking a suggestion item inserts the tag and keeps the editor open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    const list = page.locator(SELECTORS.mergeTagSuggestionList);
    await expect(popup).toBeVisible();
    await expect(list).toBeVisible();

    const items = list.locator('[role="option"]');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute(
      "data-merge-tag-value",
      "{{first_name}}",
    );

    await items.first().click();

    // Insertion happens in the active editable — assert there, not on a
    // .first() block (the playground has multiple paragraph blocks).
    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{first_name}}"]').last(),
    ).toBeVisible();

    // The bug: editor must still be open and popup must be gone.
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    await expect(popup).toHaveCount(0);
  });

  test("Enter inserts the highlighted item and keeps editor open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{ema");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{email}}"]').last(),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    await expect(popup).toHaveCount(0);
  });

  test("Tab inserts like Enter (alternative confirm key)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{compa");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await page.keyboard.press("Tab");

    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{company}}"]').last(),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    await expect(popup).toHaveCount(0);
  });

  test("ArrowDown / ArrowUp move the selected highlight between items", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const items = page.locator(
      `${SELECTORS.mergeTagSuggestionList} [role="option"]`,
    );

    // Track the selected option (whichever index the popup starts on —
    // mouse hover during popup mount can shift the initial highlight).
    const selected = page.locator(
      `${SELECTORS.mergeTagSuggestionList} [role="option"][data-selected="true"]`,
    );
    await expect(selected).toHaveCount(1);
    const startValue = await selected.getAttribute("data-merge-tag-value");

    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveCount(1);
    const afterDownValue = await selected.getAttribute("data-merge-tag-value");
    expect(afterDownValue).not.toBe(startValue);

    await page.keyboard.press("ArrowUp");
    const afterUpValue = await selected.getAttribute("data-merge-tag-value");
    expect(afterUpValue).toBe(startValue);

    // Sanity: with multiple items, navigation keeps exactly one highlighted.
    expect(await items.count()).toBeGreaterThan(1);
  });

  test("inserted tag renders the human-readable label, not the raw value", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await page.keyboard.press("Enter");

    const inserted = editable
      .locator('.tpl-merge-tag-node [data-tooltip="{{first_name}}"]')
      .last();
    await expect(inserted).toBeVisible();
    // The visible text inside the merge tag node should be the label
    // resolved from the tags array, not the raw `{{first_name}}` syntax.
    await expect(inserted).toContainText("First Name");
    await expect(inserted).not.toContainText("{{first_name}}");
  });

  test("Escape dismisses the popup without inserting anything", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);

    // Snapshot the existing merge tag count in this editable so we can
    // assert no NEW one was inserted (playground templates may already
    // contain merge tags).
    const before = await editable.locator(SELECTORS.mergeTagNode).count();

    await page.keyboard.type(" {{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);

    const after = await editable.locator(SELECTORS.mergeTagNode).count();
    expect(after).toBe(before);
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
  });

  test("popup filters by query and shows the empty state for no match", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{zzznotreal");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const empty = page.locator(SELECTORS.mergeTagSuggestionEmpty);
    await expect(empty).toBeVisible();
    await expect(
      page.locator(`${SELECTORS.mergeTagSuggestionList} [role="option"]`),
    ).toHaveCount(0);
  });

  test("trigger fires when there is no whitespace before {{ (e.g. '.{{') ", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression for the @tiptap/suggestion default `allowedPrefixes: [" "]`
    // that requires a whitespace prefix. We override it to `null`.
    await openParagraphEditor(editorPage);
    await page.keyboard.type(".{{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const items = page.locator(
      `${SELECTORS.mergeTagSuggestionList} [role="option"]`,
    );
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute(
      "data-merge-tag-value",
      "{{first_name}}",
    );
  });

  test("filtering narrows results live as user types", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{");

    const list = page.locator(SELECTORS.mergeTagSuggestionList);
    const items = list.locator('[role="option"]');

    // Initial open: cap is 10 items.
    const initial = await items.count();
    expect(initial).toBeGreaterThan(1);

    // Narrow with 'first' — playground tags include "First Name".
    await page.keyboard.type("first");
    await expect(items).toHaveCount(1);

    // Backspace twice clears 'st' → 'fir' still narrows to one match.
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(items).toHaveCount(1);
  });

  test("popup positions near the caret in dark canvas mode (no transform/filter offset)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression for dark-canvas mispositioning. Canvas.vue applies
    // `filter: invert(1) hue-rotate(180deg)` in dark mode, which creates a
    // containing block for `position: fixed` descendants. If the popup
    // mounts inside the filtered Canvas, fixed positioning becomes
    // relative to the canvas instead of the viewport — the popup ends up
    // far from the caret.
    await editorPage.toggleDarkMode();

    const editable = await openParagraphEditor(editorPage);
    await page.keyboard.type(" {{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    // After the popup tracks scroll, it should be pinned to the caret
    // bottom — not just "in the same screen region." Read the caret rect
    // and the popup rect in the same evaluate so they're sampled at the
    // same layout tick (no race against in-flight auto-scroll).
    const gaps = await page.evaluate((popupSelector: string) => {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const caretRect = range?.getBoundingClientRect() ?? null;
      const popupEl = document.querySelector(popupSelector) as HTMLElement | null;
      const popupRect = popupEl?.getBoundingClientRect() ?? null;
      if (!caretRect || !popupRect) return null;
      return {
        vertical: Math.abs(popupRect.top - caretRect.bottom),
        horizontal: Math.abs(popupRect.left - caretRect.left),
      };
    }, SELECTORS.mergeTagSuggestionPopup);

    expect(gaps).not.toBeNull();
    // Popup top should sit on the caret bottom. ~10px tolerance accounts
    // for sub-pixel rounding only — anything more means scroll-tracking
    // failed.
    expect(gaps?.vertical ?? Infinity).toBeLessThanOrEqual(10);
    // Popup left should align with caret left. Wider tolerance because
    // the popup may shift to keep within viewport bounds.
    expect(gaps?.horizontal ?? Infinity).toBeLessThan(50);
  });

  test("popup flips above caret when there's not enough room below", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression for viewport-flip: when caret has insufficient room
    // below it for the popup, the popup must flip ABOVE the caret. With
    // a 320px tall viewport (smaller than the popup itself), the only
    // way to fit fully on-screen is to flip up.
    await page.setViewportSize({ width: 1280, height: 320 });

    const editable = await openParagraphEditor(editorPage);

    // Force the active editable's caret to sit near the viewport bottom
    // by scrolling it into view aligned to bottom.
    await editable.evaluate((el) => {
      el.scrollIntoView({ block: "end" });
    });

    await page.keyboard.type(" {{");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const popupBox = await popup.boundingBox();
    expect(popupBox).not.toBeNull();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const popupBottom = (popupBox?.y ?? 0) + (popupBox?.height ?? 0);

    // Bug: popup currently always renders BELOW the caret with no flip,
    // so on a short viewport it clips off-screen. Asserting the popup
    // stays fully on-screen is the reproduction.
    expect(popupBottom).toBeLessThanOrEqual((viewport?.height ?? 0) + 1);
    expect(popupBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("popup positions correctly when an ancestor of the editor has a transform", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression for the showcase-page bug: any non-`none` `transform` on
    // an editor ancestor (route transitions, reveal animations) creates a
    // containing block for `position: fixed` descendants. If the popup
    // mounts inside that subtree, fixed positioning resolves against the
    // transformed ancestor instead of the viewport and the popup lands far
    // from the caret. The fix mounts the popup to document.body.
    await page.evaluate(() => {
      // Wrap the document body's children in a transformed container.
      // `translateY(0)` is layout-equivalent to no transform but still
      // creates a containing block — exactly the silent-trap shape.
      const wrap = document.createElement("div");
      wrap.style.transform = "translateY(0)";
      while (document.body.firstChild) {
        wrap.appendChild(document.body.firstChild);
      }
      document.body.appendChild(wrap);
    });

    const editable = await openParagraphEditor(editorPage);
    await editable.click();
    await page.keyboard.type(" {{");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const gaps = await page.evaluate((popupSelector: string) => {
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      const caretRect = range?.getBoundingClientRect() ?? null;
      const popupEl = document.querySelector(popupSelector) as HTMLElement | null;
      const popupRect = popupEl?.getBoundingClientRect() ?? null;
      if (!caretRect || !popupRect) return null;
      return {
        vertical: Math.abs(popupRect.top - caretRect.bottom),
        horizontal: Math.abs(popupRect.left - caretRect.left),
      };
    }, SELECTORS.mergeTagSuggestionPopup);

    expect(gaps).not.toBeNull();
    expect(gaps?.vertical ?? Infinity).toBeLessThanOrEqual(10);
    expect(gaps?.horizontal ?? Infinity).toBeLessThan(50);
  });

  test("contenteditable exposes ARIA combobox attrs while popup is open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression for missing ARIA: the contenteditable acting as the
    // combobox trigger must expose aria-controls + aria-expanded while
    // the popup is open, and clear them when it closes.
    const editable = await openParagraphEditor(editorPage);

    // Before opening: no ARIA wiring expected.
    await expect(editable).not.toHaveAttribute("aria-expanded", "true");

    await page.keyboard.type(" {{");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await expect(editable).toHaveAttribute("aria-expanded", "true");
    await expect(editable).toHaveAttribute("aria-haspopup", "listbox");
    const controls = await editable.getAttribute("aria-controls");
    expect(controls).toBeTruthy();

    const list = page.locator(SELECTORS.mergeTagSuggestionList);
    expect(await list.getAttribute("id")).toBe(controls);

    // aria-activedescendant points at an option id that exists in the list.
    const active = await editable.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    const activeOption = page.locator(`#${active}`);
    await expect(activeOption).toHaveAttribute("role", "option");

    // Press ArrowDown — activedescendant should track the new highlight.
    await page.keyboard.press("ArrowDown");
    const activeAfter = await editable.getAttribute("aria-activedescendant");
    expect(activeAfter).toBeTruthy();
    expect(activeAfter).not.toBe(active);

    // Closing the popup clears the wiring.
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(editable).not.toHaveAttribute("aria-expanded", "true");
    await expect(editable).not.toHaveAttribute(
      "aria-activedescendant",
      /.+/,
    );
  });

  // --- Title editor coverage (mirror of the paragraph happy paths) ---

  test("title block: clicking suggestion item inserts tag and keeps editor open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("title");
    const editable = editorPage.getEditableFor("title");
    await editable.click();
    await editable.press("End");

    await page.keyboard.type(" {{first");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    const items = page.locator(
      `${SELECTORS.mergeTagSuggestionList} [role="option"]`,
    );
    await items.first().click();

    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{first_name}}"]').last(),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    await expect(popup).toHaveCount(0);
  });

  test("title block: Enter inserts highlighted item and keeps editor open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("title");
    const editable = editorPage.getEditableFor("title");
    await editable.click();
    await editable.press("End");

    await page.keyboard.type(" {{ema");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{email}}"]').last(),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
  });

  test("can insert two merge tags in the same edit session", async ({
    editorReady: { editorPage },
    page,
  }) => {
    const editable = await openParagraphEditor(editorPage);

    // First insertion via Enter.
    await page.keyboard.type(" {{first");
    await expect(
      page.locator(SELECTORS.mergeTagSuggestionPopup),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{first_name}}"]').last(),
    ).toBeVisible();

    // Editor is still open — second insertion should still work.
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    await page.keyboard.type(" {{ema");
    await expect(
      page.locator(SELECTORS.mergeTagSuggestionPopup),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(
      editable.locator('.tpl-merge-tag-node [data-tooltip="{{email}}"]').last(),
    ).toBeVisible();
  });
});
