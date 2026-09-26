import { makeImportScene } from "./shared";

export const importMjml = makeImportScene({
  id: "import-mjml",
  title: "MJML",
  job: "Paste MJML source",
  summary: "convertMjmlTemplate + init({ content }) — raw MJML source.",
  docs: "/guide/migration-from-mjml#usage",
  pkg: "@templatical/import-mjml",
  convertFn: "convertMjmlTemplate",
  sourceExpr: "mjml",
});
