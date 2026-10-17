import type { Page } from "@playwright/test";

/**
 * Captures what the page copies, so a spec never reads the OS clipboard:
 * CI's parallel workers share it, and another spec's copy can land between
 * one spec's write and its read.
 *
 * VueUse 15's `useClipboard` copies with `navigator.clipboard.write` while
 * `clipboard-write` reads granted or prompt (Playwright's Chromium starts at
 * prompt), and falls back to `execCommand("copy")` otherwise; the grant pins
 * it to `write`. The stub covers the current document and every later one,
 * so call this anywhere before the copy, before or after navigating.
 */
export async function captureCopies(page: Page): Promise<void> {
  await page.context().grantPermissions(["clipboard-write"]);
  await page.addInitScript(stubClipboardWrite);
  await page.evaluate(stubClipboardWrite);
}

/** The text of the page's last copy; `undefined` before the first. */
export function copiedText(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as { __copied?: string }).__copied);
}

/** Runs in the page, so it can only use the page's globals. */
function stubClipboardWrite(): void {
  // Insecure documents, the blank one before the first `goto` among them,
  // have no clipboard.
  if (!navigator.clipboard) return;
  const target = window as { __copied?: string };
  Object.defineProperty(navigator.clipboard, "write", {
    configurable: true,
    value: async (items: ClipboardItem[]) => {
      const blob = await items[0].getType("text/plain");
      target.__copied = await blob.text();
    },
  });
}
