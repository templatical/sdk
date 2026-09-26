import { makeImportScene } from "./shared";

export const importChamaileon = makeImportScene({
  id: "import-chamaileon",
  title: "Chamaileon",
  job: "Paste Chamaileon JSON",
  summary:
    "convertChamaileonTemplate + init({ content }) — getDocument() JSON.",
  docs: "/guide/migration-from-chamaileon#usage",
  pkg: "@templatical/import-chamaileon",
  convertFn: "convertChamaileonTemplate",
  sourceExpr: "chamaileonJson",
});
