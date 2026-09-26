import { makeImportScene } from "./shared";

export const importUnlayer = makeImportScene({
  id: "import-unlayer",
  title: "Unlayer",
  job: "Paste Unlayer JSON",
  summary:
    "convertUnlayerTemplate + init({ content }) — Unlayer saveDesign JSON.",
  docs: "/guide/migration-from-unlayer#usage",
  pkg: "@templatical/import-unlayer",
  convertFn: "convertUnlayerTemplate",
  sourceExpr: "unlayerJson",
});
