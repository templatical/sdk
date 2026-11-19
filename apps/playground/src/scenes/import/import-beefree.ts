import { makeImportScene } from "./shared";

export const importBeefree = makeImportScene({
  id: "import-beefree",
  title: "Beefree",
  job: "Paste Beefree JSON",
  summary:
    "convertBeeFreeTemplate + init({ content }) — Beefree page.rows JSON.",
  docs: "/guide/migration-from-beefree#usage",
  pkg: "@templatical/import-beefree",
  convertFn: "convertBeeFreeTemplate",
  sourceExpr: "beefreeJson",
});
