import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  applyOperations,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  resolveLocale,
  type Operation,
} from "../../../packages/types/src/index";
import { validateTemplate } from "../../../packages/template-tools/src/validate";

it("EN and DE operation examples are identical and each intermediate template validates", () => {
  const read = (rel: string) =>
    readFileSync(join(import.meta.dirname, "..", rel), "utf8");
  const extract = (src: string): Operation[] => {
    const body = src.match(/```json\n([\s\S]*?)```/)?.[1];
    expect(body?.includes("...")).toBe(false);
    return body!
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  };
  const en = extract(read("api/operations.md"));
  expect(extract(read("de/api/operations.md"))).toEqual(en);
  const localeRegion = read("api/operations.md").match(
    /<!-- locale-operations:start -->([\s\S]*?)<!-- locale-operations:end -->/,
  )?.[1];
  expect(localeRegion).toBeDefined();
  const localeOps = extract(localeRegion ?? "");
  expect([...en, ...localeOps].map((op) => op.op)).toEqual([
    "addBlock",
    "moveBlock",
    "deleteBlock",
    "updateBlock",
    "updateSettings",
    "setContent",
    "addLocale",
    "updateBlockLocale",
    "updateSettingsLocale",
    "removeLocale",
  ]);
  let content = createDefaultTemplateContent();
  content.settings.preheaderText = "Original preheader";
  content.blocks = [
    createParagraphBlock({
      id: "b1",
      content: "<p>Original</p>",
      visibility: { desktop: true, mobile: false },
    }),
    createSectionBlock({ id: "s1", columns: "1", children: [[]] }),
  ];
  expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  for (const op of en) {
    content = applyOperations(content, [op]);
    expect
      .soft(validateTemplate(content), op.op)
      .toEqual({ valid: true, errors: [] });
    switch (op.op) {
      case "addBlock":
        expect(content.blocks.map((b) => b.id)).toEqual(["b1", "b2", "s1"]);
        break;
      case "moveBlock":
        expect(content.blocks.map((b) => b.id)).toEqual(["b1", "s1"]);
        expect(content.blocks[1]).toMatchObject({
          children: [[{ id: "b2", content: "<p>Hi</p>" }]],
        });
        break;
      case "deleteBlock":
        expect(content.blocks[1]).toMatchObject({ children: [[]] });
        break;
      case "updateBlock":
        expect(content.blocks[0]).toMatchObject({ content: "<p>Hello</p>" });
        expect(content.blocks[0]).not.toHaveProperty("visibility");
        break;
      case "updateSettings":
        expect(content.settings.width).toBe(640);
        expect.soft(content.settings).not.toHaveProperty("preheaderText");
        break;
      case "setContent":
        expect(content).toEqual({
          blocks: [],
          settings: {
            width: 600,
            backgroundColor: "#ffffff",
            textColor: "#1a1a1a",
            linkUnderline: true,
            fontFamily: "Arial",
            locale: "en",
          },
        });
        break;
    }
  }
});

it("EN and DE locale examples are identical, validate, and remove every layer", () => {
  const read = (rel: string) =>
    readFileSync(join(import.meta.dirname, "..", rel), "utf8");
  const extract = (src: string): Operation[] => {
    const region = src.match(
      /<!-- locale-operations:start -->([\s\S]*?)<!-- locale-operations:end -->/,
    )?.[1];
    expect(region).toBeDefined();
    return region!
      .match(/```json\n([\s\S]*?)```/)![1]
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  };
  const ops = extract(read("api/operations.md"));
  expect(extract(read("de/api/operations.md"))).toEqual(ops);
  let content = createDefaultTemplateContent();
  content.settings.preheaderText = "Original preheader";
  content.blocks = [
    createParagraphBlock({ id: "b1", content: "<p>Original</p>" }),
  ];
  content.settings.direction = "ltr";
  const before = structuredClone(content);
  for (const op of ops) {
    content = applyOperations(content, [op]);
    expect
      .soft(validateTemplate(content), op.op)
      .toEqual({ valid: true, errors: [] });
    if (op.op === "addLocale") expect(content.settings.locales).toEqual(["de"]);
    if (op.op === "updateBlockLocale")
      expect(content.blocks[0].l10n).toEqual({
        de: {
          text: { content: { value: "<p>Hallo</p>", source: "f898b751" } },
          hidden: true,
        },
      });
    if (op.op === "updateSettingsLocale")
      expect(content.settings.l10n).toEqual({
        de: { set: { direction: "rtl" } },
      });
  }
  expect(content).toEqual(before);
});

it("EN and DE null/unset examples clear properties then restore default fallback", () => {
  const extract = (rel: string): Operation[] => {
    const source = readFileSync(join(import.meta.dirname, "..", rel), "utf8");
    const region = source.match(
      /<!-- locale-operations:start -->([\s\S]*?)<!-- locale-operations:end -->/,
    )![1];
    const examples = [...region.matchAll(/```json\n([\s\S]*?)```/g)];
    expect(examples).toHaveLength(2);
    return examples[1][1]
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  };
  const ops = extract("api/operations.md");
  expect(extract("de/api/operations.md")).toEqual(ops);
  expect(ops.map((op) => op.op)).toEqual([
    "updateBlockLocale",
    "updateSettingsLocale",
    "updateBlockLocale",
    "updateSettingsLocale",
  ]);
  let content = createDefaultTemplateContent();
  content.settings.locales = ["de"];
  content.settings.linkColor = "#1d4ed8";
  const block = createParagraphBlock({ id: "b1", content: "<p>Original</p>" });
  block.styles.backgroundColor = "#ffffff";
  content.blocks = [block];
  const before = structuredClone(content);
  const states = [
    { backgroundColor: undefined, linkColor: "#1d4ed8" },
    { backgroundColor: undefined, linkColor: undefined },
    { backgroundColor: "#ffffff", linkColor: undefined },
    { backgroundColor: "#ffffff", linkColor: "#1d4ed8" },
  ];
  for (const [index, op] of ops.entries()) {
    content = applyOperations(content, [op]);
    expect(validateTemplate(content), op.op).toEqual({
      valid: true,
      errors: [],
    });
    if (index === 0)
      expect(content.blocks[0].l10n?.de.set).toEqual({
        "styles.backgroundColor": null,
      });
    if (index === 1)
      expect(content.settings.l10n?.de.set).toEqual({ linkColor: null });
    const projected = resolveLocale(content, "de");
    const expected = states[index];
    if (expected.backgroundColor === undefined)
      expect(projected.blocks[0].styles).not.toHaveProperty("backgroundColor");
    else
      expect(projected.blocks[0].styles.backgroundColor).toBe(
        expected.backgroundColor,
      );
    if (expected.linkColor === undefined)
      expect(projected.settings).not.toHaveProperty("linkColor");
    else expect(projected.settings.linkColor).toBe(expected.linkColor);
    expect(content.blocks[0].styles.backgroundColor).toBe("#ffffff");
    expect(content.settings.linkColor).toBe("#1d4ed8");
  }
  expect(content).toEqual(before);
});
