import { makeImportScene } from "./shared";

export const importTopol = makeImportScene({
  id: "import-topol",
  title: "Topol",
  job: "Paste Topol JSON",
  summary: "convertTopolTemplate + init({ content }) — Topol design JSON.",
  docs: "/guide/migration-from-topol",
  pkg: "@templatical/import-topol",
  convertFn: "convertTopolTemplate",
  sourceExpr: "design",
});
