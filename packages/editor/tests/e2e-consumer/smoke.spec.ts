import { test, expect } from "@playwright/test";

/**
 * Real-browser smoke against the editor's packed-and-installed tarball, served
 * by an ephemeral vanilla-HTML consumer materialized at run time from
 * `packages/editor/tests/e2e-fixtures/vanilla-consumer/`. See
 * `packages/editor/scripts/e2e-consumer-prepare.mjs` and
 * `playwright.consumer.config.ts`.
 *
 * Specifically guards the duplicate-Vue-reactivity-instance regression that
 * shipped briefly in 0.1.1: if `@templatical/core` re-becomes external, the
 * editor renders chrome but every interaction silently no-ops. The bundle
 * topology unit test catches the precondition; this catches the user-visible
 * effect end-to-end.
 */

test("editor mounts and inserts a block when sidebar palette item is clicked", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
  });

  await page.goto("/");

  const editor = page.locator("#editor");
  await expect(editor).toBeVisible();

  // The sidebar emits one button per palette block, each with a stable
  // `data-palette-type` attribute (set in Sidebar.vue). Wait for at least one.
  const paletteButton = editor.locator("button[data-palette-type]").first();
  await expect(paletteButton).toBeVisible();

  // Pre-condition: empty canvas (no rendered blocks yet).
  const blocksBefore = await editor.locator("[data-block-type]").count();
  expect(blocksBefore).toBe(0);

  // Click — the button has both `@click` (insert) and Sortable.js drag wired
  // up. Click is the simpler path and is the one that broke in 0.1.1.
  await paletteButton.click();

  // After insertion at least one block should be on the canvas. Poll to give
  // Vue's reactivity one tick to flush.
  await expect
    .poll(async () => editor.locator("[data-block-type]").count())
    .toBeGreaterThan(0);

  expect(consoleErrors).toEqual([]);
});

test("editor exposes the documented public API on window", async ({ page }) => {
  // The fixture stashes the editor instance on `window.editor`. If init
  // resolved, the documented methods exist.
  await page.goto("/");
  await page.waitForFunction(
    () => typeof (window as unknown as { editor?: unknown }).editor === "object",
    null,
    { timeout: 30_000 },
  );

  const apiSurface = await page.evaluate(() => {
    const ed = (window as unknown as { editor: Record<string, unknown> }).editor;
    return {
      hasGetContent: typeof ed.getContent === "function",
      hasSetContent: typeof ed.setContent === "function",
      hasUnmount: typeof ed.unmount === "function",
      hasToMjml: typeof ed.toMjml === "function",
    };
  });

  expect(apiSurface).toEqual({
    hasGetContent: true,
    hasSetContent: true,
    hasUnmount: true,
    hasToMjml: true,
  });
});
