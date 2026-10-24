import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { applyOperations } from "@templatical/types";
import { lintTemplate } from "../../quality/src/lint-template";
import * as testing from "../src/testing";
import { version } from "../package.json";
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
import type { AiEvalAltCheck, AiEvalCase, AiEvalCheck } from "../src/testing";

const caseNamed = (name: string) => AI_EVAL_CASES.find((c) => c.name === name)!;
const starter = (content: never) =>
  applyOperations(content, [
    { op: "updateBlock", blockId: "cta", set: { text: "Start my trial" } },
  ]);

describe("the test set (D36)", () => {
  it("retains the editing cases and adds attachment, fix and alt-text cases", () => {
    expect(AI_EVAL_CASES.filter((c) => c.kind === undefined)).toHaveLength(32);
    expect(AI_EVAL_CASES).toHaveLength(41);
    expect(Object.keys(AI_EVAL_TEMPLATES).sort()).toEqual([
      "domain-mismatch",
      "empty",
      "injection",
      "low-text",
      "promo",
      "welcome",
    ]);
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
    expect(
      checkEvalCase(caseNamed("button text"), welcome, {
        content: after,
        reply: "Done.",
        applied: true,
      }),
    ).toBe(null);
    expect(
      checkEvalCase(caseNamed("button colour"), welcome, {
        content: after,
        reply: "Done.",
        applied: true,
      }),
    ).toBe(
      'check failed: {"type":"field","block":"cta","path":"backgroundColor","matches":"^#16a34a$"}',
    );
  });

  it("fails a case that deleted a block it wasn't allowed to", () => {
    const welcome = AI_EVAL_TEMPLATES.welcome;
    const after = applyOperations(starter(welcome as never), [
      { op: "deleteBlock", blockId: "rule" },
    ]);
    expect(
      checkEvalCase(caseNamed("button text"), welcome, {
        content: after,
        reply: "",
        applied: true,
      }),
    ).toBe("block rule was deleted");
  });

  it("reads PCRE's (?i) as case-insensitive", () => {
    const welcome = AI_EVAL_TEMPLATES.welcome;
    const after = applyOperations(welcome, [
      {
        op: "updateBlock",
        blockId: "intro",
        set: { content: "<p>DANKE für Ihre Anmeldung.</p>" },
      },
    ]);
    expect(
      checkEvalCase(caseNamed("translate intro"), welcome, {
        content: after,
        reply: "",
        applied: true,
      }),
    ).toBe(null);
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
        return {
          content: starter(content as never),
          reply: "Done.",
          applied: true,
        };
      },
    });
    expect(report).toMatchObject({
      model: "scripted",
      passed: 1,
      total: 3,
      rate: 33,
      ok: true,
    });
    expect(report.results.map((result) => [result.name, result.ok])).toEqual([
      ["button text", true],
      ["button colour", false],
      ["remove divider", false],
    ]);
  });

  it("runs a case through the kit's own loop with evalTurnWith", async () => {
    const model = scriptedModel([
      [
        {
          type: "tool-call",
          id: "c1",
          name: "apply_operations",
          input: {
            ops: JSON.stringify([
              {
                op: "updateBlock",
                blockId: "cta",
                set: { text: "Start my trial" },
              },
            ]),
          },
        },
      ],
      [{ type: "text", text: "Changed it." }],
    ]);
    const output = await evalTurnWith(model)({
      content: AI_EVAL_TEMPLATES.welcome,
      mergeTags: AI_EVAL_MERGE_TAGS,
      message: "Change the button text to 'Start my trial'",
      selectedBlockId: null,
      finding: null,
      attachments: [],
    });
    expect(output.applied).toBe(true);
    expect(output.reply).toBe("Changed it.");
    expect(
      checkEvalCase(
        caseNamed("button text"),
        AI_EVAL_TEMPLATES.welcome,
        output,
      ),
    ).toBe(null);
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
      skipped: 0,
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
      skipped: 0,
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

const evalDir = resolve(import.meta.dirname, "../eval");
const altCase = (checks: AiEvalAltCheck[]): AiEvalCase => ({
  kind: "altText",
  name: "alt check",
  image: "images/product.png",
  linkHref: null,
  nearbyText: "",
  maxLength: 125,
  checks,
});
const unchanged = async ({ content }: testing.AiEvalTurnInput) => ({
  content,
  reply: "",
  applied: false,
});

// These tests catch dropped dispatch inputs, wrong prompt selection, lost binary
// attachments, and checks that silently pass invalid output.
describe("multimodal and lint evals", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("fails an alt-text case with an unknown runtime check type", async () => {
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      runAltText: async () => "A valid alt text",
      cases: [altCase([{ type: "unknown" } as unknown as AiEvalAltCheck])],
    });
    expect(report).toEqual({
      model: "scripted",
      passed: 0,
      total: 1,
      skipped: 0,
      rate: 0,
      ok: false,
      results: [
        {
          name: "alt check",
          ok: false,
          reason: 'check failed: {"type":"unknown"}',
        },
      ],
    });
  });

  it("checks the manifest after the master generates the binary fixtures", () => {
    expect(readFileSync(resolve(evalDir, "MANIFEST.sha256"), "utf8")).toBe(
      buildManifest(),
    );
  });

  it("requires every case file under eval, including the master's generated binaries", () => {
    const files = AI_EVAL_CASES.flatMap((c) =>
      c.kind === "altText"
        ? [c.image]
        : c.kind === "fix"
          ? []
          : (c.attachments ?? []).map((a) => a.file),
    );
    expect(files).toHaveLength(7);
    for (const file of files) {
      expect(resolve(evalDir, file).startsWith(evalDir + "/")).toBe(true);
      expect(existsSync(resolve(evalDir, file)), file).toBe(true);
    }
  });

  it("dispatches an edit attachment from disk to the model with attachment guidance", async () => {
    const model = scriptedModel([[{ type: "text", text: "Seen." }]]);
    const loaded: string[] = [];
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: evalTurnWith(model),
      cases: [
        {
          kind: "edit",
          name: "attached",
          template: "welcome",
          message: "Build this email from the attached design.",
          attachments: [{ file: "designs/newsletter.png", kind: "image" }],
          checks: [{ type: "reply", matches: "^Seen\\.$" }],
        },
      ],
      loadFile: async (file) => {
        loaded.push(file);
        return new Blob([readFileSync(resolve(evalDir, file))], {
          type: "image/png",
        });
      },
    });
    expect(report).toMatchObject({
      passed: 1,
      total: 1,
      skipped: 0,
      rate: 100,
    });
    expect(loaded).toEqual(["designs/newsletter.png"]);
    const message = model.calls[0].messages[0];
    expect(message.content).toContain(
      "Build this email from the attached design.",
    );
    expect(message.content).toContain("placeholder");
    expect(message.role === "user" && message.attachments).toMatchObject([
      { kind: "image", mediaType: "image/png" },
    ]);
    if (message.role !== "user") throw new Error("Expected user message");
    const attachment = message.attachments![0];
    if (attachment.kind === "image-url")
      throw new Error("Expected Blob attachment");
    const bytes = readFileSync(resolve(evalDir, "designs/newsletter.png"));
    // One native compare: a deep equality over every byte is slow under coverage.
    expect(
      Buffer.from(await attachment.data.arrayBuffer()).equals(bytes),
    ).toBe(true);
  });

  it("uses released URLs for the default attachment loader and reports HTTP failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["pdf"], { type: "application/pdf" })),
      )
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    const inputs: testing.AiEvalTurnInput[] = [];
    const c: AiEvalCase = {
      kind: "edit",
      name: "pdf",
      template: "welcome",
      message: "Read",
      attachments: [{ file: "designs/one-page.pdf", kind: "pdf" }],
      checks: [],
    };
    const report = await runAiEvalSet({
      model: "scripted",
      cases: [c, c],
      runTurn: async (input) => {
        inputs.push(input);
        return unchanged(input);
      },
    });
    expect(fetcher.mock.calls[0][0]).toBe(
      `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/designs/one-page.pdf`,
    );
    expect(inputs[0]).toMatchObject({
      finding: null,
      attachments: [{ kind: "pdf", name: "one-page.pdf" }],
    });
    expect(inputs[0].attachments[0].file.type).toBe("application/pdf");
    expect(report).toMatchObject({ passed: 1, total: 2, skipped: 0, rate: 50 });
    expect(report.results[1].reason).toContain("404");
  });

  it("runs a fix turn with the lint finding rather than a chat request", async () => {
    const finding = {
      ruleId: "deliverability.link-text-domain-mismatch",
      message: "Wrong domain",
      suggestion: "Use words",
      reference: "https://docs.rspamd.com/modules/phishing/",
      blockId: "intro",
    };
    const model = scriptedModel([
      [
        {
          type: "tool-call",
          id: "fix",
          name: "apply_operations",
          input: {
            ops: JSON.stringify([
              {
                op: "updateBlock",
                blockId: "intro",
                set: {
                  content:
                    '<p><a href="https://example.com/start">Start your project</a></p>',
                },
              },
            ]),
          },
        },
      ],
      [{ type: "text", text: "Fixed." }],
    ]);
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: evalTurnWith(model),
      lintCheck: (content) =>
        lintTemplate(content).map((issue) => issue.ruleId),
      cases: [
        {
          kind: "fix",
          name: "fix",
          template: "welcome",
          finding,
          checks: [
            { type: "applied" },
            { type: "lintGone", ruleId: finding.ruleId },
          ],
        },
      ],
    });
    expect(report).toMatchObject({ passed: 1, total: 1, skipped: 0 });
    expect(model.calls[0].messages[0].content).toContain("Wrong domain");
    expect(model.calls[0].messages[0].content).toContain("Use words");
    expect(model.calls[0].messages[0].content).toContain("href");
  });

  it("copies real lint findings into the fix fixtures on the right block", () => {
    const fixes = AI_EVAL_CASES.filter((c) => c.kind === "fix");
    expect(fixes).toHaveLength(2);
    for (const c of fixes) {
      if (c.kind !== "fix") throw new Error("Expected fix");
      const issue = lintTemplate(AI_EVAL_TEMPLATES[c.template]).find(
        (i) => i.ruleId === c.finding.ruleId && i.blockId === c.finding.blockId,
      );
      expect(issue).toBeDefined();
      expect(issue).toMatchObject(c.finding);
      expect(c.finding.blockId).toBe(
        c.template === "domain-mismatch" ? "domain-link" : null,
      );
    }
  });

  it.each([
    {
      html: '<p><a href="https://acme.example/shop">Visit the shop</a></p>',
      valid: true,
    },
    {
      html: "<p><a href='https://acme.example/shop'>Visit the shop</a></p>",
      valid: true,
    },
    {
      html: '<p><a data-href="https://acme.example/shop" href="https://invented.example/shop">Visit the shop</a></p>',
      valid: false,
    },
    {
      html: '<p><a href="https://acme.example/shop">WWW.acme.example</a></p>',
      valid: false,
    },
  ])(
    "checks the actual anchor href across quote styles: $html",
    ({ html, valid }) => {
      const c = caseNamed("fix domain-mismatch");
      if (c.kind !== "fix") throw new Error("Expected fix case");
      const original = AI_EVAL_TEMPLATES[c.template];
      const content = applyOperations(original, [
        { op: "updateBlock", blockId: "domain-link", set: { content: html } },
      ]);
      const reason = checkEvalCase(
        c,
        original,
        { content, reply: "Fixed.", applied: true },
        (result) => lintTemplate(result).map((issue) => issue.ruleId),
      );
      expect(reason === null).toBe(valid);
    },
  );

  it.each([
    { label: "", valid: false },
    { label: " \t \n ", valid: false },
    { label: "Explore the studio shop", valid: true },
  ])(
    "requires a descriptive domain-fix label: $label",
    async ({ label, valid }) => {
      const model = scriptedModel([
        [
          {
            type: "tool-call",
            id: "fix-label",
            name: "apply_operations",
            input: {
              ops: JSON.stringify([
                {
                  op: "updateBlock",
                  blockId: "domain-link",
                  set: {
                    content: `<p><a href="https://acme.example/shop">${label}</a></p>`,
                  },
                },
              ]),
            },
          },
        ],
        [{ type: "text", text: "Fixed the label." }],
      ]);
      const report = await runAiEvalSet({
        model: "scripted",
        cases: [caseNamed("fix domain-mismatch")],
        runTurn: evalTurnWith(model),
        lintCheck: (content) =>
          lintTemplate(content).map((issue) => issue.ruleId),
      });
      expect(report).toMatchObject({
        total: 1,
        skipped: 0,
        passed: valid ? 1 : 0,
      });
      expect(report.results[0].reason).toBe(
        valid
          ? null
          : 'check failed: {"type":"lintGone","ruleId":"a11y.link-empty"}',
      );
    },
  );

  it.each([
    { src: "", addCopy: false, valid: false },
    { src: "https://example.com/clay-mug.png", addCopy: true, valid: true },
    {
      src: "https://example.com/clay-mug.png?changed=1",
      addCopy: true,
      valid: false,
    },
    { src: "xhttps://example.com/clay-mug.png", addCopy: true, valid: false },
    { src: "https://exampleXcom/clay-mugYpng", addCopy: true, valid: false },
  ])(
    "preserves the original low-text image URL: $src",
    async ({ src, addCopy, valid }) => {
      const copy =
        "The blue clay mug holds 350 ml and costs $24. Choose this clay mug if you want a blue mug with a 350 ml capacity. Hand wash the mug after use. This mug is available in blue, holds 350 ml, costs $24, and should be washed by hand.";
      const model = scriptedModel([
        [
          {
            type: "tool-call",
            id: "fix-low-text",
            name: "apply_operations",
            input: {
              ops: JSON.stringify([
                { op: "updateBlock", blockId: "mug-image", set: { src } },
                ...(addCopy
                  ? [
                      {
                        op: "updateBlock",
                        blockId: "mug-facts",
                        set: { content: `<p>${copy}</p>` },
                      },
                    ]
                  : []),
              ]),
            },
          },
        ],
        [{ type: "text", text: "Fixed the text." }],
      ]);
      const report = await runAiEvalSet({
        model: "scripted",
        cases: [caseNamed("fix low-text")],
        runTurn: evalTurnWith(model),
        lintCheck: (content) =>
          lintTemplate(content).map((issue) => issue.ruleId),
      });
      expect(report).toMatchObject({
        total: 1,
        skipped: 0,
        passed: valid ? 1 : 0,
      });
      if (valid) expect(report.results[0].reason).toBe(null);
      else
        expect(report.results[0].reason).toContain(
          '"type":"field","block":"mug-image","path":"src"',
        );
    },
  );

  it("skips missing optional runners and excludes skipped cases from the rate", async () => {
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [
        {
          name: "edit",
          template: "welcome",
          message: "No change",
          checks: [{ type: "notApplied" }],
        },
        altCase([{ type: "nonEmpty" }]),
        {
          kind: "fix",
          name: "lint",
          template: "welcome",
          finding: {
            ruleId: "rule",
            message: "m",
            suggestion: "s",
            reference: "https://example.com",
            blockId: null,
          },
          checks: [{ type: "lintGone", ruleId: "rule" }],
        },
      ],
    });
    expect(report).toMatchObject({
      passed: 1,
      total: 1,
      skipped: 2,
      rate: 100,
      ok: true,
    });
    expect(report.results.slice(1)).toEqual([
      {
        name: "alt check",
        ok: false,
        reason: expect.stringContaining("runAltText"),
        skipped: true,
      },
      {
        name: "lint",
        ok: false,
        reason: expect.stringContaining("lintCheck"),
        skipped: true,
      },
    ]);
    const allSkipped = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [altCase([])],
    });
    expect(allSkipped).toMatchObject({
      passed: 0,
      total: 0,
      skipped: 1,
      rate: 0,
      ok: false,
    });
  });

  it.each([
    { check: { type: "nonEmpty" }, pass: "Mug", fail: "   " },
    {
      check: { type: "withinLimit" },
      pass: "a".repeat(125),
      fail: "😀".repeat(63),
    },
    {
      check: { type: "containsAll", texts: ["mug", "$24"] },
      pass: "MUG for $24",
      fail: "Mug",
    },
    {
      check: { type: "containsAny", texts: ["shop", "buy"] },
      pass: "BUY now",
      fail: "Welcome",
    },
    {
      check: { type: "notMatches", matches: "\\b(image|picture|photo) of\\b" },
      pass: "Mug",
      fail: "PHOTO OF a mug",
    },
    {
      check: { type: "shortOrMatches", chars: 20, matches: "decorative" },
      pass: "DECORATIVE divider with a very long description",
      fail: "A long description of a dividing line",
    },
    {
      check: { type: "shortOrMatches", chars: 20, matches: "decorative" },
      pass: "Divider",
      fail: "A long description of a dividing line",
    },
  ])(
    "passes and fails alt-text check $check.type",
    async ({ check, pass, fail }) => {
      const c = altCase([check as AiEvalAltCheck]);
      const good = await runAiEvalSet({
        model: "scripted",
        runTurn: unchanged,
        runAltText: async () => pass,
        cases: [c],
      });
      const bad = await runAiEvalSet({
        model: "scripted",
        runTurn: unchanged,
        runAltText: async () => fail,
        cases: [c],
      });
      expect(good).toMatchObject({
        passed: 1,
        total: 1,
        skipped: 0,
        rate: 100,
      });
      expect(bad).toMatchObject({ passed: 0, total: 1, skipped: 0, rate: 0 });
      expect(bad.results[0].reason).toBe(
        `check failed: ${JSON.stringify(check)}`,
      );
    },
  );

  it("passes and fails fieldNot and lintGone with the output content", async () => {
    const c: AiEvalCase = {
      name: "new checks",
      template: "welcome",
      message: "Check",
      checks: [
        { type: "fieldNot", block: "cta", path: "text", matches: "www\\.|://" },
        { type: "lintGone", ruleId: "bad" },
      ],
    };
    const inputContents: unknown[] = [];
    const good = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [c],
      lintCheck: (content) => {
        inputContents.push(content);
        return [];
      },
    });
    expect(good.passed).toBe(1);
    expect(inputContents[0]).toEqual(AI_EVAL_TEMPLATES.welcome);
    const bad = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [c],
      lintCheck: () => ["bad"],
    });
    expect(bad.results[0].reason).toBe(
      'check failed: {"type":"lintGone","ruleId":"bad"}',
    );
    const badField = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [
        {
          ...c,
          checks: [
            {
              type: "fieldNot",
              block: "cta",
              path: "text",
              matches: "Get started",
            },
          ],
        },
      ],
    });
    expect(badField.passed).toBe(0);
    const missing = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [
        {
          ...c,
          checks: [
            { type: "fieldNot", block: "missing", path: "text", matches: "x" },
          ],
        },
      ],
    });
    expect(missing.passed).toBe(0);
  });

  it("builds alt-text requests with released or custom URLs and normalizes streamed text", async () => {
    const input: testing.AiEvalAltTextInput = {
      image: "images/product.png",
      linkHref: "https://example.com/shop",
      nearbyText: "Clay mug",
      maxLength: 125,
    };
    const model = scriptedModel([
      [
        { type: "text", text: '  "Clay ' },
        { type: "usage", inputTokens: 1, outputTokens: 2 },
        { type: "text", text: 'mug $24"  ' },
      ],
    ]);
    expect(await testing.evalAltTextWith(model)(input)).toBe("Clay mug $24");
    expect(model.calls[0].tools).toEqual([]);
    expect(model.calls[0].messages[0]).toMatchObject({
      role: "user",
      attachments: [
        {
          kind: "image-url",
          url: `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/images/product.png`,
        },
      ],
    });
    expect(JSON.parse(model.calls[0].messages[0].content)).toEqual({
      currentAlt: null,
      linkHref: "https://example.com/shop",
      nearbyText: "Clay mug",
      locale: "en",
    });
    expect(model.calls[0].system).toContain("125");
    const custom = scriptedModel([[{ type: "text", text: "Shop mugs" }]]);
    await testing.evalAltTextWith(custom, {
      imageUrl: (file) => `https://preview.example.com/${file}`,
    })(input);
    expect(custom.calls[0].messages[0]).toMatchObject({
      attachments: [
        {
          kind: "image-url",
          url: "https://preview.example.com/images/product.png",
        },
      ],
    });
    const invalid = scriptedModel([[{ type: "text", text: "a".repeat(126) }]]);
    await expect(testing.evalAltTextWith(invalid)(input)).rejects.toMatchObject(
      { code: "ai_output_invalid" },
    );
  });

  it("reports alt-text runner failures as failed cases", async () => {
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      cases: [altCase([])],
      runAltText: async () => {
        throw new Error("model down");
      },
    });
    expect(report.results).toEqual([
      { name: "alt check", ok: false, reason: "Error: model down" },
    ]);
  });

  it("repairs a self-correcting alt-text answer in exactly two model calls", async () => {
    const answer =
      "First draft\nWait, I need to output only the final alt text…\nShop mugs";
    const model = scriptedModel([
      [{ type: "text", text: answer }],
      [{ type: "text", text: '  "Image of Shop mugs"  ' }],
    ]);
    const report = await runAiEvalSet({
      model: "scripted",
      runTurn: unchanged,
      runAltText: testing.evalAltTextWith(model),
      cases: [
        {
          ...altCase([{ type: "containsAll", texts: ["Shop mugs"] }]),
          maxLength: 60,
        },
      ],
    });
    expect(report).toMatchObject({ passed: 1, total: 1, ok: true });
    expect(report.results).toEqual([
      { name: "alt check", ok: true, reason: null },
    ]);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1]).toEqual({
      system: model.calls[0].system,
      messages: [
        ...model.calls[0].messages,
        { role: "assistant", content: answer },
        {
          role: "user",
          content:
            "Your answer had several lines. Reply again with only the alt text: one line of plain text, at most 60 characters.",
        },
      ],
      tools: [],
    });
  });

  it("fails a second invalid alt-text answer without a third model call", async () => {
    const model = scriptedModel([
      [{ type: "text", text: "First draft\nCorrected draft" }],
      [{ type: "text", text: "<b>Shop mugs</b>" }],
      [{ type: "text", text: "Shop mugs" }],
    ]);
    await expect(
      testing.evalAltTextWith(model)({
        image: "images/product.png",
        linkHref: null,
        nearbyText: "",
        maxLength: 60,
      }),
    ).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 502,
      code: "ai_output_invalid",
    });
    expect(model.calls).toHaveLength(2);
  });

  it("hashes nested binaries and HTML sources in sorted relative-path order", () => {
    const parent = resolve(import.meta.dirname, "../../../node_modules/.cache");
    mkdirSync(parent, { recursive: true });
    const folder = mkdtempSync(resolve(parent, "eval-manifest-"));
    try {
      mkdirSync(resolve(folder, "images"));
      mkdirSync(resolve(folder, "sources"));
      mkdirSync(resolve(folder, "designs"));
      for (const file of [
        "z.json",
        "images/b.png",
        "designs/a.pdf",
        "sources/a.html",
        "ignored.txt",
      ])
        writeFileSync(resolve(folder, file), "abc");
      const hash =
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
      expect(buildManifest(folder)).toBe(
        ["designs/a.pdf", "images/b.png", "sources/a.html", "z.json"]
          .map((file) => `${hash}  ${file}\n`)
          .join(""),
      );
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("keeps the testing entry free of Node built-ins", () => {
    const folder = resolve(import.meta.dirname, "../src/testing");
    for (const name of readdirSync(folder).filter((file) =>
      file.endsWith(".ts"),
    )) {
      expect(readFileSync(resolve(folder, name), "utf8"), name).not.toMatch(
        /(?:from\s*|import\s*\()(["'])node:/,
      );
    }
  });
});
