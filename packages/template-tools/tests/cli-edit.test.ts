import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runEdit } from "../src/cli/commands/edit";
import { validateTemplate } from "../src/validate";
import { InvalidTemplateError, UsageError } from "../src/cli/io";
import { localeCoverage, resolveLocale, sourceHash } from "@templatical/types";

const pad = { top: 0, right: 0, bottom: 0, left: 0 };
// Every required property is present deliberately — `edit` validates before it
// writes, so an under-specified fixture makes every case in this file throw.
const BASE = {
  blocks: [
    {
      id: "title_1",
      type: "title",
      content: "Hello",
      level: 1,
      textAlign: "left",
      styles: { padding: pad },
    },
    {
      id: "button_1",
      type: "button",
      text: "Go",
      url: "https://example.com",
      backgroundColor: "#1d4ed8",
      textColor: "#ffffff",
      borderRadius: 6,
      fontSize: 16,
      buttonPadding: { top: 12, right: 24, bottom: 12, left: 24 },
      align: "center",
      styles: { padding: pad },
    },
  ],
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#111111",
    fontFamily: "Arial, sans-serif",
    linkUnderline: true,
    locale: "en",
  },
};

let dir: string;
let file: string;
let stdout: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-edit-"));
  file = join(dir, "t.json");
  writeFileSync(file, `${JSON.stringify(BASE, null, 2)}\n`, "utf8");
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdout.push(String(c));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

const read = () => JSON.parse(readFileSync(file, "utf8"));

describe("edit command", () => {
  it("moves a block into an existing wrapper and writes a schema-valid file", () => {
    const before = read();
    before.blocks.push({
      id: "wrap_1",
      type: "wrapper",
      children: [],
      styles: { padding: pad },
    });
    writeFileSync(file, `${JSON.stringify(before, null, 2)}\n`);
    const op = JSON.stringify({
      op: "moveBlock",
      blockId: "title_1",
      parent: { wrapperId: "wrap_1" },
      after: null,
    });
    expect(runEdit(parseArgs(["edit", file, "--op", op]))).toBe(0);
    expect(read().blocks.map((block: { id: string }) => block.id)).toEqual([
      "button_1",
      "wrap_1",
    ]);
    expect(read().blocks[1].children).toEqual([BASE.blocks[0]]);
    expect(validateTemplate(read()).valid).toBe(true);
  });

  it("applies a single operation and writes the file", () => {
    const op = JSON.stringify({
      op: "updateBlock",
      blockId: "button_1",
      set: { text: "Shop now" },
    });
    expect(runEdit(parseArgs(["edit", file, "--op", op]))).toBe(0);
    expect(read().blocks[1].text).toBe("Shop now");
  });

  it("applies a batch in order", () => {
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        { op: "updateBlock", blockId: "title_1", set: { content: "One" } },
        {
          op: "moveBlock",
          blockId: "title_1",
          parent: null,
          after: "button_1",
        },
        { op: "updateBlock", blockId: "title_1", set: { content: "Two" } },
      ]),
    );
    expect(runEdit(parseArgs(["edit", file, "--ops", ops]))).toBe(0);
    expect(read().blocks.map((block: { id: string }) => block.id)).toEqual([
      "button_1",
      "title_1",
    ]);
    expect(read().blocks[1].content).toBe("Two");
  });

  it("leaves the file byte-identical when an operation mid-batch is refused, naming it", () => {
    const before = readFileSync(file, "utf8");
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        { op: "updateBlock", blockId: "title_1", set: { content: "One" } },
        { op: "updateBlock", blockId: "does_not_exist", set: { content: "x" } },
        { op: "updateBlock", blockId: "button_1", set: { text: "Three" } },
      ]),
    );
    expect(() => runEdit(parseArgs(["edit", file, "--ops", ops]))).toThrow(
      /^Operation 2 \(updateBlock\) was refused: block_missing — .*does_not_exist/,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses a section into a section column and writes nothing", () => {
    const withSection = {
      ...BASE,
      blocks: [
        ...BASE.blocks,
        {
          id: "sec_1",
          type: "section",
          columns: "1",
          children: [[]],
          styles: { padding: pad },
        },
      ],
    };
    writeFileSync(file, `${JSON.stringify(withSection, null, 2)}\n`, "utf8");
    const before = readFileSync(file, "utf8");
    const op = JSON.stringify({
      op: "addBlock",
      block: {
        id: "sec_2",
        type: "section",
        columns: "1",
        children: [[]],
        styles: { padding: pad },
      },
      parent: { sectionId: "sec_1", column: 0 },
      after: null,
    });
    expect(() => runEdit(parseArgs(["edit", file, "--op", op]))).toThrow(
      /Operation 1 \(addBlock\) was refused: invalid_operation/,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("points an operation in the old vocabulary at the new one, writing nothing", () => {
    const before = readFileSync(file, "utf8");
    const op = JSON.stringify({
      operation: "updateBlock",
      data: { blockId: "title_1", updates: { content: "Old" } },
    });
    expect(() => runEdit(parseArgs(["edit", file, "--op", op]))).toThrow(
      /Operation 1 uses the old \{"operation", "data"\} form/,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("writes nothing when the result fails structural validation", () => {
    const before = readFileSync(file, "utf8");
    const op = JSON.stringify({
      op: "updateBlock",
      blockId: "button_1",
      set: { url: 42 },
    });
    expect(() => runEdit(parseArgs(["edit", file, "--op", op]))).toThrow(
      InvalidTemplateError,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("reports the applied count under --json", () => {
    setJsonMode(true);
    const op = JSON.stringify({
      op: "updateBlock",
      blockId: "title_1",
      set: { content: "X" },
    });
    runEdit(parseArgs(["edit", file, "--op", op, "--json"]));
    expect(JSON.parse(stdout.join(""))).toMatchObject({ applied: 1 });
  });

  it("requires --op or --ops", () => {
    expect(() => runEdit(parseArgs(["edit", file]))).toThrow(UsageError);
  });

  it("refuses both --op and --ops together", () => {
    const ops = join(dir, "ops.json");
    writeFileSync(ops, "[]");
    expect(() =>
      runEdit(parseArgs(["edit", file, "--op", "{}", "--ops", ops])),
    ).toThrow(/not both/);
  });

  it("refuses both --op and --ops together even when --op is empty", () => {
    // flagValue returns "" (not undefined) for an explicitly-empty flag, so a
    // truthy check on `inline` would miss this and silently run the batch.
    const before = readFileSync(file, "utf8");
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        {
          op: "updateBlock",
          blockId: "title_1",
          set: { content: "Should not apply" },
        },
      ]),
    );
    expect(() =>
      runEdit(parseArgs(["edit", file, "--op", "", "--ops", ops])),
    ).toThrow(/not both/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

it("edits the default language with an explicit operation and validates removed optional fields", () => {
  const before = {
    ...BASE,
    settings: {
      ...BASE.settings,
      locales: ["de", "fr"],
      preheaderText: "Hello",
      l10n: {
        de: { set: { preheaderText: null } },
        fr: {
          text: { preheaderText: { value: "Bonjour", sourceHash: "f55c314b" } },
        },
      },
    },
  };
  writeFileSync(file, JSON.stringify(before));
  expect(
    runEdit(
      parseArgs([
        "edit",
        file,
        "--op",
        '{"op":"setDefaultLocale","locale":"de"}',
      ]),
    ),
  ).toBe(0);
  expect(read().settings).toMatchObject({
    locale: "de",
    locales: ["en", "fr"],
    l10n: {
      en: { set: { preheaderText: "Hello" } },
      fr: { set: { preheaderText: "Bonjour" } },
    },
  });
  expect(read().settings).not.toHaveProperty("preheaderText");
  expect(read().blocks[0].l10n?.en.text?.content).toEqual({
    value: "Hello",
    sourceHash: sourceHash("Hello"),
  });
  expect(localeCoverage(read(), "en").missing).toEqual([]);
  expect(validateTemplate(read()).valid).toBe(true);
  expect(
    runEdit(
      parseArgs([
        "edit",
        file,
        "--op",
        '{"op":"updateBlock","blockId":"title_1","set":{"content":"Hallo"}}',
      ]),
    ),
  ).toBe(0);
  expect(resolveLocale(read(), "en").blocks[0]).toMatchObject({
    content: "Hello",
  });
  expect(localeCoverage(read(), "en").stale).toEqual(["title_1/content"]);
});

it("uses edit --definitions to preserve only custom text and textarea when making the default", () => {
  const definitions = join(dir, "definitions.json");
  writeFileSync(
    definitions,
    JSON.stringify([
      {
        type: "card",
        name: "Card",
        template: "<p>{{ headline }}</p><p>{{ body }}</p>",
        fields: [
          { key: "headline", label: "Headline", type: "text" },
          { key: "body", label: "Body", type: "textarea" },
          { key: "color", label: "Color", type: "color" },
        ],
      },
    ]),
  );
  writeFileSync(
    file,
    JSON.stringify({
      ...BASE,
      settings: { ...BASE.settings, locales: ["de"] },
      blocks: [
        {
          id: "custom",
          type: "custom",
          customType: "card",
          fieldValues: {
            headline: "English title",
            body: "English body",
            color: "#123456",
          },
          renderedHtml: "<p>English title</p>",
          styles: { padding: pad },
        },
      ],
    }),
  );
  expect(
    runEdit(
      parseArgs([
        "edit",
        file,
        "--op",
        '{"op":"setDefaultLocale","locale":"de"}',
        "--definitions",
        definitions,
      ]),
    ),
  ).toBe(0);
  expect(read().blocks[0].l10n?.en.text).toEqual({
    "fieldValues.headline": {
      value: "English title",
      sourceHash: sourceHash("English title"),
    },
    "fieldValues.body": {
      value: "English body",
      sourceHash: sourceHash("English body"),
    },
  });
  expect(
    validateTemplate(read(), JSON.parse(readFileSync(definitions, "utf8")))
      .valid,
  ).toBe(true);
});

it("keeps explicit custom text paths when edit --definitions would capture another field", () => {
  const definitions = join(dir, "definitions.json");
  writeFileSync(
    definitions,
    JSON.stringify([
      {
        type: "card",
        name: "Card",
        template: "<p>{{ headline }}</p><p>{{ body }}</p>",
        fields: [
          { key: "headline", label: "Headline", type: "text" },
          { key: "body", label: "Body", type: "textarea" },
        ],
      },
    ]),
  );
  writeFileSync(
    file,
    JSON.stringify({
      ...BASE,
      settings: { ...BASE.settings, locales: ["de"] },
      blocks: [
        {
          id: "custom",
          type: "custom",
          customType: "card",
          fieldValues: { headline: "English title", body: "English body" },
          styles: { padding: pad },
        },
      ],
    }),
  );
  expect(
    runEdit(
      parseArgs([
        "edit",
        file,
        "--op",
        JSON.stringify({
          op: "setDefaultLocale",
          locale: "de",
          customTextFields: { custom: ["fieldValues.headline"] },
        }),
        "--definitions",
        definitions,
      ]),
    ),
  ).toBe(0);
  expect(read().blocks[0].l10n?.en.text).toEqual({
    "fieldValues.headline": {
      value: "English title",
      sourceHash: sourceHash("English title"),
    },
  });
  expect(read().blocks[0].fieldValues).toEqual({
    headline: "English title",
    body: "English body",
  });
  expect(read().settings).toMatchObject({ locale: "de", locales: ["en"] });
});

const HIDDEN_MESSAGES = [
  [1, '1 block is hidden in "de". Show it before making it the default.'],
  [2, '2 blocks are hidden in "de". Show them before making it the default.'],
] as const;

/** A template whose first `count` blocks are hidden in `de`. */
function hiddenIn(count: number) {
  writeFileSync(
    file,
    JSON.stringify({
      ...BASE,
      settings: { ...BASE.settings, locales: ["de"] },
      blocks: BASE.blocks.map((block, index) => ({
        ...block,
        ...(index < count ? { l10n: { de: { hidden: true } } } : {}),
      })),
    }),
  );
  return readFileSync(file, "utf8");
}
const setDefaultArgs = (...flags: string[]) => [
  "edit",
  file,
  "--op",
  '{"op":"setDefaultLocale","locale":"de"}',
  ...flags,
];

describe("edit refusing setDefaultLocale because blocks are hidden", () => {
  it.each(HIDDEN_MESSAGES)(
    "names the first of %i hidden block(s) in the message",
    (count, message) => {
      const before = hiddenIn(count);
      expect(() => runEdit(parseArgs(setDefaultArgs()))).toThrow(
        `Operation 1 (setDefaultLocale) was refused: invalid_operation — ${message} Block: "title_1".`,
      );
      expect(stdout).toEqual([]);
      expect(readFileSync(file, "utf8")).toBe(before);
    },
  );

  it.each(HIDDEN_MESSAGES)(
    "names the first of %i hidden block(s) under --json too, with nothing on stdout",
    (count, message) => {
      const before = hiddenIn(count);
      setJsonMode(true);
      expect(() => runEdit(parseArgs(setDefaultArgs("--json")))).toThrow(
        `Operation 1 (setDefaultLocale) was refused: invalid_operation — ${message} Block: "title_1".`,
      );
      expect(stdout).toEqual([]);
      expect(readFileSync(file, "utf8")).toBe(before);
    },
  );

  it.each(["in", "block", "Show", "de"])(
    "names a block whose id %j is a word or a quoted value of the message",
    (id) => {
      writeFileSync(
        file,
        JSON.stringify({
          ...BASE,
          settings: { ...BASE.settings, locales: ["de"] },
          blocks: BASE.blocks.map((block, index) => ({
            ...block,
            ...(index === 0 ? { id, l10n: { de: { hidden: true } } } : {}),
          })),
        }),
      );
      expect(() => runEdit(parseArgs(setDefaultArgs()))).toThrow(
        `Operation 1 (setDefaultLocale) was refused: invalid_operation — ${HIDDEN_MESSAGES[0][1]} Block: "${id}".`,
      );
    },
  );

  it("leaves out a block id the engine doesn't name", () => {
    const before = readFileSync(file, "utf8");
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        { op: "updateBlock", blockId: "title_1", set: { content: "Changed" } },
        { op: "setDefaultLocale", locale: "de" },
      ]),
    );
    expect(() => runEdit(parseArgs(["edit", file, "--ops", ops]))).toThrow(
      /^Operation 2 \(setDefaultLocale\) was refused: invalid_operation — "de" is not a language version of this template\.$/,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it.each([[], ["--json"]])(
    "exits 2 with the block on stderr and nothing on stdout (%j)",
    (...flags) => {
      hiddenIn(2);
      const result = spawnSync(
        process.execPath,
        [
          resolve(import.meta.dirname, "../dist/bin.js"),
          ...setDefaultArgs(...flags.flat()),
        ],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(2);
      expect(result.stderr).toBe(
        `Operation 1 (setDefaultLocale) was refused: invalid_operation — ${HIDDEN_MESSAGES[1][1]} Block: "title_1".\n`,
      );
      expect(result.stdout).toBe("");
    },
  );
});
