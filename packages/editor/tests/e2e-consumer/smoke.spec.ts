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
      hasRenderCustomBlock: typeof ed.renderCustomBlock === "function",
    };
  });

  expect(apiSurface).toEqual({
    hasGetContent: true,
    hasSetContent: true,
    hasUnmount: true,
    hasToMjml: true,
    hasRenderCustomBlock: true,
  });
});

test("editor.toMjml() resolves to a valid MJML string", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(
    () => typeof (window as unknown as { editor?: unknown }).editor === "object",
    null,
    { timeout: 30_000 },
  );

  const mjml = await page.evaluate(async () => {
    const ed = (window as unknown as {
      editor: { toMjml: () => Promise<string> };
    }).editor;
    return ed.toMjml();
  });

  expect(typeof mjml).toBe("string");
  expect(mjml).toContain("<mjml lang=\"en\">");
  expect(mjml).toContain("<mj-body");
  expect(mjml).toContain("</mjml>");
});

test("editor.toMjml() includes custom blocks in the output", async ({ page }) => {
  // Regression for issue #25: custom blocks were missing from MJML exports
  // because their renderedHtml was never persisted to block state. The fix
  // is the renderer's renderCustomBlock callback, wired by editor.toMjml()
  // through editor.renderCustomBlock. This end-to-end test exercises the
  // full path in a real browser against the published consumer surface.
  await page.goto("/");
  await page.waitForFunction(
    () => typeof (window as unknown as { editor?: unknown }).editor === "object",
    null,
    { timeout: 30_000 },
  );

  // Insert a custom block via setContent, then export.
  const { mjml, blocksAfter, renderedHtml } = await page.evaluate(async () => {
    const ed = (window as unknown as {
      editor: {
        getContent: () => unknown;
        setContent: (content: unknown) => void;
        toMjml: () => Promise<string>;
        renderCustomBlock: (block: unknown) => Promise<string>;
      };
    }).editor;

    const baseContent = ed.getContent() as { blocks: unknown[] };

    const customBlock = {
      id: "test-event-card-id",
      type: "custom",
      customType: "event-card",
      fieldValues: { title: "Annual Gala 2026" },
      styles: {
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };

    ed.setContent({ ...baseContent, blocks: [...baseContent.blocks, customBlock] });

    const blocksAfter = (ed.getContent() as { blocks: unknown[] }).blocks.length;
    const renderedHtml = await ed.renderCustomBlock(customBlock);
    const mjml = await ed.toMjml();
    return { mjml, blocksAfter, renderedHtml };
  });

  // Diagnostic: confirm setContent landed and direct render works.
  expect(blocksAfter).toBe(1);
  expect(renderedHtml).toContain("Annual Gala 2026");

  // The custom block's liquid template renders {{ title }} → 'Annual Gala 2026'
  // wrapped in the configured <div class="event">…</div>. The renderer wraps
  // that HTML in an <mj-text> for emission. If the customBlock pipeline
  // breaks (regression), this assertion fails.
  expect(mjml).toContain("Annual Gala 2026");
  expect(mjml).toContain('class="event"');
});
