import { makeImportScene } from "./shared";

export const importChamaileon = makeImportScene({
  id: "import-chamaileon",
  title: "Chamaileon",
  summary:
    "convertChamaileonTemplate + init({ content }) — getDocument() JSON.",
  docs: "/guide/migration-from-chamaileon",
  pkg: "@templatical/import-chamaileon",
  convertFn: "convertChamaileonTemplate",
  sourceExpr: "chamaileonJson",
});
