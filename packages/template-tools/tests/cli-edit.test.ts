import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runEdit } from "../src/cli/commands/edit";
import { InvalidTemplateError, UsageError } from "../src/cli/io";

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
  it("applies a single operation and writes the file", () => {
    const op = JSON.stringify({
      operation: "update_block",
      data: { blockId: "button_1", updates: { text: "Shop now" } },
    });
    expect(runEdit(parseArgs(["edit", file, "--op", op]))).toBe(0);
    expect(read().blocks[1].text).toBe("Shop now");
  });

  it("applies a batch in order", () => {
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        { operation: "update_block", data: { blockId: "title_1", updates: { content: "One" } } },
        { operation: "update_block", data: { blockId: "title_1", updates: { content: "Two" } } },
      ]),
    );
    expect(runEdit(parseArgs(["edit", file, "--ops", ops]))).toBe(0);
    expect(read().blocks[0].content).toBe("Two");
  });

  it("leaves the file byte-identical when an operation mid-batch is rejected", () => {
    const before = readFileSync(file, "utf8");
    const ops = join(dir, "ops.json");
    writeFileSync(
      ops,
      JSON.stringify([
        { operation: "update_block", data: { blockId: "title_1", updates: { content: "One" } } },
        { operation: "update_block", data: { blockId: "does_not_exist", updates: { content: "x" } } },
        { operation: "update_block", data: { blockId: "button_1", updates: { text: "Three" } } },
      ]),
    );
    expect(() => runEdit(parseArgs(["edit", file, "--ops", ops]))).toThrow(
      /does_not_exist/,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses a section into a section column and writes nothing", () => {
    const withSection = {
      ...BASE,
      blocks: [
        ...BASE.blocks,
        { id: "sec_1", type: "section", columns: "1", children: [[]], styles: { padding: pad } },
      ],
    };
    writeFileSync(file, `${JSON.stringify(withSection, null, 2)}\n`, "utf8");
    const before = readFileSync(file, "utf8");
    const op = JSON.stringify({
      operation: "add_block",
      data: {
        targetSectionId: "sec_1",
        block: { id: "sec_2", type: "section", columns: "1", children: [[]], styles: { padding: pad } },
      },
    });
    expect(() => runEdit(parseArgs(["edit", file, "--op", op]))).toThrow(/MJML/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("writes nothing when the result fails structural validation", () => {
    const before = readFileSync(file, "utf8");
    const op = JSON.stringify({
      operation: "update_block",
      data: { blockId: "button_1", updates: { url: 42 } },
    });
    expect(() => runEdit(parseArgs(["edit", file, "--op", op]))).toThrow(
      InvalidTemplateError,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("reports the applied count under --json", () => {
    setJsonMode(true);
    const op = JSON.stringify({
      operation: "update_block",
      data: { blockId: "title_1", updates: { content: "X" } },
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
        { operation: "update_block", data: { blockId: "title_1", updates: { content: "Should not apply" } } },
      ]),
    );
    expect(() =>
      runEdit(parseArgs(["edit", file, "--op", "", "--ops", ops])),
    ).toThrow(/not both/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
