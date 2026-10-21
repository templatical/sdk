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
import type { AiEvalCase, AiEvalCheck } from "../src/testing";

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

  it.each<{
    type: AiEvalCheck["type"];
    passing: AiEvalCheck;
    failing: AiEvalCheck;
    applied?: boolean;
    reason: string;
  }>([
    {
      type: "applied",
      passing: { type: "applied" },
      failing: { type: "notApplied" },
      reason: 'check failed: {"type":"notApplied"}',
    },
    {
      type: "notApplied",
      passing: { type: "notApplied" },
      failing: { type: "applied" },
      applied: false,
      reason: 'check failed: {"type":"applied"}',
    },
    {
      type: "present",
      passing: { type: "present", block: "headline" },
      failing: { type: "present", block: "gone" },
      reason: 'check failed: {"type":"present","block":"gone"}',
    },
    {
      type: "missing",
      passing: { type: "missing", block: "gone" },
      failing: { type: "missing", block: "headline" },
      reason: 'check failed: {"type":"missing","block":"headline"}',
    },
    {
      type: "contains",
      passing: { type: "contains", block: "headline", text: "WELCOME" },
      failing: { type: "contains", block: "headline", text: "Goodbye" },
      reason:
        'check failed: {"type":"contains","block":"headline","text":"Goodbye"}',
    },
    {
      type: "notContains",
      passing: { type: "notContains", text: "Goodbye" },
      failing: { type: "notContains", text: "WELCOME" },
      reason: 'check failed: {"type":"notContains","text":"WELCOME"}',
    },
    {
      type: "field",
      passing: {
        type: "field",
        block: "cta",
        path: "styles.padding.top",
        matches: "^16$",
      },
      failing: {
        type: "field",
        block: "cta",
        path: "styles.padding.top",
        matches: "^8$",
      },
      reason:
        'check failed: {"type":"field","block":"cta","path":"styles.padding.top","matches":"^8$"}',
    },
    {
      type: "setting",
      passing: { type: "setting", path: "width", matches: "^600$" },
      failing: { type: "setting", path: "width", matches: "^640$" },
      reason:
        'check failed: {"type":"setting","path":"width","matches":"^640$"}',
    },
    {
      type: "greater",
      passing: { type: "greater", block: "cta", path: "fontSize", than: 15 },
      failing: { type: "greater", block: "cta", path: "fontSize", than: 16 },
      reason:
        'check failed: {"type":"greater","block":"cta","path":"fontSize","than":16}',
    },
    {
      type: "maxText",
      passing: { type: "maxText", block: "headline", chars: 40 },
      failing: { type: "maxText", block: "headline", chars: 1 },
      reason: 'check failed: {"type":"maxText","block":"headline","chars":1}',
    },
    {
      type: "countType",
      passing: { type: "countType", blockType: "paragraph", min: 4 },
      failing: { type: "countType", blockType: "paragraph", min: 5 },
      reason:
        'check failed: {"type":"countType","blockType":"paragraph","min":5}',
    },
    {
      type: "order",
      passing: { type: "order", first: "features", then: "feature-left" },
      failing: { type: "order", first: "feature-left", then: "features" },
      reason:
        'check failed: {"type":"order","first":"feature-left","then":"features"}',
    },
    {
      type: "firstContains",
      passing: { type: "firstContains", text: "PLACEHOLD.CO" },
      failing: { type: "firstContains", text: "Welcome" },
      reason: 'check failed: {"type":"firstContains","text":"Welcome"}',
    },
    {
      type: "reply",
      passing: { type: "reply", matches: "(?i)^done\\.$" },
      failing: { type: "reply", matches: "^No$" },
      reason: 'check failed: {"type":"reply","matches":"^No$"}',
    },
  ])(
    "reports exact passing and failing results for $type",
    ({ passing, failing, applied = true, reason }) => {
      const original = AI_EVAL_TEMPLATES.welcome;
      const testCase: AiEvalCase = {
        name: "checks",
        template: "welcome",
        message: "Check",
        checks: [passing],
      };
      const output = { content: original, reply: "Done.", applied };
      expect(checkEvalCase(testCase, original, output)).toBe(null);
      expect(
        checkEvalCase({ ...testCase, checks: [failing] }, original, output),
      ).toBe(reason);
    },
  );

  it.each([
    { html: "<p>Hi <b>there</b></p>", chars: 8 },
    { html: "<p>Hi</p> <there", chars: 9 },
    { html: " <p>😀 there</p> ", chars: 7 },
  ])(
    "maxText measures text and preserves unmatched angle brackets in $html",
    ({ html, chars }) => {
      const original = AI_EVAL_TEMPLATES.welcome;
      const content = applyOperations(original, [
        { op: "updateBlock", blockId: "intro", set: { content: html } },
      ]);
      const testCase: AiEvalCase = {
        name: "text length",
        template: "welcome",
        message: "Shorten",
        checks: [{ type: "maxText", block: "intro", chars }],
      };
      const output = { content, reply: "", applied: true };
      expect(checkEvalCase(testCase, original, output)).toBe(null);
      expect(
        checkEvalCase(
          {
            ...testCase,
            checks: [{ type: "maxText", block: "intro", chars: chars - 1 }],
          },
          original,
          output,
        ),
      ).toBe(
        `check failed: {"type":"maxText","block":"intro","chars":${chars - 1}}`,
      );
    },
  );

  it("checks absent blocks, absent nested values and non-text blocks without inventing values", () => {
    const original = AI_EVAL_TEMPLATES.welcome;
    const testCase: AiEvalCase = {
      name: "missing values",
      template: "welcome",
      message: "Check",
      checks: [],
    };
    const output = { content: original, reply: "", applied: false };
    const failures: AiEvalCheck[] = [
      { type: "contains", block: "gone", text: "x" },
      { type: "field", block: "gone", path: "content", matches: ".*" },
      { type: "greater", block: "gone", path: "fontSize", than: 0 },
      { type: "greater", block: "headline", path: "content", than: 0 },
      { type: "maxText", block: "gone", chars: 0 },
      { type: "order", first: "gone", then: "headline" },
      { type: "order", first: "headline", then: "gone" },
    ];
    for (const check of failures) {
      expect(
        checkEvalCase({ ...testCase, checks: [check] }, original, output),
      ).toBe(`check failed: ${JSON.stringify(check)}`);
    }
    expect(
      checkEvalCase(
        {
          ...testCase,
          checks: [
            { type: "notContains", block: "gone", text: "x" },
            { type: "contains", text: "Welcome" },
            { type: "notContains", block: "headline", text: "Goodbye" },
            {
              type: "field",
              block: "headline",
              path: "missing.child",
              matches: "^null$",
            },
            { type: "setting", path: "missing.child", matches: "^null$" },
            { type: "maxText", block: "logo", chars: 0 },
          ],
        },
        original,
        output,
      ),
    ).toBe(null);
    const empty = { ...original, blocks: [] };
    expect(
      checkEvalCase(
        { ...testCase, checks: [{ type: "firstContains", text: "Welcome" }] },
        empty,
        { ...output, content: empty },
      ),
    ).toBe('check failed: {"type":"firstContains","text":"Welcome"}');
  });

  it("allows explicitly removed blocks and retains the other original ids", () => {
    const original = AI_EVAL_TEMPLATES.welcome;
    const content = applyOperations(original, [
      { op: "deleteBlock", blockId: "rule" },
    ]);
    expect(
      checkEvalCase(
        {
          ...caseNamed("remove divider"),
          removed: ["rule"],
          checks: [{ type: "missing", block: "rule" }],
        },
        original,
        { content, reply: "", applied: true },
      ),
    ).toBe(null);
  });

  it("reports non-Error rejections and an empty test set exactly", async () => {
    expect(
      await runAiEvalSet({
        model: "unavailable",
        cases: [caseNamed("button text")],
        runTurn: async () => {
          throw "offline";
        },
      }),
    ).toEqual({
      model: "unavailable",
      passed: 0,
      total: 1,
      rate: 0,
      ok: false,
      results: [{ name: "button text", ok: false, reason: "offline" }],
    });
    expect(
      await runAiEvalSet({
        model: "empty",
        cases: [],
        minPassRate: 0,
        runTurn: async ({ content }) => ({
          content,
          reply: "",
          applied: false,
        }),
      }),
    ).toEqual({
      model: "empty",
      passed: 0,
      total: 0,
      rate: 0,
      ok: true,
      results: [],
    });
  });

  it("rejects an unknown runtime check type with the exact failed-check reason", () => {
    const original = AI_EVAL_TEMPLATES.welcome;
    // A JavaScript caller or JSON input can supply a type outside the TS union.
    const testCase = {
      name: "unknown check",
      template: "welcome",
      message: "Check",
      checks: [{ type: "unknown", block: "headline" }],
    } as unknown as AiEvalCase;
    expect(
      checkEvalCase(testCase, original, {
        content: original,
        reply: "Done.",
        applied: true,
      }),
    ).toBe('check failed: {"type":"unknown","block":"headline"}');
  });
});
