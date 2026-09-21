import { makeImportScene } from "./shared";

export const importTopol = makeImportScene({
  id: "import-topol",
  title: "Topol",
  summary: "convertTopolTemplate + init({ content }) — Topol design JSON.",
  docs: "/guide/migration-from-topol",
  pkg: "@templatical/import-topol",
  convertFn: "convertTopolTemplate",
  sourceExpr: "design",
});
