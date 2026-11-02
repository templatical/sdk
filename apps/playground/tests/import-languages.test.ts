import { resolveLocale } from "@templatical/types";
import { expect, it } from "vitest";
import { convertImportSourceWithReport } from "../src/host/importConvert";
import { loadImportSample } from "../src/scenes/import/samples";
import { importBeefree as scene } from "../src/scenes/import/import-beefree";

it("imports a multilingual sample with language UI enabled by the variant", async () => {
  const ctx = { search: new URLSearchParams("localization=1") };
  expect(scene.config(ctx).localization).toEqual({
    locales: ["en-US", "es-ES"],
  });
  expect(scene.snippetFor?.(ctx)).toContain(
    'localization: { locales: ["en-US", "es-ES"] }',
  );
  const { content } = await convertImportSourceWithReport(
    "beefree",
    await loadImportSample("beefree"),
  );
  expect(content.settings.locale).toBe("en-US");
  expect(content.settings.locales).toContain("es-ES");
  expect(JSON.stringify(resolveLocale(content, "es-ES"))).toContain(
    "Presentamos Launchpad v2.0",
  );
});
