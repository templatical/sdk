import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { exportedParagraphAlignment } from "../helpers/exported-paragraph";
import { SELECTORS } from "../helpers/selectors";
import { EditorPage } from "../pages/editor.page";
import { ScenePage } from "../pages/scene.page";

function watchVueWarnings(page: Page, warnings: string[]) {
  page.on("console", (message) => {
    if (message.text().includes("[Vue warn]")) warnings.push(message.text());
  });
}

async function selectLanguage(page: Page, locale: string) {
  await page.getByTestId("language-menu").click();
  await page.getByTestId(`language-option-${locale}`).click();
}

async function mountChipPreview(
  page: Page,
  shadowDom: boolean,
  kind:
    | "hidden"
    | "nested"
    | "long"
    | "short"
    | "comments-off"
    | "corners"
    | "tags",
  width?: number,
) {
  await page.evaluate(
    async ({ shadowDom, kind, width }) => {
      const runtimePath = "/src/host/useSceneInit.ts";
      const scenePath = "/src/scenes/author/languages.ts";
      const { mountScene } = await import(/* @vite-ignore */ runtimePath);
      const { languages } = await import(/* @vite-ignore */ scenePath);
      const ctx = { search: new URLSearchParams() };
      const content = languages.content(ctx);
      const config = languages.config(ctx);
      if (kind === "hidden" || kind === "nested") {
        const fixturePath = "/e2e/helpers/language-chip-content.ts";
        const { hiddenSectionContent } = await import(
          /* @vite-ignore */ fixturePath
        );
        content.blocks = hiddenSectionContent(
          content,
          kind === "nested",
        ).blocks;
      } else if (kind === "corners") {
        const fixturePath = "/e2e/helpers/language-chip-content.ts";
        const { cornerBadgeContent } = await import(
          /* @vite-ignore */ fixturePath
        );
        content.blocks = cornerBadgeContent(content).blocks;
      } else if (kind === "tags") {
        const block = content.blocks[1];
        block.alt = "Hello {{first_name}}";
        block.l10n.de.text = {
          alt: { value: "Hallo", sourceHash: "00000000" },
        };
        content.blocks = [block];
      } else if (kind === "short") {
        const block = content.blocks[3];
        block.styles.padding = { top: 0, right: 0, bottom: 0, left: 0 };
        block.displayCondition = {
          label: "VIP",
          before: "{% if vip %}",
          after: "{% endif %}",
        };
        content.blocks = [block];
      } else if (kind === "long") {
        const locales = [
          "de",
          "fr",
          "ar",
          "es",
          "it",
          "pt",
          "nl",
          "sv",
          "da",
          "fi",
          "no",
          "pl",
          "cs",
          "ro",
          "hu",
          "tr",
          "el",
          "ja",
          "ko",
          "zh",
        ];
        content.settings.locales = locales;
        delete content.settings.l10n;
        const title = content.blocks[0];
        title.l10n = Object.fromEntries(
          locales.map((locale) => [
            locale,
            {
              text: {
                content: { value: title.content, sourceHash: "00000000" },
              },
            },
          ]),
        );
        content.blocks = [title];
        config.localization = { locales };
      } else {
        config.localization = undefined;
        const root = await config.comments.create("chip-preview", {
          body: "A German review",
          locale: "de",
        });
        await config.comments.create("chip-preview", {
          body: "An English reply",
          parentId: root.id,
          locale: "en",
        });
      }
      const container = document.createElement("div");
      container.id = "language-chip-preview";
      Object.assign(container.style, {
        position: "fixed",
        inset: "0",
        zIndex: "100000",
      });
      if (width) {
        container.style.inset = "0 auto 0 0";
        container.style.width = `${width}px`;
      }
      document.body.append(container);
      const editor = await mountScene(
        {
          ...languages,
          content: () => content,
          config: () => ({
            ...config,
            shadowDom,
            branding: false,
            templates: {
              load: async (id: string) => ({ id, content }),
              create: false,
              save: false,
            },
          }),
          open: async (instance: {
            load: (id: string) => Promise<unknown>;
          }) => {
            await instance.load("chip-preview");
          },
        },
        container,
        ctx,
      );
      (window as any).__languageChipCleanup = () => {
        editor.unmount();
        container.remove();
      };
    },
    { shadowDom, kind, width },
  );
}

test.describe("language versions", () => {
  let vueWarnings: string[];

  test.beforeEach(async ({ page }) => {
    vueWarnings = [];
    watchVueWarnings(page, vueWarnings);
  });

  test.afterEach(() => {
    expect(vueWarnings, "page console must contain no Vue warnings").toEqual(
      [],
    );
  });

  test("keeps child chips suppressed until their hidden German section is shown", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "hidden");
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("language-menu").click();
      await host.getByTestId("language-option-de").click();
      for (const id of ["languages-copy", "languages-stale"])
        await expect(
          host.locator(`[data-block-id="${id}"]`).getByTestId("locale-chip"),
        ).toHaveCount(0);
      await host
        .locator(
          '[data-block-id="hidden-section"] > .tpl-block-badges > [data-testid="locale-chip"]',
        )
        .click();
      await host.getByTestId("locale-show").click();
      await expect(
        host
          .locator('[data-block-id="languages-copy"]')
          .getByTestId("locale-chip"),
      ).toHaveAttribute("data-state", "missing");
      const stale = host.locator('[data-block-id="languages-stale"]');
      await expect(stale.getByTestId("locale-chip")).toHaveAttribute(
        "data-state",
        "stale",
      );
      await stale.getByTestId("locale-chip").click();
      await host.getByTestId("locale-retranslate").click();
      await expect(host.getByTestId("translation-result")).toHaveText(
        "Translated 1 field.",
      );
      await expect(stale).toContainText(
        "Das Angebot von Sable endet am Freitag.",
      );
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps loaded nested-section descendants hidden through Show and undo", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "nested");
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("language-menu").click();
      await host.getByTestId("language-option-de").click();
      await expect(
        host.locator('[data-block-id="outer-section"]'),
      ).not.toHaveClass(/tpl-block--locale-hidden/);
      const innerChip = host.locator(
        '[data-block-id="hidden-section"] > .tpl-block-badges > [data-testid="locale-chip"]',
      );
      for (const id of ["languages-copy", "languages-stale"])
        await expect(
          host.locator(`[data-block-id="${id}"]`).getByTestId("locale-chip"),
        ).toHaveCount(0);
      await innerChip.click();
      await host.getByTestId("locale-show").click();
      await expect(
        host
          .locator('[data-block-id="languages-copy"]')
          .getByTestId("locale-chip"),
      ).toHaveAttribute("data-state", "missing");
      const staleChip = host
        .locator('[data-block-id="languages-stale"]')
        .getByTestId("locale-chip");
      await expect(staleChip).toHaveAttribute("data-state", "stale");
      await staleChip.click();
      await expect(host.getByTestId("locale-retranslate")).toBeVisible();
      await page.keyboard.press("ControlOrMeta+z");
      await expect(innerChip).toHaveAttribute("data-state", "hidden");
      for (const id of ["languages-copy", "languages-stale"])
        await expect(
          host.locator(`[data-block-id="${id}"]`).getByTestId("locale-chip"),
        ).toHaveCount(0);
      await expect(host.getByTestId("locale-popover")).toHaveCount(0);
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps root and reply comments readable without language UI when localization is omitted", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "comments-off");
    const host = page.locator("#language-chip-preview");
    try {
      await expect(host.getByTestId("language-menu")).toHaveCount(0);
      await host.getByTestId("comments-trigger").click();
      const thread = host
        .getByTestId("comment-thread")
        .filter({ hasText: "A German review" });
      await expect(thread).toBeVisible();
      await thread
        .getByRole("button", { name: "1 Reply", exact: true })
        .click();
      await expect(thread).toContainText("An English reply");
      await expect(host.getByTestId("comment-locale-badge")).toHaveCount(0);
      await expect(host.getByTestId("comments-filter-language")).toHaveCount(0);
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps the same popover action attached when an opening scroll notification arrives", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    const chip = stale.getByTestId("locale-chip");
    await chip.click();
    const action = page.getByTestId("locale-keep");
    const original = await action.elementHandle();
    expect(original).not.toBeNull();
    await chip.evaluate((element) => {
      element.closest(".tpl-canvas")!.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect(await original!.evaluate((element) => element.isConnected)).toBe(
      true,
    );
    await action.click();
    await expect(stale.getByTestId("locale-chip")).toHaveCount(0);
  });

  for (const width of [1280, 768]) {
    test(`keeps both column badges reachable in a ${width}px editor, including nested and framed sections`, async ({
      page,
      scenePage,
      editorPage,
      shadowDom,
    }) => {
      await scenePage.goto("languages");
      await editorPage.waitForReady();
      await editorPage.dismissOverlays();
      await mountChipPreview(page, shadowDom, "corners", width);
      const host = page.locator("#language-chip-preview");
      try {
        const boxes = () =>
          host.locator(".tpl-canvas").evaluate((canvas) => {
            const origin = canvas.getBoundingClientRect();
            return [...canvas.querySelectorAll<HTMLElement>(".tpl-block")].map(
              (block) => {
                const box = block.getBoundingClientRect();
                return {
                  id: block.dataset.blockId,
                  x: box.x - origin.x,
                  y: box.y - origin.y,
                  width: box.width,
                  height: box.height,
                };
              },
            );
          });
        const english = await boxes();
        for (const locale of ["de", "ar"]) {
          await host.getByTestId("language-menu").click();
          await host.getByTestId(`language-option-${locale}`).click();
          if (locale === "de") expect(await boxes()).toEqual(english);
          for (const id of ["corner-first", "corner-second"]) {
            const badge = host
              .locator(`[data-block-id="${id}"]`)
              .getByTestId("locale-chip");
            const geometry = await badge.evaluate((element) => {
              const owner = element.closest(".tpl-block")!;
              const block = owner.getBoundingClientRect();
              const box = element.getBoundingClientRect();
              const rtl = getComputedStyle(element).direction === "rtl";
              const overlap = [
                ...owner
                  .closest(".tpl-canvas")!
                  .querySelectorAll<HTMLElement>(".tpl-block"),
              ].some((other) => {
                if (
                  other === owner ||
                  other.contains(owner) ||
                  owner.contains(other)
                )
                  return false;
                const b = other.getBoundingClientRect();
                return (
                  box.left < b.right &&
                  b.left < box.right &&
                  box.top < b.bottom &&
                  b.top < box.bottom
                );
              });
              return {
                corner:
                  Math.abs(
                    (rtl ? box.left - block.left : block.right - box.right) - 4,
                  ) < 1 && Math.abs(box.top - block.top - 4) < 1,
                overlap,
              };
            });
            expect(geometry).toEqual({ corner: true, overlap: false });
            if (id === "corner-first") {
              const lintBadge = host.locator(
                `[data-block-id="${id}"] > .tpl-block-badges > .tpl-block-issue-badge`,
              );
              await expect(lintBadge).toBeVisible();
              // Hit-tested: nothing covers it.
              await lintBadge.hover({ trial: true });
              const lintBox = (await lintBadge.boundingBox())!;
              const localeBox = (await badge.boundingBox())!;
              expect(
                locale === "ar"
                  ? localeBox.x + localeBox.width <= lintBox.x
                  : lintBox.x + lintBox.width <= localeBox.x,
              ).toBe(true);
            }
            await badge.click();
            await expect(host.getByTestId("locale-popover")).toBeVisible();
            await page.keyboard.press("Escape");
          }
        }
      } finally {
        await page.evaluate(() => (window as any).__languageChipCleanup?.());
      }
    });
  }

  test("keeps a selected block's actions clickable above nearby badges in a narrow canvas", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    // The playground's editor width at 1280 × 720: the canvas pane has no
    // room for the action bar beside a full-width block, so it moves inside.
    await mountChipPreview(page, shadowDom, "corners", 1040);
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("language-menu").click();
      await host.getByTestId("language-option-de").click();
      const actions = host.locator(".tpl-block-actions");
      // Trial clicks hit-test a button's centre only; sample nine points so
      // a badge painted over part of a button counts as covering it.
      const coveredButtons = () =>
        actions.evaluate((bar) => {
          const root = bar.getRootNode() as Document | ShadowRoot;
          return [...bar.querySelectorAll("button")].flatMap((button) => {
            const box = button.getBoundingClientRect();
            return [0.2, 0.5, 0.8].flatMap((fx) =>
              [0.2, 0.5, 0.8].flatMap((fy) => {
                const hit = root.elementFromPoint(
                  box.left + box.width * fx,
                  box.top + box.height * fy,
                );
                return hit && button.contains(hit)
                  ? []
                  : [`${button.getAttribute("aria-label")} ${fx},${fy}`];
              }),
            );
          });
        });
      const section = host.locator('[data-block-id="corner-columns"]');
      // The section's frame, outside both columns.
      await section.click({ position: { x: 6, y: 6 } });
      await expect(section).toHaveClass(/tpl-block--selected/);
      const sectionBox = (await section.boundingBox())!;
      expect((await actions.boundingBox())!.x).toBeLessThan(
        sectionBox.x + sectionBox.width,
      );
      for (const button of await actions.locator("button").all())
        await button.click({ trial: true });
      expect(await coveredButtons()).toEqual([]);
      const short = host.locator('[data-block-id="corner-short"]');
      await short.click({ position: { x: 20, y: 6 } });
      await expect(short).toHaveClass(/tpl-block--selected/);
      for (const button of await actions.locator("button").all())
        await button.click({ trial: true });
      expect(await coveredButtons()).toEqual([]);
      await host
        .locator('[data-block-id="corner-next"]')
        .getByTestId("locale-chip")
        .hover({ trial: true });
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  for (const locale of ["de", "ar"]) {
    test(`keeps a selected short block's own badge uncovered in ${locale} in a narrow canvas`, async ({
      page,
      scenePage,
      editorPage,
      shadowDom,
    }) => {
      await scenePage.goto("languages");
      await editorPage.waitForReady();
      await editorPage.dismissOverlays();
      await mountChipPreview(page, shadowDom, "corners", 1040);
      const host = page.locator("#language-chip-preview");
      try {
        await host.getByTestId("language-menu").click();
        await host.getByTestId(`language-option-${locale}`).click();
        const short = host.locator('[data-block-id="corner-short"]');
        const shortBox = (await short.boundingBox())!;
        await short.click({ position: { x: shortBox.width / 2, y: 6 } });
        await expect(short).toHaveClass(/tpl-block--selected/);
        const badge = short.getByTestId("locale-chip");
        await badge.hover({ trial: true });
        expect(
          await badge.evaluate((element) => {
            const root = element.getRootNode() as Document | ShadowRoot;
            const box = element.getBoundingClientRect();
            // The box's corners lie outside the circular badge's hit area.
            return [0.2, 0.5, 0.8].every((x) =>
              [0.2, 0.5, 0.8].every((y) => {
                const hit = root.elementFromPoint(
                  box.left + box.width * x,
                  box.top + box.height * y,
                );
                return hit !== null && element.contains(hit);
              }),
            );
          }),
        ).toBe(true);
        const bar = await short.locator(".tpl-block-actions").boundingBox();
        const slot = await short.locator(".tpl-block-badges").boundingBox();
        expect(bar).not.toBeNull();
        expect(slot).not.toBeNull();
        if (locale === "de")
          expect(bar!.x + bar!.width).toBeLessThanOrEqual(slot!.x - 4);
        else expect(bar!.x).toBeGreaterThanOrEqual(slot!.x + slot!.width + 4);
        expect(
          await host
            .locator(".tpl-body")
            .evaluate((pane) => pane.scrollWidth <= pane.clientWidth),
        ).toBe(true);
      } finally {
        await page.evaluate(() => (window as any).__languageChipCleanup?.());
      }
    });
  }

  test("keeps the language bar's label and status on one line each in a 768px window", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const bar = page.getByTestId("language-bar");
    await expect(bar.getByTestId("language-bar-label")).toHaveText(
      "Editing Deutsch",
    );
    await expect(bar.getByTestId("language-bar-status")).toHaveText(
      "1 missing, 1 out of date",
    );
    for (const id of ["language-bar-label", "language-bar-status"])
      expect(
        await bar.getByTestId(id).evaluate((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.height / Number.parseFloat(getComputedStyle(element).fontSize)
          );
        }),
        id,
      ).toBeLessThan(2);
  });

  test("opens a fresh merge-tag mismatch from Issues and restores English without clearing other overrides", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "tags");
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("language-menu").click();
      await host.getByTestId("language-option-de").click();
      const badge = host.getByTestId("locale-chip");
      await badge.click();
      await host.getByTestId("locale-keep").click();
      await expect(badge).toHaveAttribute("data-state", "tags-differ");
      await expect(badge).toHaveAccessibleName("Merge tags differ");
      await host.locator("#tpl-tab-issues").click();
      const issue = host.locator("li").filter({ hasText: "merge-tags-differ" });
      await issue.getByTestId("issue-jump").click();
      await expect(host.getByTestId("locale-popover")).toContainText(
        "Its merge tags don't match the English text.",
      );
      await expect(host.getByTestId("locale-retranslate")).toBeVisible();
      await expect(host.getByTestId("locale-keep")).toHaveCount(0);
      await host.getByTestId("locale-use-default").click();
      await expect(badge).toHaveAttribute("data-state", "missing");
      await expect(
        host.locator('[data-block-id="languages-hero"] img'),
      ).toHaveAttribute("src", "/examples/sable/buds.png");
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps a short block's corner badge clear of its drag and condition controls", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "short");
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("language-menu").click();
      await host.getByTestId("language-option-de").click();
      const block = host.locator('[data-block-id="languages-stale"]');
      await block.locator(".tpl-block-content").click();
      expect((await block.boundingBox())!.height).toBeLessThan(48);
      const chip = block.getByTestId("locale-chip");
      const chipBox = (await chip.boundingBox())!;
      const blockBox = (await block.boundingBox())!;
      expect(chipBox.x + chipBox.width).toBeCloseTo(
        blockBox.x + blockBox.width - 4,
        1,
      );
      expect(chipBox.y).toBeCloseTo(blockBox.y + 4, 1);
      for (const control of [
        block.locator(".tpl-block-btn"),
        block.getByTestId("condition-toggle"),
      ]) {
        await control.click({ trial: true });
        const box = (await control.boundingBox())!;
        expect(
          chipBox.x + chipBox.width <= box.x ||
            box.x + box.width <= chipBox.x ||
            chipBox.y + chipBox.height <= box.y ||
            box.y + box.height <= chipBox.y,
        ).toBe(true);
      }
      await chip.click();
      await expect(host.getByTestId("locale-popover")).toBeVisible();
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps localization warnings in Issues and opens the chip without a duplicate block badge", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const block = page.locator('[data-block-id="languages-stale"]');
    await expect(
      block.locator('[role="img"][aria-label="Has warnings"]'),
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Issues", exact: true }).click();
    const issue = page.locator("li").filter({ hasText: "localization.stale" });
    await expect(issue).toBeVisible();
    await issue.getByTestId("issue-jump").click();
    await expect(page.getByTestId("locale-popover")).toHaveAttribute(
      "aria-label",
      "Out of date",
    );
  });

  test("explains disabled promotion in a focusable menu item", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("language-actions-de").click();
    const action = page.getByTestId("language-make-default-de");
    await expect(action).toBeFocused();
    await expect(action).toHaveAttribute("aria-disabled", "true");
    expect(await action.getAttribute("disabled")).toBeNull();
    const reason = page.locator(
      `[id="${await action.getAttribute("aria-describedby")}"]`,
    );
    await expect(reason).toHaveText("Show the 1 block hidden in Deutsch first");
    await expect(reason).toBeVisible();
    // The unavailable item reads as unavailable: muted label, dim icon.
    expect(
      await action.evaluate((element) => {
        const token = (name: string) => {
          const probe = document.createElement("span");
          probe.style.color = `var(${name})`;
          element.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        };
        return {
          label: getComputedStyle(element).color === token("--tpl-text-muted"),
          icon:
            getComputedStyle(element.querySelector("svg")!).color ===
            token("--tpl-text-dim"),
        };
      }),
    ).toEqual({ label: true, icon: true });
    // The active row's tint is the pill's usual fill, so its pill takes paper.
    expect(
      await page.getByTestId("language-option-en").evaluate((element) => {
        const row = element.closest(".tpl-language-row")!;
        const pill = element.querySelector(".tpl-language-pill")!;
        return (
          getComputedStyle(pill).backgroundColor !==
          getComputedStyle(row).backgroundColor
        );
      }),
    ).toBe(true);
    await action.press("Enter");
    await expect(page.getByTestId("language-default-confirm")).toHaveCount(0);
  });

  // The scale variant keeps English, its default, out of `localization.locales`.
  test("explains disabled promotion while the default isn't an enabled language", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages", { scale: "1" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("language-actions-de").click();
    const action = page.getByTestId("language-make-default-de");
    await expect(action).toBeFocused();
    await expect(action).toHaveAttribute("aria-disabled", "true");
    const reason = page.locator(
      `[id="${await action.getAttribute("aria-describedby")}"]`,
    );
    await expect(reason).toHaveText(
      "Add English to the enabled languages first",
    );
    await expect(reason).toBeVisible();
    await action.press("Enter");
    await expect(page.getByTestId("language-default-confirm")).toHaveCount(0);
  });

  test("flips a bottom-edge stale popover above its chip and keeps Keep reachable", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    const chip = stale.getByTestId("locale-chip");
    await page
      .locator('[data-block-id="languages-hero"] img')
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
      });
    await chip.evaluate((element) => {
      (element.closest(".tpl-canvas") as HTMLElement).style.paddingBottom =
        "800px";
      let scroller = element.parentElement;
      while (
        scroller &&
        !(
          /auto|scroll/.test(getComputedStyle(scroller).overflowY) &&
          scroller.scrollHeight > scroller.clientHeight
        )
      )
        scroller = scroller.parentElement;
      if (!scroller) throw new Error("Canvas scroll container not found");
      scroller.scrollTop +=
        element.getBoundingClientRect().top - (window.innerHeight - 60);
    });
    await expect
      .poll(async () => (await chip.boundingBox())!.y)
      .toBeGreaterThan(510);
    const anchor = (await chip.boundingBox())!;
    await chip.click();
    const popover = page.getByTestId("locale-popover");
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(anchor.y - 3);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.y + box.height).toBeLessThanOrEqual(592);
    await popover.getByTestId("locale-keep").click();
    await expect(stale.getByTestId("locale-chip")).toHaveCount(0);
  });

  test("scrolls a long stale-language list inside a viewport-bounded popover", async ({
    page,
    scenePage,
    editorPage,
    shadowDom,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await mountChipPreview(page, shadowDom, "long");
    const host = page.locator("#language-chip-preview");
    try {
      await host.getByTestId("locale-chip").click();
      const popover = host.getByTestId("locale-popover");
      await expect(popover).toBeVisible();
      const box = (await popover.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(8);
      expect(box.y + box.height).toBeLessThanOrEqual(592);
      expect(
        await popover.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      ).toBe(true);
      const last = popover
        .getByRole("button", { name: "Open", exact: true })
        .last();
      await last.scrollIntoViewIfNeeded();
      await expect(popover).toBeVisible();
      await last.click();
      await expect(popover).toHaveCount(0);
      await host.getByTestId("language-menu").click();
      await expect(host.getByTestId("language-option-zh")).toHaveAttribute(
        "aria-checked",
        "true",
      );
    } finally {
      await page.evaluate(() => (window as any).__languageChipCleanup?.());
    }
  });

  test("keeps every block box relative to the email root equal across language views", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page
      .locator('[data-block-id="languages-hero"] img')
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
      });
    const boxes = () =>
      page.locator(SELECTORS.canvas).evaluate((root) => {
        const origin = root.getBoundingClientRect();
        return [...root.querySelectorAll<HTMLElement>("[data-block-id]")].map(
          (block) => {
            const box = block.getBoundingClientRect();
            return {
              id: block.dataset.blockId,
              x: box.x - origin.x,
              y: box.y - origin.y,
              width: box.width,
              height: box.height,
            };
          },
        );
      });
    const english = await boxes();
    await selectLanguage(page, "de");
    await page
      .locator('[data-block-id="languages-hero"] img')
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
      });
    expect(await boxes()).toEqual(english);
    for (const chip of await page.getByTestId("locale-chip").all()) {
      const geometry = await chip.evaluate((element) => {
        const block = element.closest(".tpl-block")!;
        const a = element.getBoundingClientRect();
        const b = block.getBoundingClientRect();
        // Blocks other than this one, its ancestors and its descendants.
        const covered = [
          ...block
            .closest(".tpl-canvas")!
            .querySelectorAll<HTMLElement>(".tpl-block"),
        ]
          .filter(
            (other) =>
              other !== block &&
              !other.contains(block) &&
              !block.contains(other),
          )
          .filter((other) => {
            const c = other.getBoundingClientRect();
            return (
              a.left < c.right &&
              c.left < a.right &&
              a.top < c.bottom &&
              c.top < a.bottom
            );
          })
          .map((other) => other.dataset.blockId);
        return {
          width: a.width,
          corner:
            Math.abs(a.right - (b.right - 4)) < 1 &&
            Math.abs(a.top - (b.top + 4)) < 1,
          label: element.getAttribute("aria-label"),
          covered,
        };
      });
      expect(geometry.width).toBe(20);
      expect(geometry.corner).toBe(true);
      expect(geometry.label).toBeTruthy();
      expect(geometry.covered).toEqual([]);
      await chip.focus();
      expect(
        await chip.evaluate(
          (element) => element.getBoundingClientRect().width === 20,
        ),
      ).toBe(true);
    }
    await editorPage.togglePreview();
    await expect(page.getByTestId("locale-chip")).toHaveCount(0);
  });

  test("uses English from a stale popover and resets only an overridden field", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await stale.getByTestId("locale-chip").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("locale-popover")).toContainText(
      "Now: “The Sable offer ends on Friday.”",
    );
    await page.getByTestId("locale-use-default").click();
    await expect(stale).toContainText("The Sable offer ends on Friday.");
    await expect(stale.getByTestId("locale-chip")).toHaveAttribute(
      "data-state",
      "missing",
    );
    await expect(page.getByTestId("locale-popover")).toHaveCount(0);
    await page.locator('[data-block-id="languages-hero"]').click();
    await expect(page.locator('[data-block-id="languages-hero"]')).toHaveClass(
      /tpl-block--selected/,
    );
    const row = page.locator('[data-locale-path="src"]');
    await expect(row.getByTestId("field-locale-pill")).toHaveText("Deutsch");
    expect(
      await row.evaluate((element) => {
        const label = element.querySelector("label")!;
        const pill = element.querySelector(
          '[data-testid="field-locale-pill"]',
        )!;
        return label.parentElement!.contains(pill);
      }),
    ).toBe(true);
    await expect(row.getByTestId("field-reset")).toHaveAttribute(
      "title",
      "Reset to English",
    );
    await row.getByTestId("field-reset").click();
    await expect(
      page.locator('[data-block-id="languages-hero"] img'),
    ).toHaveAttribute("src", "/examples/sable/speaker.png");
    await expect(stale.getByTestId("locale-chip")).toHaveAttribute(
      "data-state",
      "missing",
    );
  });

  test("creates a German root and reply with badges and filters whole threads", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await page.getByTestId("comments-trigger").click();
    await page.getByTestId("comments-input").fill("German review");
    await page.getByTestId("comments-send").click();
    const thread = page
      .getByTestId("comment-thread")
      .filter({ hasText: "German review" });
    await expect(thread.getByTestId("comment-locale-badge")).toHaveText(
      "Deutsch",
    );
    await thread.getByTestId("comment-reply").click();
    await thread.locator("textarea").fill("German reply");
    await thread.locator("textarea").press("Enter");
    await expect(thread.getByTestId("comment-locale-badge")).toHaveText([
      "Deutsch",
      "Deutsch",
    ]);
    await selectLanguage(page, "en");
    await expect(thread).toBeVisible();
    await page.getByTestId("comments-filter-language").click();
    await expect(thread).toHaveCount(0);
    await selectLanguage(page, "de");
    await expect(thread).toBeVisible();
    await expect(thread).toContainText("German reply");
  });

  test("previews and exports the German layout footer", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.togglePreview();
    await expect(
      page.locator(SELECTORS.canvas).getByText("Abmelden", { exact: true }),
    ).toBeVisible();
    await editorPage.openExport();
    await expect(page.locator(SELECTORS.exportPreviewFrame)).toHaveAttribute(
      "srcdoc",
      /Abmelden/,
    );
    await expect(
      page
        .frameLocator(SELECTORS.exportPreviewFrame)
        .getByText("Abmelden", { exact: true }),
    ).toBeVisible();
  });

  test("switches text, hero and hidden ghost to German with coverage", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    const german = page.getByTestId("language-option-de");
    await expect(german).toContainText("Deutsch");
    await expect(german).toContainText("1 missing");
    await expect(german).toContainText("1 out of date");
    await german.click();
    await expect(page.getByTestId("language-menu")).toContainText("Deutsch");
    await expect(page.getByTestId("language-menu")).toContainText("2");
    await expect(
      page.locator('[data-block-id="languages-title"]'),
    ).toContainText("Willkommen zur Herbstkollektion");
    await expect(
      page.locator('[data-block-id="languages-hero"] img'),
    ).toHaveAttribute("src", "/examples/sable/buds.png");
    const hidden = page.locator('[data-block-id="languages-us-only"]');
    await expect(hidden).toHaveClass(/tpl-block--locale-hidden/);
    await expect(
      hidden.locator('[data-testid="locale-chip"][data-state="hidden"]'),
    ).toHaveAccessibleName("Hidden in Deutsch");
    await editorPage.togglePreview();
    await expect(hidden).toHaveCount(0);
  });

  test("edits German text while the English view stays unchanged", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.doubleClickBlock("paragraph");
    await editorPage.focusTextEditableAtEnd("paragraph");
    await page.keyboard.type(" Nur auf Deutsch.");
    await editorPage.deselectBlock();
    const copy = page.locator('[data-block-id="languages-copy"]');
    await expect(copy).toContainText("Nur auf Deutsch.");
    await selectLanguage(page, "en");
    await expect(copy).toContainText("Discover our new collection.");
    await expect(copy).not.toContainText("Nur auf Deutsch.");
    await selectLanguage(page, "de");
    await expect(copy).toContainText("Nur auf Deutsch.");
  });

  test("keeps a stale value and clears its marker", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await expect(
      stale.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toHaveAccessibleName("Out of date");
    await stale.getByTestId("locale-chip").click();
    await page.getByTestId("locale-popover").getByTestId("locale-keep").click();
    await expect(
      stale.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toHaveCount(0);
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Donnerstag.",
    );
    await expect(page.getByTestId("language-menu")).toContainText("1");
  });

  test("keeps a translation after the default converges to it", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.doubleClickBlock("title");
    // The outer .tpl-text-editable also exists while TipTap is loading.
    // Wait for and focus its actual contenteditable before sending keys.
    const editable = await editorPage.focusTextEditableAtEnd("title");
    await expect(editable).toBeEditable();
    await editable.press("ControlOrMeta+a");
    await page.keyboard.type("Willkommen zur Herbstkollektion");
    await expect(editable).toHaveText("Willkommen zur Herbstkollektion");
    const title = page.locator('[data-block-id="languages-title"]');
    await expect(
      title.locator('[data-testid="locale-chip"][data-state="default-stale"]'),
    ).toHaveAccessibleName("Out of date in 1 language");
    await editorPage.deselectBlock();
    await selectLanguage(page, "de");
    await expect(
      title.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toBeVisible();
    await title.getByTestId("locale-chip").click();
    await page.getByTestId("locale-popover").getByTestId("locale-keep").click();
    await expect(
      title.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toHaveCount(0);
    await expect(
      title.locator('[data-testid="locale-chip"][data-state="missing"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId("language-menu")).toContainText("2");
    await selectLanguage(page, "en");
    await selectLanguage(page, "de");
    await expect(
      title.locator('[data-testid="locale-chip"][data-state="missing"]'),
    ).toHaveCount(0);
    await expect(title).toContainText("Willkommen zur Herbstkollektion");
  });

  test("adds French from Add language", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await expect(page.getByRole("menu")).toContainText("Add language");
    await expect(page.getByTestId("language-option-fr")).toHaveCount(0);
    await page.getByTestId("language-add").click();
    await page.getByTestId("language-add-fr").click();
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-option-fr")).toContainText(
      "Français",
    );
  });

  // At the default 1280 × 720 the header is compact and the trigger shows
  // the tag; at 1600 px it has room for the name.
  for (const { width, label } of [
    { width: 1280, label: "de" },
    { width: 1600, label: "Deutsch" },
  ]) {
    test(`makes German the default after showing its hidden block and reports gaps at ${width}px`, async ({
      page,
      scenePage,
      editorPage,
    }) => {
      await page.setViewportSize({ width, height: 720 });
      await scenePage.goto("languages");
      await editorPage.waitForReady();
      await editorPage.dismissOverlays();
      await selectLanguage(page, "de");
      await page
        .locator('[data-block-id="languages-us-only"]')
        .getByTestId("locale-chip")
        .click();
      await page
        .getByTestId("locale-popover")
        .getByTestId("locale-show")
        .click();
      await page.getByTestId("language-menu").click();
      await page.getByTestId("language-actions-de").click();
      await page.getByTestId("language-make-default-de").click();
      await expect(page.getByRole("dialog")).toContainText(
        "Make Deutsch the default language?",
      );
      await expect(page.getByRole("dialog")).toContainText(
        "2 fields have no Deutsch text and keep their English text.",
      );
      await page.getByTestId("language-default-confirm").click();
      await expect(page.getByTestId("locale-notice")).toHaveText(
        "Deutsch is now the default language. 2 fields are still in English.",
      );
      // The trigger holds both the name and the tag; the rendered one is the
      // only visible text, and its accessible name contains both.
      const trigger = page.getByTestId("language-menu");
      await expect(trigger).toHaveAccessibleName("Deutsch (de)");
      await expect(trigger).toHaveText(label, { useInnerText: true });
      await expect(trigger.locator(".tpl-language-count")).toHaveCount(0);
      await page
        .getByTestId("locale-notice")
        .getByRole("button", { name: "Dismiss" })
        .click();
      await expect(page.getByTestId("locale-notice")).toHaveCount(0);
    });
  }

  test("removes German through its actions and can undo", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("language-actions-de").click();
    await page.getByTestId("language-remove-de").click();
    await expect(page.getByRole("dialog")).toContainText(
      "This deletes the Deutsch text and changes. You can undo it.",
    );
    await page.getByTestId("language-remove-confirm").click();
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-option-de")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+z");
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-option-de")).toBeVisible();
  });

  test("navigates rows and one submenu level at a time with the keyboard", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    const trigger = page.getByTestId("language-menu");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("language-option-en")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("language-option-de")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const promotion = page.getByTestId("language-make-default-de");
    await expect(promotion).toBeFocused();
    await expect(promotion).toHaveAttribute("aria-disabled", "true");
    await expect(promotion).toContainText(
      "Show the 1 block hidden in Deutsch first",
    );
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("language-remove-de")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("language-actions-de")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("language-add-fr")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("language-add")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("renders the Arabic canvas right to left", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "ar");
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("dir", "rtl");
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute("lang", "ar");
    await page.locator('[data-block-id="languages-copy"] p').dblclick();
    await editorPage.focusTextEditableAtEnd("paragraph");
    await page.keyboard.type(" مرحبا.");
    await editorPage.deselectBlock();
    const mjml = await page.evaluate(() =>
      (
        window as {
          __tplPlaygroundGetMjml?: (options?: {
            locale?: string;
          }) => Promise<string>;
        }
      ).__tplPlaygroundGetMjml!({ locale: "ar" }),
    );
    const paragraph = [...mjml.matchAll(/<mj-text\b[^>]*>[\s\S]*?<\/mj-text>/g)]
      .map((match) => match[0])
      .find((element) => element.includes("مرحبا."));
    expect(paragraph).toBeDefined();
    expect(paragraph!.split(">")[0]).not.toContain('align="left"');
    expect(exportedParagraphAlignment(mjml, "مرحبا.")).not.toBe("left");
  });

  test("exports German MJML through the editor with an explicit locale", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    const mjml = await page.evaluate(() =>
      (
        window as {
          __tplPlaygroundGetMjml?: (options?: {
            locale?: string;
          }) => Promise<string>;
        }
      ).__tplPlaygroundGetMjml!({ locale: "de" }),
    );
    expect(mjml).toContain('lang="de"');
    expect(mjml).toContain("Willkommen zur Herbstkollektion");
    expect(mjml).toContain("/examples/sable/buds.png");
    expect(mjml).not.toContain("Free shipping in the United States.");
  });

  test("holds German and French locks on the same block in two tabs", async ({
    context,
    shadowDom,
  }) => {
    async function openTab(context: BrowserContext, user: string) {
      const page = await context.newPage();
      watchVueWarnings(page, vueWarnings);
      const editor = new EditorPage(page);
      await new ScenePage(page, { shadowDom }).goto("languages", {
        collaboration: "1",
        user,
      });
      await editor.waitForReady();
      await editor.dismissOverlays();
      return { page, editor };
    }
    const ada = await openTab(context, "Ada");
    const grace = await openTab(context, "Grace");
    await expect(ada.page.getByTestId("collaborator-avatar")).toHaveAttribute(
      "title",
      "Grace",
    );
    await selectLanguage(ada.page, "de");
    await grace.page.getByTestId("language-menu").click();
    await grace.page.getByTestId("language-add").click();
    await grace.page.getByTestId("language-add-fr").click();
    await selectLanguage(grace.page, "fr");
    await ada.editor.doubleClickBlock("paragraph");
    await ada.editor.focusTextEditableAtEnd("paragraph");
    await ada.page.keyboard.type(" Von Ada.");
    // Enter editing through the paragraph's text.
    await grace.page
      .locator('[data-block-id="languages-copy"] .tpl-text-content')
      .dblclick();
    await grace.editor.focusTextEditableAtEnd("paragraph");
    await grace.page.keyboard.type(" Par Grace.");
    for (const tab of [ada, grace]) {
      await expect(
        tab.page.locator('[data-block-id="languages-copy"]'),
      ).toHaveClass(/tpl-block--selected/);
      await expect(
        tab.page
          .locator('[data-block-id="languages-copy"]')
          .getByTestId("block-lock"),
      ).toHaveCount(0);
    }
    // Read the backend's lock snapshot without switching either editing tab's view.
    await expect
      .poll(() =>
        ada.page.evaluate(async (url) => {
          const { languages } = await import(/* @vite-ignore */ url);
          const config = languages.config({
            search: new URLSearchParams("collaboration=1"),
          });
          const template = await config.templates.load("playground-languages");
          return template.locks
            .map(
              (lock: {
                blockId: string;
                locale?: string;
                holder: { name?: string };
              }) => ({
                blockId: lock.blockId,
                locale: lock.locale,
                name: lock.holder.name,
              }),
            )
            .sort((a: { locale: string }, b: { locale: string }) =>
              a.locale.localeCompare(b.locale),
            );
        }, "/src/scenes/author/languages.ts"),
      )
      .toEqual([
        { blockId: "languages-copy", locale: "de", name: "Ada" },
        { blockId: "languages-copy", locale: "fr", name: "Grace" },
      ]);
    await expect(
      ada.page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Von Ada.");
    await expect(
      ada.page.locator('[data-block-id="languages-copy"]'),
    ).not.toContainText("Par Grace.");
    await expect(
      grace.page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Par Grace.");
    await expect(
      grace.page.locator('[data-block-id="languages-copy"]'),
    ).not.toContainText("Von Ada.");
  });

  test("keeps Sable in the German translation through the mock provider", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await stale.getByTestId("locale-chip").click();
    await page
      .getByTestId("locale-popover")
      .getByTestId("locale-retranslate")
      .click();
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Freitag.",
    );
    await expect(
      stale.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toHaveCount(0);
  });

  test("translates the German gaps and reports the translated field count", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await expect(page.getByTestId("language-bar")).toContainText(
      "Editing Deutsch",
    );
    await expect(page.getByTestId("translate-language")).toHaveText(
      "Translate 2 fields",
    );
    await page.getByTestId("translate-language").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields.",
    );
    await expect(page.getByTestId("language-menu")).toHaveAttribute(
      "title",
      "Deutsch",
    );
    await expect(
      page.locator('[data-block-id="languages-hero"] img'),
    ).toHaveAttribute("alt", "Ein tragbarer Lautsprecher");
    await expect(
      page.locator('[data-block-id="languages-stale"]'),
    ).toContainText("Das Angebot von Sable endet am Freitag.");
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-status-de")).toHaveText("Complete");
    await expect(page.getByTestId("translate-language")).toHaveCount(0);
    await page.getByTestId("language-menu").click();
    await expect(page.getByTestId("language-back-default")).toHaveText(
      "Back to English",
    );
    await page.getByTestId("language-back-default").click();
    await expect(page.getByTestId("language-bar")).toHaveCount(0);
    await expect(page.getByTestId("translation-result")).toHaveCount(0);
    await expect(
      page.locator('[data-block-id="languages-stale"]'),
    ).toContainText("The Sable offer ends on Friday.");
  });

  test("keeps a field untranslated when its recorded translation drops a tag", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages", { translation: "tags-changed" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const tagged = page.locator('[data-block-id="languages-tagged"]');
    await expect(
      tagged.locator('[data-testid="locale-chip"][data-state="missing"]'),
    ).toBeVisible();
    await page
      .getByTestId("language-bar")
      .getByTestId("translate-language")
      .click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields. 1 kept because their tags changed.",
    );
    await expect(tagged).toContainText("Hello");
    await expect(tagged).not.toContainText("Hallo");
    await expect(
      tagged.locator('[data-testid="locale-chip"][data-state="missing"]'),
    ).toBeVisible();
    await expect(page.getByTestId("language-menu")).toContainText("1");
  });

  test("Cancel applies the completed batch while the later call is delayed", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages", { translation: "cancel" });
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.getByTestId("language-menu").click();
    await page.getByTestId("language-add").click();
    await page.getByTestId("language-add-fr").click();
    await selectLanguage(page, "fr");
    await page
      .getByTestId("language-bar")
      .getByTestId("translate-language")
      .click();
    await expect(page.getByTestId("language-bar-status")).toContainText(
      "Translating 2 of 5…",
    );
    await page.getByTestId("translation-cancel").click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 2 fields.",
    );
    await expect(page.getByTestId("language-menu")).toContainText("3");
    await expect(
      page.locator('[data-block-id="languages-title"]'),
    ).toContainText("Bienvenue dans la collection d’automne");
    await expect(
      page.locator('[data-block-id="languages-copy"]'),
    ).toContainText("Discover our new collection.");
    await expect(
      page
        .locator('[data-block-id="languages-copy"]')
        .locator('[data-testid="locale-chip"][data-state="missing"]'),
    ).toBeVisible();
    await expect(page.getByTestId("translation-cancel")).toHaveCount(0);
  });

  test("Re-translate updates the stale block and clears its marker", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    const stale = page.locator('[data-block-id="languages-stale"]');
    await expect(
      stale.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toBeVisible();
    await stale.getByTestId("locale-chip").click();
    await page
      .getByTestId("locale-popover")
      .getByTestId("locale-retranslate")
      .click();
    await expect(page.getByTestId("translation-result")).toHaveText(
      "Translated 1 field.",
    );
    await expect(
      stale.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toHaveCount(0);
    await expect(stale).toContainText(
      "Das Angebot von Sable endet am Freitag.",
    );
    await expect(page.getByTestId("language-menu")).toContainText("1");
  });

  test("Rewrite writes its German reply into the German layer", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("languages");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await selectLanguage(page, "de");
    await editorPage.doubleClickBlock("paragraph");
    const toolbar = editorPage.getTextToolbar();
    await toolbar.getByTestId("ai-rewrite-trigger").click();
    await toolbar.getByTestId("ai-rewrite-preset-shorten").click();
    await expect(toolbar.getByTestId("ai-rewrite-preview")).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
    await toolbar.getByTestId("ai-rewrite-replace").click();
    await editorPage.deselectBlock();
    const copy = page.locator('[data-block-id="languages-copy"]');
    await expect(copy).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
    await selectLanguage(page, "en");
    await expect(copy).toContainText("Discover our new collection.");
    await expect(copy).not.toContainText("Highlights");
    await selectLanguage(page, "de");
    await expect(copy).toContainText(
      "Entdecken Sie die Highlights unserer Herbstkollektion.",
    );
  });

  test("reports a German block held by the second page as skipped", async ({
    context,
    shadowDom,
  }) => {
    async function openTab(user: string) {
      const page = await context.newPage();
      watchVueWarnings(page, vueWarnings);
      const editor = new EditorPage(page);
      await new ScenePage(page, { shadowDom }).goto("languages", {
        collaboration: "1",
        user,
      });
      await editor.waitForReady();
      await editor.dismissOverlays();
      await selectLanguage(page, "de");
      return { page, editor };
    }
    const ada = await openTab("Ada");
    const grace = await openTab("Grace");
    const held = grace.page.locator('[data-block-id="languages-stale"]');
    await held.dblclick();
    await expect(held).toHaveClass(/tpl-block--selected/);
    const remote = ada.page.locator('[data-block-id="languages-stale"]');
    await expect(remote.getByTestId("block-lock")).toBeVisible();
    await ada.page
      .getByTestId("language-bar")
      .getByTestId("translate-language")
      .click();
    await expect(ada.page.getByTestId("translation-result")).toHaveText(
      "Translated 1 field. 1 skipped because someone is editing them.",
    );
    await expect(remote).toContainText(
      "Das Angebot von Sable endet am Donnerstag.",
    );
    await expect(
      remote.locator('[data-testid="locale-chip"][data-state="stale"]'),
    ).toBeVisible();
    for (const tab of [ada, grace]) {
      await expect(
        tab.page.locator('[data-block-id="languages-hero"] img'),
      ).toHaveAttribute("alt", "Ein tragbarer Lautsprecher");
    }
  });
});
