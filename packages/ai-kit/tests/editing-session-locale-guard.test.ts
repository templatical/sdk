import { resolveLocale, sourceHash } from "@templatical/types";
import { describe, expect, it } from "vitest";
import { createEditingSession } from "../src/server";
import { expectLinear } from "./helpers/expectLinear";

const mergeTags = { syntax: "liquid" as const, tags: [] };
const content = () => ({
  blocks: [{ id: "p1", type: "paragraph", content: "<p>Hello</p>" }],
  settings: { width: 600, locale: "en", locales: ["en", "de"] },
});

function expectRefusal(start: unknown, ops: unknown, feedback: string): void {
  const session = createEditingSession({ content: start as never, mergeTags });
  expect(session.apply(ops)).toEqual({ ok: false, feedback });
  expect(session.content).toEqual(start);
  expect(session.batches).toEqual([]);
}

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

  it("refuses a type promotion even when the old default locale is removed", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: "<p>Hello</p>",
          l10n: { de: { set: { type: "title" } } },
        },
      ],
    };
    expectRefusal(
      start,
      [
        { op: "setDefaultLocale", locale: "de" },
        { op: "removeLocale", locale: "en" },
      ],
      "Refused: you can't change a block's type",
    );
  });

  it("refuses a German custom child with another customType when custom blocks are allowed", () => {
    const session = createEditingSession({
      content: content() as never,
      mergeTags,
      limits: { forbiddenBlockTypes: [] },
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [
              [{ id: "c1", type: "custom", customType: "qr", fieldValues: {} }],
            ],
            l10n: {
              de: {
                set: {
                  children: [
                    [
                      {
                        id: "c1",
                        type: "custom",
                        customType: "barcode",
                        fieldValues: {},
                      },
                    ],
                  ],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ]),
    ).toEqual({
      ok: false,
      feedback: "Refused: you can't change a block's customType",
    });
    expect(session.content).toEqual(content());
    expect(session.batches).toEqual([]);
  });

  it("refuses a custom schema promotion when custom blocks are allowed", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "c1",
          type: "custom",
          customType: "qr",
          fieldValues: {},
          l10n: { de: { set: { customType: "barcode" } } },
        },
      ],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
      limits: { forbiddenBlockTypes: [] },
    });

    expect(
      session.apply([
        { op: "setDefaultLocale", locale: "de" },
        { op: "removeLocale", locale: "en" },
      ]),
    ).toEqual({
      ok: false,
      feedback: "Refused: you can't change a block's customType",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("accepts replacing a bad layer before promoting its locale", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: "<p>Hello</p>",
          l10n: { de: { set: { type: "title" } } },
        },
      ],
    };
    const replacement = {
      ...content(),
      blocks: [{ id: "p1", type: "title", content: "<h1>Hello</h1>" }],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        { op: "setContent", content: replacement },
        { op: "setDefaultLocale", locale: "de" },
        { op: "removeLocale", locale: "en" },
      ]).ok,
    ).toBe(true);
    expect(session.content.blocks).toEqual(replacement.blocks);
    expect(session.content.settings.locale).toBe("de");
    expect(session.batches).toHaveLength(1);
  });

  it("accepts deleting a block and adding a new one of a different type", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: "<p>Hello</p>",
          l10n: { de: { set: { type: "title" } } },
        },
      ],
    };
    const title = { id: "p1", type: "title", content: "<h1>Hello</h1>" };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        { op: "deleteBlock", blockId: "p1" },
        { op: "addBlock", block: title, parent: null, after: null },
        { op: "setDefaultLocale", locale: "de" },
        { op: "removeLocale", locale: "en" },
      ]).ok,
    ).toBe(true);
    expect(session.content.blocks).toEqual([title]);
    expect(session.content.settings.locale).toBe("de");
    expect(session.batches).toHaveLength(1);
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

  it("refuses a section whose German children introduce a custom block", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [[]],
            l10n: {
              de: {
                set: {
                  children: [[{ id: "c1", type: "custom", customType: "qr" }]],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (addBlock s1) was refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("refuses German children that give a base block's id another type", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [[{ id: "x1", type: "paragraph", content: "<p>Hi</p>" }]],
            l10n: {
              de: {
                set: {
                  children: [
                    [{ id: "x1", type: "title", content: "<p>Hallo</p>" }],
                  ],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (addBlock s1) was refused: you can't change a block's type",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);

    const translated = session.apply([
      {
        op: "addBlock",
        block: {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[{ id: "x1", type: "paragraph", content: "<p>Hi</p>" }]],
          l10n: {
            de: {
              set: {
                children: [
                  [{ id: "x1", type: "paragraph", content: "<p>Hallo</p>" }],
                ],
              },
            },
          },
        },
        parent: null,
        after: "p1",
      },
    ]);
    expect(translated.ok).toBe(true);
    expect(
      resolveLocale(session.content as never, "de").blocks[1],
    ).toMatchObject({
      id: "s1",
      children: [[{ id: "x1", type: "paragraph", content: "<p>Hallo</p>" }]],
    });
  });

  it("accepts a German title child with an id the base doesn't use", () => {
    const session = createEditingSession({
      content: content() as never,
      mergeTags,
    });
    const result = session.apply([
      {
        op: "addBlock",
        block: {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[{ id: "x1", type: "paragraph", content: "<p>Hi</p>" }]],
          l10n: {
            de: {
              set: {
                children: [
                  [{ id: "x1-de", type: "title", content: "<p>Hallo</p>" }],
                ],
              },
            },
          },
        },
        parent: null,
        after: "p1",
      },
    ]);
    expect(result.ok).toBe(true);
    expect(
      resolveLocale(session.content as never, "de").blocks[1],
    ).toMatchObject({
      id: "s1",
      children: [[{ id: "x1-de", type: "title", content: "<p>Hallo</p>" }]],
    });
  });

  it("refuses German children that give another existing block's id another type", () => {
    expectRefusal(
      content(),
      [
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [[]],
            l10n: {
              de: {
                set: {
                  children: [
                    [{ id: "p1", type: "title", content: "<p>Hallo</p>" }],
                  ],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ],
      "Refused: op 0 (addBlock s1) was refused: you can't change a block's type",
    );
  });

  it("refuses a batch while an existing German layer gives a child another type", () => {
    const start = {
      ...content(),
      blocks: [
        ...content().blocks,
        {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[{ id: "x1", type: "paragraph", content: "<p>Hi</p>" }]],
          l10n: {
            de: {
              set: {
                children: [
                  [{ id: "x1", type: "title", content: "<p>Hallo</p>" }],
                ],
              },
            },
          },
        },
      ],
    };
    expectRefusal(
      start,
      [{ op: "updateBlock", blockId: "p1", set: { content: "<p>Hey</p>" } }],
      "Refused: you can't change a block's type",
    );
  });

  it("accepts a batch that deletes the block holding a bad German layer", () => {
    const bad = {
      id: "s1",
      type: "section",
      columns: "1",
      children: [[{ id: "x1", type: "paragraph", content: "<p>Hi</p>" }]],
      l10n: {
        de: {
          set: {
            children: [[{ id: "x1", type: "title", content: "<p>Hallo</p>" }]],
          },
        },
      },
    };
    const session = createEditingSession({
      content: { ...content(), blocks: [...content().blocks, bad] } as never,
      mergeTags,
    });
    expect(session.apply([{ op: "deleteBlock", blockId: "s1" }]).ok).toBe(true);
    expect(session.content).toEqual(content());
  });

  it("refuses localized custom children supplied through setContent", () => {
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
                id: "s1",
                type: "section",
                columns: "1",
                children: [[]],
                l10n: {
                  de: {
                    set: {
                      children: [
                        [{ id: "c1", type: "custom", customType: "qr" }],
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (setContent) was refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("refuses a localized custom schema change on an existing block", () => {
    const start = {
      ...content(),
      blocks: [{ id: "c1", type: "custom", customType: "qr", fieldValues: {} }],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "updateBlockLocale",
          blockId: "c1",
          locale: "de",
          set: { customType: "barcode" },
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: op 0 (updateBlockLocale) was refused: you can't change a block's customType",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("refuses a batch when an existing German layer resolves to a custom child", () => {
    const start = {
      ...content(),
      blocks: [
        {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[]],
          l10n: {
            de: {
              set: {
                children: [[{ id: "c1", type: "custom", customType: "qr" }]],
              },
            },
          },
        },
      ],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([{ op: "updateSettings", set: { width: 640 } }]),
    ).toEqual({
      ok: false,
      feedback: "Refused: you can't add custom, slot or wrapper blocks",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("checks an undeclared locale when a former base custom block survives only there", () => {
    const start = {
      blocks: [
        { id: "c1", type: "custom", customType: "qr" },
        { id: "s1", type: "section", columns: "1", children: [[]] },
      ],
      settings: { width: 600, locale: "en", locales: [] },
    };
    const replacement = {
      blocks: [
        {
          id: "s1",
          type: "section",
          columns: "1",
          children: [[]],
          l10n: {
            de: {
              set: {
                children: [[{ id: "c1", type: "custom", customType: "qr" }]],
              },
            },
          },
        },
      ],
      settings: start.settings,
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(session.apply([{ op: "setContent", content: replacement }])).toEqual(
      {
        ok: false,
        feedback: "Refused: you can't add custom, slot or wrapper blocks",
      },
    );
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it.each([
    ["a string", "de"],
    ["a number", 5],
    ["a list holding a number", ["de", 5]],
  ])(
    "refuses settings.locales set to %s without throwing",
    (_label, locales) => {
      const start = content();
      expectRefusal(
        start,
        [
          {
            op: "setContent",
            content: { ...start, settings: { ...start.settings, locales } },
          },
        ],
        "Refused: the template's settings.locales must be a list of locale tags",
      );
    },
  );

  it("checks the size limit before resolving each locale", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
      limits: { forbiddenBlockTypes: [], maxContentBytes: 200 },
    });
    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [
              [{ id: "c1", type: "custom", customType: "qr", fieldValues: {} }],
            ],
            l10n: {
              de: {
                set: {
                  children: [
                    [
                      {
                        id: "c1",
                        type: "custom",
                        customType: "barcode",
                        fieldValues: {},
                      },
                    ],
                  ],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ]),
    ).toEqual({
      ok: false,
      feedback:
        "Refused: the template would be larger than 200 bytes. Change less at once.",
    });
    expect(session.content).toEqual(start);
  });

  it("checks a child's layer under a container whose layer keeps its children", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
      limits: { forbiddenBlockTypes: [] },
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "w1",
            type: "wrapper",
            l10n: { de: {} },
            children: [
              {
                id: "s1",
                type: "section",
                columns: "1",
                children: [
                  [
                    {
                      id: "c1",
                      type: "custom",
                      customType: "qr",
                      fieldValues: {},
                    },
                  ],
                ],
                l10n: {
                  de: {
                    set: {
                      children: [
                        [
                          {
                            id: "c1",
                            type: "custom",
                            customType: "barcode",
                            fieldValues: {},
                          },
                        ],
                      ],
                    },
                  },
                },
              },
            ],
          },
          parent: null,
          after: "p1",
        },
      ]),
    ).toEqual({
      ok: false,
      feedback: "Refused: you can't change a block's customType",
    });
    expect(session.content).toEqual(start);
  });

  describe("a wrapper whose German layer replaces its children", () => {
    const badSection = (id: string) => ({
      id,
      type: "section",
      columns: "1",
      children: [
        [{ id: `${id}-c`, type: "custom", customType: "qr", fieldValues: {} }],
      ],
      l10n: {
        de: {
          set: {
            children: [
              [
                {
                  id: `${id}-c`,
                  type: "custom",
                  customType: "barcode",
                  fieldValues: {},
                },
              ],
            ],
          },
        },
      },
    });
    const addWrapper = (base: unknown[], replacement: unknown[]) => {
      const session = createEditingSession({
        content: content() as never,
        mergeTags,
        limits: { forbiddenBlockTypes: [] },
      });
      return {
        session,
        result: session.apply([
          {
            op: "addBlock",
            block: {
              id: "w1",
              type: "wrapper",
              children: base,
              l10n: { de: { set: { children: replacement } } },
            },
            parent: null,
            after: "p1",
          },
        ]),
      };
    };

    it("doesn't check a base child the German view never shows", () => {
      const { result } = addWrapper(
        [badSection("s1")],
        [{ id: "p9", type: "paragraph", content: "<p>Hallo</p>" }],
      );
      expect(result.ok).toBe(true);
    });

    it("checks the replacement children's own German layers", () => {
      const { session, result } = addWrapper(
        [
          {
            id: "s1",
            type: "section",
            columns: "1",
            children: [
              [{ id: "c1", type: "custom", customType: "qr", fieldValues: {} }],
            ],
          },
        ],
        [
          {
            id: "s2",
            type: "section",
            columns: "1",
            children: [[]],
            l10n: {
              de: {
                set: {
                  children: [
                    [
                      {
                        id: "c1",
                        type: "custom",
                        customType: "barcode",
                        fieldValues: {},
                      },
                    ],
                  ],
                },
              },
            },
          },
        ],
      );
      expect(result).toEqual({
        ok: false,
        feedback: "Refused: you can't change a block's customType",
      });
      expect(session.content).toEqual(content());
    });
  });

  it("checks every locale in time linear in the template size", () => {
    expectLinear((n) => {
      const locales = Array.from({ length: n }, (_, i) => `x${i}`);
      const session = createEditingSession({
        content: {
          blocks: [
            {
              id: "s1",
              type: "section",
              columns: "1",
              children: [
                Array.from({ length: n }, (_, i) => ({
                  id: `p${i}`,
                  type: "paragraph",
                  content: "<p>Hello</p>",
                })),
              ],
              l10n: Object.fromEntries(locales.map((locale) => [locale, {}])),
            },
          ],
          settings: { width: 600, locale: "en", locales },
        } as never,
        mergeTags,
        limits: { maxContentBytes: 100_000_000 },
      });
      return () => {
        const result = session.apply([
          { op: "updateSettings", set: { width: 640 } },
        ]);
        if (!result.ok) throw new Error(result.feedback);
      };
    }, 50);
  }, 30_000);

  it("refuses a malformed locale layer without throwing", () => {
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
                l10n: { de: { set: null } },
              },
            ],
          },
        },
      ]),
    ).toEqual({
      ok: false,
      feedback: "Refused: the template has an invalid locale layer",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it.each([
    { field: "set", value: null },
    { field: "set", value: [] },
    { field: "set", value: "invalid" },
    { field: "text", value: null },
    { field: "text", value: [] },
    { field: "text", value: "invalid" },
  ])(
    "refuses a default locale layer with malformed $field ($value)",
    ({ field, value }) => {
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
              settings: { ...start.settings, l10n: { en: { [field]: value } } },
            },
          },
        ] as never),
      ).toEqual({
        ok: false,
        feedback: "Refused: the template has an invalid locale layer",
      });
      expect(session.content).toEqual(start);
      expect(session.batches).toEqual([]);

      expect(session.apply([{ op: "setDefaultLocale", locale: "de" }]).ok).toBe(
        true,
      );
    },
  );

  it("refuses setDefaultLocale when a preexisting default locale layer has null set", () => {
    const start = content();
    const malformed = {
      ...start,
      settings: { ...start.settings, l10n: { en: { set: null } } },
    };
    const session = createEditingSession({
      content: malformed as never,
      mergeTags,
    });

    expect(session.apply([{ op: "setDefaultLocale", locale: "de" }])).toEqual({
      ok: false,
      feedback: "Refused: the template has an invalid locale layer",
    });
    expect(session.content).toEqual(malformed);
    expect(session.batches).toEqual([]);
  });

  it("refuses a null translated text entry in the default locale", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "p2",
            type: "paragraph",
            content: "<p>Second</p>",
            l10n: { en: { text: { content: null } } },
          },
          parent: null,
          after: "p1",
        },
      ] as never),
    ).toEqual({
      ok: false,
      feedback: "Refused: the template has an invalid locale layer",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it("refuses malformed locale layers in an added block before updating it", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        {
          op: "addBlock",
          block: {
            id: "p2",
            type: "paragraph",
            content: "<p>Second</p>",
            l10n: { de: null },
          },
          parent: null,
          after: "p1",
        },
        {
          op: "updateBlock",
          blockId: "p2",
          set: { content: "<p>Updated</p>" },
        },
      ] as never),
    ).toEqual({
      ok: false,
      feedback: "Refused: the template has an invalid locale layer",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it.each([{ children: null }, { children: [null] }])(
    "refuses a malformed localized section structure before promotion ($children)",
    ({ children }) => {
      const start = content();
      const session = createEditingSession({
        content: start as never,
        mergeTags,
      });

      expect(
        session.apply([
          {
            op: "addBlock",
            block: {
              id: "s1",
              type: "section",
              columns: "1",
              children: [[]],
              l10n: { de: { set: { children } } },
            },
            parent: null,
            after: "p1",
          },
          { op: "setDefaultLocale", locale: "de" },
        ] as never),
      ).toEqual({
        ok: false,
        feedback: "Refused: the template has an invalid locale layer",
      });
      expect(session.content).toEqual(start);
      expect(session.batches).toEqual([]);
    },
  );

  it("applies a section with translated German text", () => {
    const start = content();
    const translated = {
      id: "s1",
      type: "section",
      columns: "1",
      children: [
        [
          {
            id: "p2",
            type: "paragraph",
            content: "<p>Welcome</p>",
            l10n: {
              de: {
                text: {
                  content: {
                    value: "<p>Willkommen</p>",
                    sourceHash: sourceHash("<p>Welcome</p>"),
                  },
                },
              },
            },
          },
        ],
      ],
    };
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });

    expect(
      session.apply([
        { op: "addBlock", block: translated, parent: null, after: "p1" },
      ]).ok,
    ).toBe(true);
    expect(session.content).toEqual({
      ...start,
      blocks: [...start.blocks, translated],
    });
    expect(resolveLocale(session.content, "de")).toEqual({
      blocks: [
        start.blocks[0],
        {
          id: "s1",
          type: "section",
          columns: "1",
          children: [
            [{ id: "p2", type: "paragraph", content: "<p>Willkommen</p>" }],
          ],
        },
      ],
      settings: { width: 600, locale: "de" },
    });
    expect(session.batches).toHaveLength(1);
  });

  it("refuses a block whose locale layer is not an object", () => {
    const start = content();
    const session = createEditingSession({
      content: start as never,
      mergeTags,
    });
    const result = session.apply([
      {
        op: "addBlock",
        block: {
          id: "p2",
          type: "paragraph",
          content: "<p>Second</p>",
          l10n: { de: null },
        },
        parent: null,
        after: "p1",
      },
    ] as never);
    expect(result).toEqual({
      ok: false,
      feedback: "Refused: the template has an invalid locale layer",
    });
    expect(session.content).toEqual(start);
    expect(session.batches).toEqual([]);
  });

  it.each([
    { name: "null", layer: null },
    { name: "string", layer: "invalid" },
    { name: "array", layer: [] },
  ])(
    "refuses a settings locale layer that is not an object ($name)",
    ({ layer }) => {
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
              settings: { ...start.settings, l10n: { de: layer } },
            },
          },
        ] as never),
      ).toEqual({
        ok: false,
        feedback: "Refused: the template has an invalid locale layer",
      });
      expect(session.content).toEqual(start);
      expect(session.batches).toEqual([]);
    },
  );

  it.each([
    { name: "null map", l10n: null },
    { name: "array map", l10n: [] },
    { name: "string map", l10n: "invalid" },
    {
      name: "missing text value",
      l10n: { de: { text: { preheaderText: { sourceHash: "hash" } } } },
    },
    {
      name: "non-string text value",
      l10n: {
        de: { text: { preheaderText: { value: 42, sourceHash: "hash" } } },
      },
    },
    {
      name: "missing source hash",
      l10n: { de: { text: { preheaderText: { value: "Hallo" } } } },
    },
    {
      name: "non-string source hash",
      l10n: {
        de: { text: { preheaderText: { value: "Hallo", sourceHash: 42 } } },
      },
    },
    { name: "false hidden flag", l10n: { de: { hidden: false } } },
  ])("refuses settings with $name", ({ l10n }) => {
    const start = content();
    expectRefusal(
      start,
      [
        {
          op: "setContent",
          content: { ...start, settings: { ...start.settings, l10n } },
        },
      ],
      "Refused: the template has an invalid locale layer",
    );
  });

  it.each([
    { name: "null map", l10n: null },
    { name: "array map", l10n: [] },
    { name: "string map", l10n: "invalid" },
    { name: "array layer", l10n: { de: [] } },
    { name: "string layer", l10n: { de: "invalid" } },
    { name: "array set", l10n: { de: { set: [] } } },
    { name: "string text", l10n: { de: { text: "invalid" } } },
    {
      name: "non-string text value",
      l10n: { de: { text: { content: { value: 42, sourceHash: "hash" } } } },
    },
    {
      name: "non-string source hash",
      l10n: { de: { text: { content: { value: "Hallo", sourceHash: 42 } } } },
    },
    { name: "false hidden flag", l10n: { de: { hidden: false } } },
  ])("refuses an added block with $name", ({ l10n }) => {
    const start = content();
    expectRefusal(
      start,
      [
        {
          op: "addBlock",
          block: {
            id: "p2",
            type: "paragraph",
            content: "<p>Second</p>",
            l10n,
          },
          parent: null,
          after: "p1",
        },
      ],
      "Refused: the template has an invalid locale layer",
    );
  });

  it.each([
    {
      name: "non-object child",
      children: [[null, { id: "c1", type: "custom", customType: "qr" }]],
    },
    {
      name: "nested section without columns",
      children: [[{ id: "s2", type: "section", children: null }]],
    },
    {
      name: "nested wrapper without children",
      children: [[{ id: "w1", type: "wrapper", children: null }]],
    },
    {
      name: "non-object wrapper child",
      children: [[{ id: "w1", type: "wrapper", children: [null] }]],
    },
    {
      name: "wrapper containing a malformed section",
      children: [
        [
          {
            id: "w1",
            type: "wrapper",
            children: [{ id: "s2", type: "section", children: [[null]] }],
          },
        ],
      ],
    },
  ])("refuses localized section children with a $name", ({ children }) => {
    const start = content();
    expectRefusal(
      start,
      [
        {
          op: "addBlock",
          block: {
            id: "s1",
            type: "section",
            columns: "1",
            children: [[]],
            l10n: { de: { set: { children } } },
          },
          parent: null,
          after: "p1",
        },
      ],
      "Refused: the template has an invalid locale layer",
    );
  });

  it("refuses a malformed locale layer inside a non-container override", () => {
    const start = content();
    expectRefusal(
      start,
      [
        {
          op: "addBlock",
          block: {
            id: "p2",
            type: "paragraph",
            content: "<p>Second</p>",
            l10n: {
              de: {
                set: {
                  children: [
                    { id: "p3", type: "paragraph", l10n: { fr: null } },
                  ],
                },
              },
            },
          },
          parent: null,
          after: "p1",
        },
      ],
      "Refused: the template has an invalid locale layer",
    );
  });

  it("refuses a translated customType override on an existing block", () => {
    const start = {
      ...content(),
      blocks: [{ id: "c1", type: "custom", customType: "qr", fieldValues: {} }],
    };
    expectRefusal(
      start,
      [
        {
          op: "updateBlockLocale",
          blockId: "c1",
          locale: "de",
          text: {
            customType: { value: "barcode", sourceHash: sourceHash("qr") },
          },
        },
      ],
      "Refused: op 0 (updateBlockLocale) was refused: you can't change a block's customType",
    );
  });

  it("refuses content that locale resolution cannot project", () => {
    const start = { ...content(), blocks: [null] };
    expectRefusal(
      start,
      [{ op: "updateSettings", set: { width: 640 } }],
      "Refused: the template has an invalid locale layer",
    );
  });

  it("refuses an updateBlockLocale that changes an existing block's type", () => {
    for (const layer of [
      { set: { type: "title" } },
      {
        text: {
          type: { value: "title", sourceHash: sourceHash("paragraph") },
        },
      },
    ]) {
      const start = content();
      const session = createEditingSession({
        content: start as never,
        mergeTags,
      });
      expect(
        session.apply([
          { op: "updateBlockLocale", blockId: "p1", locale: "de", ...layer },
        ] as never),
      ).toEqual({
        ok: false,
        feedback:
          "Refused: op 0 (updateBlockLocale) was refused: you can't change a block's type",
      });
      expect(session.content).toEqual(start);
      expect(session.batches).toEqual([]);
    }
  });
});
