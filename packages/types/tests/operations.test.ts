import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOperations,
  applyOperationsInPlace,
  getColumnCount,
  OperationError,
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
    { content: TemplateContent } | { error: { code: string; opIndex: number } };
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
