import { makeImportScene } from "./shared";

export const importEasyEmailPro = makeImportScene({
  id: "import-easy-email-pro",
  title: "Easy Email Pro",
  job: "Paste Easy Email Pro JSON",
  summary:
    "convertEasyEmailProTemplate + init({ content }) — persist { subject, content } page.",
  docs: "/guide/migration-from-easy-email-pro",
  pkg: "@templatical/import-easy-email-pro",
  convertFn: "convertEasyEmailProTemplate",
  sourceExpr: "emailTemplate",
});
