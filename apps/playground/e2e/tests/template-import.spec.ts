import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";
import { ScenePage } from "../pages/scene.page";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);
const beefreeJson = readFileSync(
  join(fixturesDir, "beefree-template.json"),
  "utf8",
);
const unlayerJson = readFileSync(
  join(fixturesDir, "unlayer-template.json"),
  "utf8",
);
const htmlSource = readFileSync(
  join(fixturesDir, "sample-html-email.html"),
  "utf8",
);
const mjmlSource = readFileSync(
  join(fixturesDir, "sample-mjml-email.mjml"),
  "utf8",
);
const topolSource = readFileSync(
  join(fixturesDir, "sample-topol-design.json"),
  "utf8",
);
const chamaileonSource = readFileSync(
  join(fixturesDir, "sample-chamaileon-document.json"),
  "utf8",
);
const easyEmailProSource = readFileSync(
  join(fixturesDir, "sample-easy-email-pro-document.json"),
  "utf8",
);

const IMPORT_SCENE_IDS = [
  "import-unlayer",
  "import-beefree",
  "import-html",
  "import-mjml",
  "import-topol",
  "import-stripo",
  "import-chamaileon",
  "import-easy-email-pro",
] as const;

type ImportSource =
  | "unlayer"
  | "beefree"
  | "html"
  | "mjml"
  | "topol"
  | "stripo"
  | "chamaileon"
  | "easyEmailPro";

const SCENE_BY_SOURCE: Record<ImportSource, string> = {
  unlayer: "import-unlayer",
  beefree: "import-beefree",
  html: "import-html",
  mjml: "import-mjml",
  topol: "import-topol",
  stripo: "import-stripo",
  chamaileon: "import-chamaileon",
  easyEmailPro: "import-easy-email-pro",
};

const TEXTAREA_BY_SOURCE: Record<ImportSource, string> = {
  unlayer: SELECTORS.importTextareaUnlayer,
  beefree: SELECTORS.importTextareaBeefree,
  html: SELECTORS.importTextareaHtml,
  mjml: SELECTORS.importTextareaMjml,
  topol: SELECTORS.importTextareaTopol,
  stripo: SELECTORS.importTextareaStripo,
  chamaileon: SELECTORS.importTextareaChamaileon,
  easyEmailPro: SELECTORS.importTextareaEasyEmailPro,
};

async function openImportScene(
  scenePage: ScenePage,
  page: import("@playwright/test").Page,
  source: ImportSource,
) {
  await scenePage.goto(SCENE_BY_SOURCE[source]);
  await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  await expect(page.locator(TEXTAREA_BY_SOURCE[source])).toBeVisible();
  await expect(page.locator(SELECTORS.importConfirm)).toBeEnabled();
}

async function importOnScene(
  scenePage: ScenePage,
  page: import("@playwright/test").Page,
  source: ImportSource,
  content: string,
) {
  await openImportScene(scenePage, page, source);
  await page.locator(TEXTAREA_BY_SOURCE[source]).fill(content);
  await page.locator(SELECTORS.importConfirm).click();
}

test.describe("Template import", () => {
  test("catalog lists one scene per importer", async ({
    chooserPage,
    page,
  }) => {
    await chooserPage.goto();
    const links = page.locator("[data-testid^='scene-link-import-']");
    await expect(links).toHaveCount(8);
    const ids = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(ids).toEqual(IMPORT_SCENE_IDS.map((id) => `scene-link-${id}`));
  });

  test("imports a BeeFree template and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "beefree", beefreeJson);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from BeeFree");
    await expect(page.locator(blockByType("paragraph")).first()).toContainText(
      "BeeFree e2e fixture",
    );
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("imports an Unlayer template and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "unlayer", unlayerJson);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from Unlayer");
    await expect(page.locator(blockByType("paragraph")).first()).toContainText(
      "Unlayer e2e fixture",
    );
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("Unlayer scene shows only the Unlayer textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "unlayer");
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("BeeFree scene shows only the BeeFree textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "beefree");
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaUnlayer)).toHaveCount(0);
  });

  test("shows an error when the BeeFree JSON is invalid", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "beefree");
    await page.locator(SELECTORS.importTextareaBeefree).fill("{ not json");
    await page.locator(SELECTORS.importConfirm).click();
    const error = page.locator(SELECTORS.importError);
    await expect(error).toBeVisible();
    expect((await error.innerText()).length).toBeGreaterThan(0);
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the Unlayer JSON is invalid", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "unlayer");
    await page.locator(SELECTORS.importTextareaUnlayer).fill('{"body":{}}');
    await page.locator(SELECTORS.importConfirm).click();
    const error = page.locator(SELECTORS.importError);
    await expect(error).toBeVisible();
    await expect(error).toContainText(/body|rows/i);
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an empty-input error and keeps the paste panel open", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "unlayer");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
    await expect(page.locator(blockByType("title"))).toHaveCount(0);
  });

  test("imports an HTML email and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "html", htmlSource);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Welcome aboard");
    await expect(page.locator(blockByType("paragraph")).first()).toContainText(
      "Thanks for signing up",
    );
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("HTML scene shows only the HTML textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "html");
    await expect(page.locator(SELECTORS.importTextareaHtml)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the HTML scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "html");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the HTML input is whitespace only", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "html");
    await page.locator(SELECTORS.importTextareaHtml).fill("    ");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("imports an MJML template and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "mjml", mjmlSource);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from MJML");
    await expect(page.locator(blockByType("paragraph")).first()).toContainText(
      "MJML e2e fixture",
    );
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("MJML scene shows only the MJML textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "mjml");
    await expect(page.locator(SELECTORS.importTextareaMjml)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the MJML scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "mjml");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the MJML input is whitespace only", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "mjml");
    await page.locator(SELECTORS.importTextareaMjml).fill("    ");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("imports a Topol design and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "topol", topolSource);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from Topol");
    await expect(page.locator(blockByType("paragraph")).first()).toContainText(
      "Topol e2e fixture",
    );
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("Topol scene shows only the Topol textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "topol");
    await expect(page.locator(SELECTORS.importTextareaTopol)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the Topol scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "topol");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the Topol input is whitespace only", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "topol");
    await page.locator(SELECTORS.importTextareaTopol).fill("    ");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("imports a Chamaileon document and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "chamaileon", chamaileonSource);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from Chamaileon");
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("Chamaileon scene shows only the Chamaileon textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "chamaileon");
    await expect(
      page.locator(SELECTORS.importTextareaChamaileon),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the Chamaileon scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "chamaileon");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the Chamaileon input is whitespace only", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "chamaileon");
    await page.locator(SELECTORS.importTextareaChamaileon).fill("    ");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("imports an Easy Email Pro page and renders converted blocks", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await importOnScene(scenePage, page, "easyEmailPro", easyEmailProSource);
    await expect(page.locator(SELECTORS.importPanel)).toHaveCount(0);
    await editorPage.waitForReady();

    const titleBlock = page.locator(blockByType("title")).first();
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText("Hello from Easy Email Pro");
    await expect(page.locator(blockByType("button")).first()).toBeVisible();
  });

  test("Easy Email Pro scene shows only the Easy Email Pro textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "easyEmailPro");
    await expect(
      page.locator(SELECTORS.importTextareaEasyEmailPro),
    ).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the Easy Email Pro scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "easyEmailPro");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("shows an error when the Easy Email Pro input is whitespace only", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "easyEmailPro");
    await page.locator(SELECTORS.importTextareaEasyEmailPro).fill("    ");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });

  test("Stripo scene shows only the Stripo textarea", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "stripo");
    await expect(page.locator(SELECTORS.importTextareaStripo)).toBeVisible();
    await expect(page.locator(SELECTORS.importTextareaBeefree)).toHaveCount(0);
  });

  test("shows an empty-input error on the Stripo scene", async ({
    scenePage,
    page,
  }) => {
    await openImportScene(scenePage, page, "stripo");
    await page.locator(SELECTORS.importConfirm).click();
    await expect(page.locator(SELECTORS.importError)).toBeVisible();
    await expect(page.locator(SELECTORS.importPanel)).toBeVisible();
  });
});
