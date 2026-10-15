import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { EditorPage } from "../pages/editor.page";

/**
 * A merge or logic tag typed out in full — `{{`, the name, `}}` — becomes
 * one chip.
 *
 * The autocomplete suite (merge-tag-autocomplete.spec.ts) only ever picks from
 * the popup and never types the closing `}}`. This path is the node's
 * InputRule instead: the closing character matches the syntax regex and the
 * typed token is replaced by a node. TipTap applies that rule in two
 * dispatches, and mounting the chip's Vue node view between them flushes the
 * editor's content watcher, so only real TipTap with real node views proves
 * the chip survives and the typed text is not left beside it. The editor
 * package runs the same cases in packages/editor/tests/typedMergeTagChip.test.ts.
 *
 * Every character goes through `keyboard.type`, so `{{` opens the suggestion
 * popup and the rest of the token is typed through it, as a user would.
 *
 * The spaced variant matches the syntax but no configured tag — label lookup
 * is exact — so its chip shows the raw token. That label is not asserted; the
 * stored value, the chip count and the absence of leftover text are. Logic
 * tags need no configuration: their node is on for every syntax.
 *
 * Pasting goes through the node's PasteRule, TipTap's other rule path, so it
 * is guarded here too.
 */

/** Text of `scope` with every chip removed — what the user typed around it. */
function textOutsideChips(scope: Locator, chipSelector: string) {
  return scope.evaluate((el, sel) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(sel).forEach((chip) => chip.remove());
    return clone.textContent ?? "";
  }, chipSelector);
}

async function exportedMjml(page: Page): Promise<string> {
  await page.waitForFunction(
    () =>
      typeof (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
        .__tplPlaygroundGetMjml === "function",
  );
  return page.evaluate(() =>
    (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
      .__tplPlaygroundGetMjml!(),
  );
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Pastes `text` as plain text. A synthetic event with its own DataTransfer is
 * what ProseMirror's paste handler reads, and it keeps the OS clipboard —
 * shared by parallel workers — out of the test.
 */
async function pastePlainText(editable: Locator, text: string): Promise<void> {
  await editable.evaluate((el, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
}

const BLOCKS = [
  { type: "paragraph", initialText: "Hello." },
  { type: "title", initialText: "Greeting" },
] as const;

const MERGE_TAG = {
  chip: SELECTORS.mergeTagNode,
  stored: SELECTORS.mergeTagSpan,
  storedAttr: "data-merge-tag",
} as const;

const LOGIC_TAG = {
  chip: SELECTORS.logicMergeTagNode,
  stored: SELECTORS.logicMergeTagSpan,
  storedAttr: "data-logic-merge-tag",
} as const;

const TOKENS = [
  { name: "compact", typed: "{{first_name}}", ...MERGE_TAG },
  { name: "spaced", typed: "{{ first_name}}", ...MERGE_TAG },
  { name: "logic", typed: "{% if vip %}", ...LOGIC_TAG },
] as const;

type Token = (typeof TOKENS)[number];

/**
 * One chip carrying `token` and nothing else new: while editing, in the stored
 * content once the edit session ends, and in the export. `textBefore` is the
 * block's text up to the chip.
 */
async function expectOneChip(
  { editorPage, page }: { editorPage: EditorPage; page: Page },
  blockType: string,
  editable: Locator,
  token: Token,
  textBefore: string,
): Promise<void> {
  const chips = editable.locator(token.chip);
  await expect(chips).toHaveCount(1);
  await expect(chips.locator(`[data-tooltip="${token.typed}"]`)).toHaveCount(
    1,
  );
  expect(await textOutsideChips(editable, token.chip)).toBe(textBefore);
  await expect(page.locator(SELECTORS.mergeTagSuggestionPopup)).toHaveCount(0);

  // Leave the edit session; the block re-renders from stored content.
  // Only a click outside the editor ends it (Escape just deselects), and
  // the other block won't do: the paragraph's text toolbar covers the
  // short title in this scene.
  await editorPage.clickCanvasAwayFromSidebar();
  const stored = editorPage
    .getBlockByType(blockType)
    .first()
    .locator(".tpl-text-content");
  const storedChips = stored.locator(token.stored);
  await expect(storedChips).toHaveCount(1);
  await expect(storedChips).toHaveAttribute(token.storedAttr, token.typed);
  expect(await textOutsideChips(stored, token.stored)).toBe(textBefore);

  // The export carries the token exactly once, right after the text.
  const mjml = await exportedMjml(page);
  expect(countOccurrences(mjml, token.typed)).toBe(1);
  expect(mjml).toContain(`${textBefore}${token.typed}`);
  expect(mjml).not.toContain(token.storedAttr);
}

test.describe("Merge tag typed by hand", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("merge-tags");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.closeCodeDrawer();
  });

  for (const block of BLOCKS) {
    for (const token of TOKENS) {
      test(`${block.type}: typing ${token.name} ${token.typed} leaves one chip and no literal text`, async ({
        editorPage,
        page,
      }) => {
        // Caret placement goes through focusTextEditableAtEnd, never a native
        // End after the dblclick + click — see the Chromium note on it.
        await editorPage.doubleClickBlock(block.type);
        const editable = await editorPage.focusTextEditableAtEnd(block.type);

        await page.keyboard.type(` ${token.typed}`);

        await expectOneChip(
          { editorPage, page },
          block.type,
          editable,
          token,
          `${block.initialText} `,
        );
      });
    }

    test(`${block.type}: pasting "Hi {{first_name}}" leaves one chip and no literal text`, async ({
      editorPage,
      page,
    }) => {
      await editorPage.doubleClickBlock(block.type);
      const editable = await editorPage.focusTextEditableAtEnd(block.type);
      await page.keyboard.press("ControlOrMeta+a");

      await pastePlainText(editable, "Hi {{first_name}}");

      await expectOneChip(
        { editorPage, page },
        block.type,
        editable,
        TOKENS[0],
        "Hi ",
      );
    });
  }
});
