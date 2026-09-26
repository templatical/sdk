import { makeImportScene } from "./shared";

export const importStripo = makeImportScene({
  id: "import-stripo",
  title: "Stripo",
  job: "Paste Stripo HTML",
  summary:
    "convertStripoTemplate + init({ content }) — Stripo HTML or { html, css }.",
  docs: "/guide/migration-from-stripo#usage",
  pkg: "@templatical/import-stripo",
  convertFn: "convertStripoTemplate",
  sourceExpr: "html",
});
