import { makeImportScene } from "./shared";

export const importBeefree = makeImportScene({
  id: "import-beefree",
  title: "BeeFree",
  job: "Paste BeeFree JSON",
  summary:
    "convertBeeFreeTemplate + init({ content }) — BeeFree page.rows JSON.",
  docs: "/guide/migration-from-beefree#usage",
  pkg: "@templatical/import-beefree",
  convertFn: "convertBeeFreeTemplate",
  sourceExpr: "beefreeJson",
});
