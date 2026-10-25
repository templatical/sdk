import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOperations,
  applyOperationsInPlace,
  getColumnCount,
  OperationError,
  type Block,
  type Operation,
  type OperationLock,
  type TemplateContent,
} from "../src";

const FIXTURES = join(import.meta.dirname, "fixtures/operations");

interface Fixture {
  name: string;
  content: TemplateContent;
  locks?: OperationLock[];
  session?: string;
  ops: Operation[];
  result:
    | { content: TemplateContent }
    | { error: { code: string; opIndex: number; blockId?: string } };
}

const files = readdirSync(FIXTURES)
  .filter((file) => file.endsWith(".json"))
  .sort();

/** What `scripts/fixtures-manifest.mjs` writes, recomputed here. */
function freshManifest(): string {
  return (
    files
      .map((file) => {
        const hash = createHash("sha256")
          .update(readFileSync(join(FIXTURES, file)))
          .digest("hex");
        return `${hash}  ${file}`;
      })
      .join("\n") + "\n"
  );
}

function load(file: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture;
}

describe("operation fixtures (shared with Templatical Cloud's PHP engine)", () => {
  it("has a manifest that matches every fixture byte for byte", () => {
    expect(readFileSync(join(FIXTURES, "MANIFEST.sha256"), "utf8")).toBe(
      freshManifest(),
    );
  });

  it("covers every operation and every error code", () => {
    const fixtures = files.map(load);
    const ops = new Set(fixtures.flatMap((f) => f.ops.map((op) => op.op)));
    const codes = new Set(
      fixtures.flatMap((f) =>
        "error" in f.result ? [f.result.error.code] : [],
      ),
    );
    for (const op of [
      "addBlock",
      "moveBlock",
      "deleteBlock",
      "updateBlock",
      "updateSettings",
      "setContent",
      "addLocale",
      "removeLocale",
      "updateBlockLocale",
      "updateSettingsLocale",
    ]) {
      expect(ops.has(op as Operation["op"]), op).toBe(true);
    }
    expect([...codes].sort()).toEqual([
      "anchor_missing",
      "block_exists",
      "block_missing",
      "invalid_operation",
      "lock_held",
      "locked_by_others",
      "precondition_failed",
    ]);
  });

  it("pins the check order with a case for each adjacent pair of steps", () => {
    expect(files.filter((file) => file.startsWith("order-"))).toEqual([
      "order-after-itself-before-container.json",
      "order-block-missing-before-column-range.json",
      "order-block-missing-before-lock.json",
      "order-container-before-anchor.json",
      "order-lock-before-precondition.json",
      "order-placement-before-container.json",
      "order-precondition-before-columns-change.json",
      "order-precondition-before-placement.json",
      "order-shape-before-block-exists.json",
      "order-shape-before-block-missing.json",
      "order-shape-before-locked-by-others.json",
      "order-unset-columns-before-lock.json",
    ]);
  });

  it.each(files)("%s", (file) => {
    const fixture = load(file);
    const before = JSON.stringify(fixture.content);
    const context = {
      locks: fixture.locks ?? [],
      session: fixture.session ?? null,
    };

    if ("content" in fixture.result) {
      expect(applyOperations(fixture.content, fixture.ops, context)).toEqual(
        fixture.result.content,
      );
    } else {
      let thrown: unknown = null;
      try {
        applyOperations(fixture.content, fixture.ops, context);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(OperationError);
      expect({
        code: (thrown as OperationError).code,
        opIndex: (thrown as OperationError).opIndex,
        ...("blockId" in fixture.result.error
          ? { blockId: (thrown as OperationError).blockId }
          : {}),
      }).toEqual(fixture.result.error);
    }
    // All or nothing, on success and failure alike: the input never changes.
    expect(JSON.stringify(fixture.content)).toBe(before);
  });
});

describe("applyOperationsInPlace", () => {
  it("changes the content it is given", () => {
    const content: TemplateContent = {
      blocks: [{ id: "d1", type: "divider" } as never],
      settings: { width: 600 } as never,
    };

    applyOperationsInPlace(content, [{ op: "deleteBlock", blockId: "d1" }]);

    expect(content.blocks).toEqual([]);
  });
});

describe("applyOperationsInPlace on a reactive proxy", () => {
  it("assigns set keys, so a proxy's set trap sees each change", () => {
    // A Vue reactive object has set and deleteProperty traps but no
    // defineProperty trap: a key written with Object.defineProperty changes
    // the target without telling the proxy, and the canvas never re-renders.
    const writes: string[] = [];
    const proxies = new WeakMap<object, object>();
    const watch = <T extends object>(target: T): T => {
      const known = proxies.get(target);
      if (known) return known as T;
      const proxy = new Proxy(target, {
        get(object, key, receiver) {
          const value: unknown = Reflect.get(object, key, receiver);
          return typeof value === "object" && value !== null
            ? watch(value)
            : value;
        },
        set(object, key, value, receiver) {
          writes.push(String(key));
          return Reflect.set(object, key, value, receiver);
        },
      });
      proxies.set(target, proxy);
      return proxy;
    };
    const content = watch({
      blocks: [
        { id: "t1", type: "title", content: "Hi" },
        {
          id: "s1",
          type: "section",
          columns: "2",
          children: [[{ id: "p1", type: "paragraph", content: "Left" }], []],
        },
      ],
      settings: { width: 600 },
    } as unknown as TemplateContent);

    applyOperationsInPlace(content, [
      { op: "updateBlock", blockId: "t1", set: { content: "Hello" } },
      { op: "updateBlock", blockId: "p1", set: { content: "Right" } },
      { op: "updateSettings", set: { width: 640 } },
      { op: "updateBlock", blockId: "s1", set: { columns: "1" } },
    ]);

    expect(writes).toEqual([
      "content",
      "content",
      "width",
      "children",
      "columns",
    ]);
  });
});

describe("applyOperations", () => {
  it("keeps a __proto__ key an ordinary key", () => {
    const content = {
      blocks: [{ id: "t1", type: "title" }],
      settings: {},
    } as unknown as TemplateContent;
    const ops = JSON.parse(
      '[{"op":"updateBlock","blockId":"t1","set":{"__proto__":{"polluted":true}}}]',
    ) as Operation[];

    const result = applyOperations(content, ops);
    const block = result.blocks[0] as unknown as Record<string, unknown>;

    expect(Object.keys(block)).toEqual(["id", "type", "__proto__"]);
    expect(Object.getPrototypeOf(block)).toBe(Object.prototype);
    expect((block as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("drops a set key that holds undefined, as JSON would", () => {
    const content = {
      blocks: [{ id: "t1", type: "title", content: "Hi" }],
      settings: {},
    } as unknown as TemplateContent;

    expect(() =>
      applyOperations(content, [
        { op: "updateBlock", blockId: "t1", set: { content: undefined } },
      ]),
    ).toThrow("Set or unset at least one key.");
  });
});

describe("OperationError", () => {
  it("names the block a lock refusal is about", () => {
    const content = {
      blocks: [{ id: "t1", type: "title" }],
      settings: {},
    } as unknown as TemplateContent;
    let thrown: OperationError | null = null;
    try {
      applyOperations(
        content,
        [{ op: "updateBlock", blockId: "t1", set: { content: "x" } }],
        { locks: [{ blockId: "t1", sessionId: "other" }], session: "me" },
      );
    } catch (error) {
      thrown = error as OperationError;
    }
    expect(thrown?.name).toBe("OperationError");
    expect(thrown?.code).toBe("lock_held");
    expect(thrown?.opIndex).toBe(0);
    expect(thrown?.blockId).toBe("t1");
  });
});

describe("getColumnCount", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["2-1", 2],
    ["1-2", 2],
    ["4", 2],
    [1, 2],
  ])("%s has %i columns", (layout, count) => {
    expect(getColumnCount(layout)).toBe(count);
  });
});

describe("locale operation validation and ordering", () => {
  const base = (): TemplateContent =>
    ({
      blocks: [
        { id: "t1", type: "title", content: "Hi", styles: { padding: 0 } },
      ],
      settings: {
        width: 600,
        locale: "en",
        locales: ["de"],
        preheaderText: "Hello",
        direction: "ltr",
      },
    }) as unknown as TemplateContent;
  const code = (op: unknown, content = base(), context = {}) => {
    try {
      applyOperations(content, [op as Operation], context);
      return null;
    } catch (error) {
      return (error as OperationError).code;
    }
  };

  it("rejects default and existing languages case-insensitively and invalid insertion positions", () => {
    for (const locale of ["EN", "DE", "x-private", "i-klingon", "en US"]) {
      expect(code({ op: "addLocale", locale })).toBe("invalid_operation");
    }
    for (const position of [-1, 2, 0.5, null]) {
      expect(code({ op: "addLocale", locale: "fr", position })).toBe(
        "invalid_operation",
      );
    }
    const before = base();
    delete before.settings.locales;
    expect(
      applyOperations(before, [{ op: "addLocale", locale: "de", position: 0 }])
        .settings.locales,
    ).toEqual(["de"]);
  });

  it("checks locale update shape before missing blocks and locks before expectations", () => {
    const locks = [{ blockId: "t1", sessionId: "other", locale: "de" }];
    expect(
      code({
        op: "updateBlockLocale",
        blockId: "zz",
        locale: "de",
        hidden: "yes",
      }),
    ).toBe("invalid_operation");
    expect(
      code({
        op: "updateBlockLocale",
        blockId: "zz",
        locale: "de",
        hidden: true,
      }),
    ).toBe("block_missing");
    expect(
      code(
        {
          op: "updateBlockLocale",
          blockId: "t1",
          locale: "de",
          hidden: true,
          expect: { hidden: true },
        },
        base(),
        { locks },
      ),
    ).toBe("lock_held");
    expect(
      code({
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        text: { content: { value: "Hallo" } },
      }),
    ).toBe("invalid_operation");
  });

  it("applies unset, text, set and hidden in order, pruning empty layers", () => {
    const result = applyOperations(base(), [
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        unset: ["content"],
        text: { content: { value: "Hallo", source: "67eb44ba" } },
        set: { content: "Override" },
        hidden: false,
      },
    ]);
    expect(result.blocks[0].l10n).toEqual({
      de: { set: { content: "Override" } },
    });
    expect(
      applyOperations(result, [
        {
          op: "updateBlockLocale",
          blockId: "t1",
          locale: "de",
          unset: ["content"],
        },
      ]),
    ).toEqual(base());
  });

  it("allows an optional property only when its object parent resolves", () => {
    expect(
      applyOperations(base(), [
        {
          op: "updateBlockLocale",
          blockId: "t1",
          locale: "de",
          set: { "styles.color": "red" },
        },
      ]).blocks[0].l10n,
    ).toEqual({ de: { set: { "styles.color": "red" } } });
    expect(
      code({
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        set: { "missing.color": "red" },
      }),
    ).toBe("invalid_operation");
    const before = base();
    before.blocks = [
      {
        id: "m1",
        type: "menu",
        items: [{ id: "i.1", text: "Shop", url: "https://example.com" }],
      } as Block,
    ];
    for (const change of [
      { text: { "items.i.1.text": { value: "Laden", source: "28742cc9" } } },
      { set: { "items.i.1.url": "https://example.com/de" } },
      { set: { "items.missing": {} } },
    ]) {
      expect(
        code(
          { op: "updateBlockLocale", blockId: "m1", locale: "de", ...change },
          before,
        ),
      ).toBe("invalid_operation");
    }
  });

  it("ignores locks for language membership and settings but respects own-session block locks", () => {
    const context = {
      locks: [{ blockId: "t1", sessionId: "A", locale: null }],
      session: "A",
    };
    expect(
      applyOperations(
        base(),
        [
          {
            op: "updateBlockLocale",
            blockId: "t1",
            locale: "de",
            hidden: true,
          },
        ],
        context,
      ).blocks[0].l10n,
    ).toEqual({ de: { hidden: true } });
    expect(
      applyOperations(
        base(),
        [
          { op: "removeLocale", locale: "de", expect: { blocks: {} } },
          { op: "addLocale", locale: "fr" },
          {
            op: "updateSettingsLocale",
            locale: "fr",
            set: { direction: "rtl" },
          },
        ],
        { ...context, session: "B" },
      ).settings.l10n,
    ).toEqual({ fr: { set: { direction: "rtl" } } });
  });

  it("guards and prunes settings layers, and prevents changing the fixed default", () => {
    const before = applyOperations(base(), [
      {
        op: "updateSettingsLocale",
        locale: "de",
        set: { preheaderText: "Override" },
      },
    ]);
    const translated = { value: "Hallo", source: "f55c314b" };
    const after = applyOperations(before, [
      {
        op: "updateSettingsLocale",
        locale: "de",
        text: { preheaderText: translated },
        expect: {
          set: { preheaderText: "Override" },
          text: { preheaderText: null },
        },
      },
    ]);
    expect(after.settings.l10n).toEqual({
      de: { text: { preheaderText: translated } },
    });
    expect(
      code(
        {
          op: "updateSettingsLocale",
          locale: "de",
          unset: ["preheaderText"],
          expect: { text: { preheaderText: null } },
        },
        after,
      ),
    ).toBe("precondition_failed");
    expect(
      applyOperations(after, [
        { op: "updateSettingsLocale", locale: "de", unset: ["preheaderText"] },
      ]),
    ).toEqual(base());
    for (const op of [
      { op: "updateSettings", unset: ["locale"] },
      { op: "updateSettings", unset: ["l10n"] },
      { op: "updateBlock", blockId: "t1", unset: ["l10n"] },
    ])
      expect(code(op)).toBe("invalid_operation");
    const single = base();
    delete single.settings.locales;
    expect(
      applyOperations(single, [{ op: "updateSettings", set: { locale: "fr" } }])
        .settings.locale,
    ).toBe("fr");
  });

  it("matches all removeLocale layers exactly and preserves other languages", () => {
    const before = base();
    before.settings.locales = ["de", "fr"];
    before.blocks[0].l10n = { de: { hidden: true }, fr: { hidden: true } };
    before.settings.l10n = {
      de: { set: { direction: "rtl" } },
      fr: { set: { direction: "ltr" } },
    };
    expect(
      code(
        {
          op: "removeLocale",
          locale: "de",
          expect: { blocks: { t1: { hidden: true } } },
        },
        before,
      ),
    ).toBe("precondition_failed");
    const result = applyOperations(before, [
      {
        op: "removeLocale",
        locale: "de",
        expect: {
          blocks: { t1: { hidden: true } },
          settings: { set: { direction: "rtl" } },
        },
      },
    ]);
    expect(result.settings.locales).toEqual(["fr"]);
    expect(result.blocks[0].l10n).toEqual({ fr: { hidden: true } });
    expect(result.settings.l10n).toEqual({ fr: { set: { direction: "ltr" } } });
  });
});

describe("removeLocale guards for a block named settings", () => {
  const before = {
    blocks: [
      {
        id: "settings",
        type: "title",
        content: "Hi",
        l10n: { de: { hidden: true } },
      },
    ],
    settings: {
      width: 600,
      locale: "en",
      locales: ["de"],
      l10n: { de: { set: { direction: "rtl" } } },
    },
  } as unknown as TemplateContent;

  it("compares block and settings layers independently before removing either", () => {
    const remove = (expect: unknown) =>
      applyOperations(before, [
        { op: "removeLocale", locale: "de", expect } as Operation,
      ]);
    expect(() =>
      remove({ blocks: { settings: { hidden: true } } }),
    ).toThrowError(
      expect.objectContaining({ code: "precondition_failed", opIndex: 0 }),
    );
    expect(() =>
      remove({ blocks: {}, settings: { set: { direction: "rtl" } } }),
    ).toThrowError(
      expect.objectContaining({ code: "precondition_failed", opIndex: 0 }),
    );
    expect(
      remove({
        blocks: { settings: { hidden: true } },
        settings: { set: { direction: "rtl" } },
      }),
    ).toEqual({
      blocks: [{ id: "settings", type: "title", content: "Hi" }],
      settings: { width: 600, locale: "en" },
    });
  });
});

describe("locale unset path safety", () => {
  it("rejects an unsafe path before resolving a missing block", () => {
    const before = {
      blocks: [],
      settings: { width: 600, locale: "en", locales: ["de"] },
    } as unknown as TemplateContent;
    expect(() =>
      applyOperations(before, [
        {
          op: "updateBlockLocale",
          blockId: "missing",
          locale: "de",
          unset: ["styles..color"],
        },
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_operation", opIndex: 0 }),
    );
  });

  it("still unsets safe orphan paths from block and settings layers", () => {
    const before = {
      blocks: [
        {
          id: "t1",
          type: "title",
          content: "Hi",
          l10n: { de: { set: { "deleted.color": "red" } } },
        },
      ],
      settings: {
        width: 600,
        locale: "en",
        locales: ["de"],
        l10n: { de: { set: { "deleted.color": "blue" } } },
      },
    } as unknown as TemplateContent;
    const result = applyOperations(before, [
      {
        op: "updateBlockLocale",
        blockId: "t1",
        locale: "de",
        unset: ["deleted.color"],
      },
      { op: "updateSettingsLocale", locale: "de", unset: ["deleted.color"] },
    ]);
    expect(result).toEqual({
      blocks: [{ id: "t1", type: "title", content: "Hi" }],
      settings: { width: 600, locale: "en", locales: ["de"] },
    });
  });
});
