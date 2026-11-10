import { test, expect } from "../fixtures/editor.fixture";

const SCENE = "header-actions";
const action = '[data-testid="host-template-action"]';
const menu = '[data-testid="host-template-menu"]';

async function fitBoundary(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1800, height: 800 });
  const header = page.locator(".tpl-header");
  const hostButton = page.locator(action);
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBeGreaterThan(0);
  const withActions = Number(await header.getAttribute("data-full-width"));
  await hostButton.evaluate((button: HTMLButtonElement) => {
    button.style.display = "none";
  });
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBeLessThan(withActions);
  const withoutActions = Number(await header.getAttribute("data-full-width"));
  await hostButton.evaluate((button: HTMLButtonElement) => {
    button.style.removeProperty("display");
  });
  await expect
    .poll(async () => Number(await header.getAttribute("data-full-width")))
    .toBe(withActions);
  const offset = await page
    .locator(".tpl-header-container")
    .evaluate(
      (element) => window.innerWidth - element.getBoundingClientRect().width,
    );
  const target = Math.ceil((withActions + withoutActions) / 2 + offset);
  await page.setViewportSize({ width: target, height: 800 });
  await expect(header).toHaveAttribute("data-compact", "true");
  return { hostButton, header };
}

test("host dropdown is clickable and precedes Test and Save", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto(SCENE, { templates: "1" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const button = page.locator(action);
  await expect(button).toBeVisible();
  const hit = await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    let found: Element | null = document.elementFromPoint(x, y);
    while (found?.shadowRoot) found = found.shadowRoot.elementFromPoint(x, y);
    return found === element || element.contains(found);
  });
  expect(hit).toBe(true);
  const order = await page.locator(".tpl-header-right").evaluate((right) => {
    const children = Array.from(right.children);
    return {
      actions: children.findIndex((child) =>
        child.matches('slot[name="tpl-header-actions"], .tpl-header-actions'),
      ),
      test: children.findIndex((child) =>
        child.matches('[data-testid="test-email-trigger"]'),
      ),
      save: children.findIndex((child) =>
        child.matches('[data-testid="template-save"]'),
      ),
    };
  });
  expect(order.actions).toBeGreaterThan(-1);
  expect(order.actions).toBeLessThan(order.test);
  expect(order.test).toBeLessThan(order.save);
  await button.click();
  await expect(page.locator(menu)).toBeVisible();
  await expect(page.locator(menu)).toContainText("Save as template");
  await expect(page.locator(menu)).toContainText("Change template");
  await expect(page.locator(".tpl-preview-toggle")).toHaveCount(0);
  await expect(page.locator(".tpl-dark-mode-toggle")).toHaveCount(0);
  const viewport = page.getByRole("radiogroup", { name: "Viewport" });
  await expect(viewport).toBeVisible();
  await expect(viewport.getByRole("radio")).toHaveCount(2);
});

test("host width compacts the header and its compact label stays stable", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto(SCENE, { templates: "1" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const { hostButton, header } = await fitBoundary(page);
  await expect(hostButton).toBeVisible();
  await expect(page.locator("[data-tpl-compact='true']")).toHaveCount(1);
  await hostButton.evaluate((button: HTMLButtonElement) => {
    button.style.display = "none";
  });
  await expect(header).toHaveAttribute("data-compact", "false");
});

test("an opted-out centre is centered when full and uses the standard compact tracks", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto(SCENE, { preview: "1", templates: "1" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  await page.setViewportSize({ width: 1800, height: 800 });
  const header = page.locator(".tpl-header");
  await expect(header).toHaveAttribute("data-compact", "false");
  const preview = page.locator(".tpl-preview-toggle");
  await expect(preview).toBeVisible();
  const fullHeaderBox = await header.boundingBox();
  const fullCentreBox = await page.locator(".tpl-header-center").boundingBox();
  expect(fullHeaderBox).not.toBeNull();
  expect(fullCentreBox).not.toBeNull();
  expect(
    Math.abs(
      fullCentreBox!.x +
        fullCentreBox!.width / 2 -
        (fullHeaderBox!.x + fullHeaderBox!.width / 2),
    ),
  ).toBeLessThanOrEqual(1);

  const { hostButton } = await fitBoundary(page);
  await expect(header).toHaveAttribute("data-compact", "true");
  const fullWidth = Number(await header.getAttribute("data-full-width"));
  const offset = await page
    .locator(".tpl-header-container")
    .evaluate(
      (element) => window.innerWidth - element.getBoundingClientRect().width,
    );
  await page.setViewportSize({
    width: Math.ceil(fullWidth + offset),
    height: 800,
  });
  await expect(header).toHaveAttribute("data-compact", "false");
  await page.setViewportSize({
    width: Math.floor(fullWidth + offset) - 1,
    height: 800,
  });
  await expect(header).toHaveAttribute("data-compact", "true");
  const optedOutLayout = await header.evaluate((element) => ({
    lastTrack: Number.parseFloat(
      getComputedStyle(element).gridTemplateColumns.split(" ").at(-1)!,
    ),
    rightWidth: element
      .querySelector(".tpl-header-right")!
      .getBoundingClientRect().width,
    gap: getComputedStyle(element).columnGap,
    centreGap: getComputedStyle(element.querySelector(".tpl-header-center")!)
      .gap,
  }));
  await expect(hostButton).toBeVisible();

  await scenePage.goto(SCENE, {
    preview: "1",
    darkToggle: "1",
    templates: "1",
  });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  await expect(page.locator(".tpl-dark-mode-toggle")).toBeVisible();
  await expect(header).toHaveAttribute("data-compact", "true");
  const standardLayout = await header.evaluate((element) => ({
    lastTrack: Number.parseFloat(
      getComputedStyle(element).gridTemplateColumns.split(" ").at(-1)!,
    ),
    rightWidth: element
      .querySelector(".tpl-header-right")!
      .getBoundingClientRect().width,
    gap: getComputedStyle(element).columnGap,
    centreGap: getComputedStyle(element.querySelector(".tpl-header-center")!)
      .gap,
  }));
  expect(
    Math.abs(optedOutLayout.lastTrack - optedOutLayout.rightWidth),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(standardLayout.lastTrack - standardLayout.rightWidth),
  ).toBeLessThanOrEqual(1);
  expect(optedOutLayout.gap).toBe(standardLayout.gap);
  expect(optedOutLayout.centreGap).toBe(standardLayout.centreGap);
  expect(optedOutLayout.gap).toBe("8px");
  expect(optedOutLayout.centreGap).toBe("4px");
});

test("opening and closing the host dropdown leaves header fit unchanged", async ({
  page,
  scenePage,
  editorPage,
}) => {
  await scenePage.goto(SCENE, { templates: "1" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  const { hostButton, header } = await fitBoundary(page);
  const state = {
    compact: await header.getAttribute("data-compact"),
    fullWidth: await header.getAttribute("data-full-width"),
  };
  await hostButton.click();
  await expect(page.locator(menu)).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(header).toHaveAttribute("data-compact", state.compact!);
  await expect(header).toHaveAttribute("data-full-width", state.fullWidth!);
  await hostButton.click();
  await expect(page.locator(menu)).toBeHidden();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(header).toHaveAttribute("data-compact", state.compact!);
  await expect(header).toHaveAttribute("data-full-width", state.fullWidth!);
});
