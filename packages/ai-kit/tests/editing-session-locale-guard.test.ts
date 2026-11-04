import { sourceHash } from "@templatical/types";
import { describe, expect, it } from "vitest";
import { createEditingSession } from "../src/server";

const mergeTags = { syntax: "liquid" as const, tags: [] };
const content = () => ({
  blocks: [{ id: "p1", type: "paragraph", content: "<p>Hello</p>" }],
  settings: { width: 600, locale: "en", locales: ["en", "de"] },
});

describe("editing session locale type guard", () => {
  it("refuses the first step of type promotion and accepts translated text", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    for (const layer of [
      { set: { type: "custom" } },
      { set: { type: "title" } },
      {
        text: {
          type: { value: "custom", sourceHash: sourceHash("paragraph") },
        },
      },
    ]) {
      expect(
        session.apply([
          {
            op: "addBlock",
            block: {
              id: "p2",
              type: "paragraph",
              content: "<p>Second</p>",
              l10n: { de: layer },
            },
            parent: null,
            after: "p1",
          },
        ]),
      ).toEqual({
        ok: false,
        feedback:
          "Refused: op 0 (addBlock p2) was refused: you can't change a block's type",
      });
      expect(session.content).toEqual(start);
      expect(session.batches).toEqual([]);
    }

    const translated = {
      id: "p2",
      type: "paragraph",
      content: "<p>Second</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Zweite</p>",
              sourceHash: sourceHash("<p>Second</p>"),
            },
          },
        },
      },
    };
    expect(
      session.apply([
        { op: "addBlock", block: translated, parent: null, after: "p1" },
      ]),
    ).toMatchObject({ ok: true, feedback: "Applied." });
    expect(session.content).toEqual({
      ...start,
      blocks: [...start.blocks, translated],
    });
    expect(session.batches).toHaveLength(1);
  });

  it("refuses a batch that promotes a preexisting forbidden locale type", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: "<p>Hello</p>",
          l10n: { de: { set: { type: "custom" } } },
        },
      ],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        { op: "updateSettings", set: { width: 640 } },
        { op: "setDefaultLocale", locale: "de" },
      ]),
    ).toEqual({
      ok: false,
      feedback: "Refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("refuses a locale type override supplied through setContent", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "setContent",
          content: {
            ...start,
            blocks: [
              ...start.blocks,
              {
                id: "p2",
                type: "paragraph",
                content: "<p>Second</p>",
                l10n: { de: { set: { type: "custom" } } },
              },
            ],
          },
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (setContent) was refused: you can't change a block's type",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });
});
