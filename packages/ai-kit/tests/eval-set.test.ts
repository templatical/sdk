import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyOperations } from "@templatical/types";
// @ts-expect-error -- .mjs script, no type declarations by design
import { buildManifest } from "../scripts/eval-manifest.mjs";
import {
  AI_EVAL_CASES,
  AI_EVAL_MERGE_TAGS,
  AI_EVAL_TEMPLATES,
  checkEvalCase,
  evalTurnWith,
  runAiEvalSet,
} from "../src/testing";
import { scriptedModel } from "./helpers/scripted-model";

const caseNamed = (name: string) => AI_EVAL_CASES.find((c) => c.name === name)!;
const starter = (content: never) =>
  applyOperations(content, [{ op: "updateBlock", blockId: "cta", set: { text: "Start my trial" } }]);

describe("the test set (D36)", () => {
  it("holds S7's 32 cases over three templates, with a fresh manifest", () => {
    expect(AI_EVAL_CASES).toHaveLength(32);
    expect(Object.keys(AI_EVAL_TEMPLATES).sort()).toEqual(["injection", "promo", "welcome"]);
    expect(readFileSync(resolve(import.meta.dirname, "../eval/MANIFEST.sha256"), "utf8")).toBe(
      buildManifest(),
    );
    expect(AI_EVAL_MERGE_TAGS).toEqual({
      syntax: "liquid",
      tags: [
        { value: "{{first_name}}", label: "First name" },
        { value: "{{coupon_code}}", label: "Coupon code" },
        { value: "{{unsubscribe_url}}", label: "Unsubscribe link" },
      ],
    });
  });

  it("passes a case whose checks hold, and names the first check that fails", () => {
    const welcome = AI_EVAL_TEMPLATES.welcome;
    const after = starter(welcome as never);
    expect(checkEvalCase(caseNamed("button text"), welcome, { content: after, reply: "Done.", applied: true })).toBe(null);
    expect(checkEvalCase(caseNamed("button colour"), welcome, { content: after, reply: "Done.", applied: true })).toBe(
      'check failed: {"type":"field","block":"cta","path":"backgroundColor","matches":"^#16a34a$"}',
    );
  });

  it("fails a case that deleted a block it wasn't allowed to", () => {
    const welcome = AI_EVAL_TEMPLATES.welcome;
    const after = applyOperations(starter(welcome as never), [{ op: "deleteBlock", blockId: "rule" }]);
    expect(checkEvalCase(caseNamed("button text"), welcome, { content: after, reply: "", applied: true })).toBe(
      "block rule was deleted",
    );
  });

  it("reads PCRE's (?i) as case-insensitive", () => {
    const welcome = AI_EVAL_TEMPLATES.welcome;
    const after = applyOperations(welcome, [
      { op: "updateBlock", blockId: "intro", set: { content: "<p>DANKE für Ihre Anmeldung.</p>" } },
    ]);
    expect(checkEvalCase(caseNamed("translate intro"), welcome, { content: after, reply: "", applied: true })).toBe(null);
  });

  it("reports a pass rate against the minimum, counting a throw as a failure", async () => {
    let calls = 0;
    const report = await runAiEvalSet({
      model: "scripted",
      cases: ["button text", "button colour", "remove divider"].map(caseNamed),
      minPassRate: 30,
      runTurn: async ({ content }) => {
        calls += 1;
        if (calls === 3) throw new Error("model down");
        return { content: starter(content as never), reply: "Done.", applied: true };
      },
    });
    expect(report).toMatchObject({ model: "scripted", passed: 1, total: 3, rate: 33, ok: true });
    expect(report.results.map((result) => [result.name, result.ok])).toEqual([
      ["button text", true],
      ["button colour", false],
      ["remove divider", false],
    ]);
  });

  it("runs a case through the kit's own loop with evalTurnWith", async () => {
    const model = scriptedModel([
      [{ type: "tool-call", id: "c1", name: "apply_operations", input: { ops: JSON.stringify([{ op: "updateBlock", blockId: "cta", set: { text: "Start my trial" } }]) } }],
      [{ type: "text", text: "Changed it." }],
    ]);
    const output = await evalTurnWith(model)({
      content: AI_EVAL_TEMPLATES.welcome,
      mergeTags: AI_EVAL_MERGE_TAGS,
      message: "Change the button text to 'Start my trial'",
      selectedBlockId: null,
    });
    expect(output.applied).toBe(true);
    expect(output.reply).toBe("Changed it.");
    expect(checkEvalCase(caseNamed("button text"), AI_EVAL_TEMPLATES.welcome, output)).toBe(null);
  });
});
