import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { resolveLocale } from "@templatical/types";
import { languages } from "../src/scenes/author/languages";

it("gives the Languages scene a German layout footer", () => {
  const config = languages.config!({ search: new URLSearchParams() } as any);
  expect(config.layout).toBeDefined();
  expect(JSON.stringify(resolveLocale(config.layout!, "de"))).toContain(
    "Abmelden",
  );
});

it("passes the active language to both Export dialog render methods", () => {
  const source = readFileSync(
    new URL("../src/host/ExportModal.vue", import.meta.url),
    "utf8",
  );
  expect(source).toContain("locale: props.editor.getLocale()");
  expect(source).toMatch(
    /toHtml\(\{\s*locale: props\.editor\.getLocale\(\),?\s*\}\)/,
  );
  expect(source).toMatch(
    /toMjml\(\{\s*locale: props\.editor\.getLocale\(\),?\s*\}\)/,
  );
});
