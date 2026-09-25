import { makeImportScene } from "./shared";

export const importHtml = makeImportScene({
  id: "import-html",
  title: "HTML",
  job: "Paste table-based HTML",
  summary: "convertHtmlTemplate + init({ content }) — table-based email HTML.",
  docs: "/guide/migration-from-html#usage",
  pkg: "@templatical/import-html",
  convertFn: "convertHtmlTemplate",
  sourceExpr: "html",
});
