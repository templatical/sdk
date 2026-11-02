import type { ImportKind } from "../shared";

/**
 * The same finished email, the Launchpad v2.0 launch, written in each format
 * an importer reads, so a visitor can watch every vendor's markup convert
 * into one result. Each loads on demand: nobody pays for a sample they never
 * try. tests/import-samples.test.ts holds every one to converting with no
 * block falling back to raw HTML, and to existing at all.
 */
const SAMPLES = import.meta.glob<string>("./launchpad.*", {
  query: "?raw",
  import: "default",
});

const FILES: Record<ImportKind, string> = {
  unlayer: "./launchpad.unlayer.json",
  beefree: "./launchpad.beefree.json",
  stripo: "./launchpad.stripo.html",
  topol: "./launchpad.topol.json",
  chamaileon: "./launchpad.chamaileon.json",
  "easy-email-pro": "./launchpad.easy-email-pro.json",
  mjml: "./launchpad.mjml",
  html: "./launchpad.html",
};

export async function loadImportSample(kind: ImportKind): Promise<string> {
  const load = SAMPLES[FILES[kind]];
  if (!load) throw new Error(`No sample email for ${kind}`);
  const source = await load();
  if (kind !== "beefree") return source;
  const template = JSON.parse(source);
  template.page.body.language = { label: "English", value: "en-US" };
  for (const row of template.page.rows) {
    for (const column of row.columns) {
      for (const module of column.modules) {
        const heading = module.descriptor.heading;
        if (heading?.text?.includes("Introducing Launchpad v2.0")) {
          heading.translations = {
            "es-ES": {
              text: heading.text.replace(
                "Introducing Launchpad v2.0",
                "Presentamos Launchpad v2.0",
              ),
            },
          };
        }
      }
    }
  }
  return JSON.stringify(template);
}
