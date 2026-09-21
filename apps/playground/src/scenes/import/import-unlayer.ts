import { makeImportScene } from "./shared";

export const importUnlayer = makeImportScene({
  id: "import-unlayer",
  title: "Unlayer",
  summary:
    "convertUnlayerTemplate + init({ content }) — Unlayer saveDesign JSON.",
  docs: "/guide/migration-from-unlayer",
  pkg: "@templatical/import-unlayer",
  convertFn: "convertUnlayerTemplate",
  sourceExpr: "unlayerJson",
});
