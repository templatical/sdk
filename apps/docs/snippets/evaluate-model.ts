import { readFile } from "node:fs/promises";
import { lintTemplate } from "@templatical/quality";
import {
  evalAltTextWith,
  evalTurnWith,
  runAiEvalSet,
} from "@templatical/ai-kit/testing";
import { model } from "./model.ts";

const evalFolder = new URL(
  ".",
  import.meta.resolve("@templatical/ai-kit/eval/cases.json"),
);
const evals = await runAiEvalSet({
  runTurn: evalTurnWith(model),
  runAltText: evalAltTextWith(model),
  lintCheck: (content) => lintTemplate(content).map((issue) => issue.ruleId),
  loadFile: async (file) =>
    new Blob([await readFile(new URL(file, evalFolder))], {
      type: file.endsWith(".pdf") ? "application/pdf" : "image/png",
    }),
  model: "claude-opus-5-5",
});
for (const result of evals.results) {
  if (!result.ok && !result.skipped)
    console.error("FAIL", result.name, result.reason);
}
console.log(
  `${evals.passed}/${evals.total} (${evals.rate}%), skipped: ${evals.skipped}`,
);
if (!evals.ok) process.exitCode = 1;
