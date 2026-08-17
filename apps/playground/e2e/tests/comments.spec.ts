import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The BYO comments provider in the OSS editor, backed by the playground's
 * localStorage store (`commentsProviderFor` in `apps/playground/src/App.vue`).
 *
 * What the playground can express bounds this spec. Its provider has **no
 * `subscribe`** — one browser tab with no backend has nothing to push — which is
 * itself the point worth covering here: comments work identically without
 * realtime. The push path, the no-`user` degradation and the per-mutation gates
 * that need more than one shape live in `useCommentsFeature.test.ts` /
 * `commentsSidebar.test.ts`, where they don't need test-only UI in front of
 * visitors.
 */

// `selectFirstTemplate()` opens Product Launch, so that's the conversation.
const COMMENTS_KEY = "templatical:comments:product-launch";

type StoredComment = {
  id: string;
  body: string;
  resolvedAt: string | null;
  replies?: StoredComment[];
};

async function readComments(page: Page): Promise<StoredComment[]> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredComment[]) : [];
  }, COMMENTS_KEY);
}

/**
 * Storage flags go through `addInitScript` because the provider is built during
 * the editor's mount — writing them after `goto()` races the initial load.
 *
 * `comments` is seeded the same way, so a read-only run has something to read.
 */
async function openEditor(options: {
  page: Page;
  chooserPage: {
    goto: () => Promise<void>;
    selectFirstTemplate: () => Promise<void>;
  };
  editorPage: {
    waitForReady: () => Promise<void>;
    dismissOverlays: () => Promise<void>;
  };
  flags?: Record<string, string>;
  seed?: StoredComment[];
}): Promise<void> {
  const { page, chooserPage, editorPage } = options;
  await page.addInitScript(
    ({ entries, key, seed }) => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
      localStorage.removeItem(key as string);
      for (const [flag, value] of entries as [string, string][]) {
        localStorage.setItem(flag, value);
      }
      if (seed) localStorage.setItem(key as string, JSON.stringify(seed));
    },
    {
      entries: Object.entries(options.flags ?? {}),
      key: COMMENTS_KEY,
      seed: options.seed ?? null,
    },
  );
  await chooserPage.goto();
  await chooserPage.selectFirstTemplate();
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
}

function seededComment(
  id: string,
  overrides: Partial<StoredComment> = {},
): StoredComment {
  return {
    id,
    body: `seeded ${id}`,
    resolvedAt: null,
    // The playground's own user, so edit and delete are offered on these.
    author: { id: "playground-user", name: "Playground User" },
    createdAt: "2020-01-01T10:00:00Z",
    blockId: null,
    parentId: null,
    ...overrides,
  } as StoredComment;
}

test.describe("comments provider", () => {
  test("the trigger renders once a template is attached", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await openEditor({ page, chooserPage, editorPage });

    // The playground stores the chosen template on mount, so a template exists by
    // the time the editor is ready.
    await expect(page.locator(SELECTORS.commentsTrigger)).toBeVisible();
  });

  test("opens the panel, writes a comment and persists it", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await openEditor({ page, chooserPage, editorPage });

    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentsSidebar)).toBeVisible();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(0);

    await page.locator(SELECTORS.commentsInput).fill("Headline reads long");
    await page.locator(SELECTORS.commentsSend).click();

    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);
    await expect
      .poll(async () => (await readComments(page)).map((c) => c.body))
      .toEqual(["Headline reads long"]);
  });

  test("shifts the properties panel out from under itself", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    // Both sit at `right-0`. Without the shift the comments panel covers the
    // properties panel and swallows every click meant for it — which is how this
    // was found: the composer's Send button was "visible, enabled and stable" and
    // un-clickable, because `RightSidebar` intercepted the pointer.
    await openEditor({ page, chooserPage, editorPage });

    const properties = page.locator(".tpl-right-sidebar");
    const rightEdge = async () => {
      const box = (await properties.boundingBox())!;
      return Math.round(box.x + box.width);
    };

    // Measured as a delta rather than against the viewport, which a scrollbar
    // makes 16px wider than the laid-out width.
    const closed = await rightEdge();

    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentsSidebar)).toBeVisible();

    // Polled to the *exact* final offset, not merely to "it moved left": the panel
    // animates over 200ms, so a mid-transition read still overlaps.
    await expect.poll(rightEdge).toBe(closed - 360);
  });

  test("the unresolved count reaches the trigger", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await openEditor({
      page,
      chooserPage,
      editorPage,
      seed: [seededComment("c-1"), seededComment("c-2")],
    });

    // The badge only renders while the panel is closed, so open and close to make
    // the list load first — the same lazy read a real session does.
    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(2);
    await page.locator(SELECTORS.commentsTrigger).click();

    await expect(page.locator(SELECTORS.commentsTrigger)).toHaveAttribute(
      "aria-label",
      /\(2\)/,
    );
  });

  test("resolving a thread persists and drops it from the default filter", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await openEditor({
      page,
      chooserPage,
      editorPage,
      seed: [seededComment("c-1")],
    });

    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);

    await page.locator(SELECTORS.commentResolve).first().click();

    // Filtered out of the default (unresolved) view, and still there under All.
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(0);
    await page.locator(SELECTORS.commentsFilterAll).click();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);

    await expect
      .poll(async () => (await readComments(page))[0]?.resolvedAt !== null)
      .toBe(true);
  });

  test("deleting a thread removes it from the store", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await openEditor({
      page,
      chooserPage,
      editorPage,
      seed: [seededComment("c-1"), seededComment("c-2")],
    });

    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(2);

    await page.locator(SELECTORS.commentDelete).first().click();
    // A confirm strip appears in place of the body. `deletingId` is a single ref,
    // so exactly one is rendered — assert that, then the click needs no scoping.
    await expect(page.locator(SELECTORS.commentDeleteConfirm)).toHaveCount(1);
    await page.locator(SELECTORS.commentDeleteConfirm).click();

    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);
    await expect
      .poll(async () => (await readComments(page)).length)
      .toBe(1);
  });

  test.describe("read-only review", () => {
    // `tpl-playground-comments-readonly` makes the demo provider withhold all four
    // mutations by passing `false` — the read-only tier of the contract.
    test("renders the threads with no way to change them", async ({
      page,
      chooserPage,
      editorPage,
    }) => {
      await openEditor({
        page,
        chooserPage,
        editorPage,
        flags: { "tpl-playground-comments-readonly": "true" },
        seed: [seededComment("c-1", { body: "read me" })],
      });

      await page.locator(SELECTORS.commentsTrigger).click();
      await expect(page.locator(SELECTORS.commentsSidebar)).toBeVisible();

      // The conversation is readable...
      await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);
      await expect(page.locator(SELECTORS.commentsSidebar)).toContainText(
        "read me",
      );

      // ...and every write affordance is absent rather than disabled.
      await expect(page.locator(SELECTORS.commentsInput)).toHaveCount(0);
      await expect(page.locator(SELECTORS.commentsSend)).toHaveCount(0);
      await expect(page.locator(SELECTORS.commentResolve)).toHaveCount(0);
      await expect(page.locator(SELECTORS.commentEdit)).toHaveCount(0);
      await expect(page.locator(SELECTORS.commentDelete)).toHaveCount(0);
      await expect(page.locator(SELECTORS.commentReply)).toHaveCount(0);
    });

    test("still offers the filters, so the review is navigable", async ({
      page,
      chooserPage,
      editorPage,
    }) => {
      await openEditor({
        page,
        chooserPage,
        editorPage,
        flags: { "tpl-playground-comments-readonly": "true" },
        seed: [
          seededComment("c-1", { body: "open one" }),
          seededComment("c-2", {
            body: "closed one",
            resolvedAt: "2026-08-17T12:00:00Z",
          }),
        ],
      });

      await page.locator(SELECTORS.commentsTrigger).click();
      await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);

      await page.locator(SELECTORS.commentsFilterAll).click();
      await expect(page.locator(SELECTORS.commentThread)).toHaveCount(2);
    });
  });
});
