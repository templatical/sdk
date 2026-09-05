import { describe, expect, it } from "vitest";
import { renderConfig } from "../src/config/render";

describe("renderConfig", () => {
  it("prints scalars and literal false", () => {
    const out = renderConfig({ locale: "en", savedBlocks: { update: false } });
    expect(out).toContain('locale: "en"');
    expect(out).toContain("update: false");
  });

  it("prints a function's own source, not a placeholder", () => {
    const list = async () => [];
    const out = renderConfig({ savedBlocks: { list } });
    expect(out).toContain("async () =>");
    expect(out).not.toContain("[Function");
  });

  /**
   * The load-bearing guarantee: the panel is not a description of the config,
   * it IS the config. Parsing the render back must reproduce the same shape.
   * A snapshot would only prove the output is stable, not that it is true.
   */
  it("round-trips: the rendered source parses back to the same shape", () => {
    const config = {
      locale: "de",
      autoSave: { debounce: 2000 },
      savedBlocks: { create: false, update: false },
    };
    const parsed = JSON.parse(
      renderConfig(config).replace(/(\w+):/g, '"$1":').replace(/'/g, '"'),
    );
    expect(parsed).toEqual(config);
  });

  /**
   * `createLocalStorageSavedBlocksProvider` (packages/core/src/saved-blocks-local.ts)
   * defines its members as method shorthand — `async list(params) { … }` — not
   * arrows. `Function.prototype.toString()` returns that source verbatim, so a
   * naive `key + ": " + source` doubles the name: `list: async list(params){…}`,
   * which is not a valid object member and cannot parse.
   */
  it("prints a method-shorthand function without doubling its name", () => {
    const provider = {
      async list(params: unknown) {
        return params;
      },
    };
    const out = renderConfig({ savedBlocks: { list: provider.list } });
    expect(out).not.toContain("list: async list(");
  });

  /**
   * A genuine parse check, not just a substring probe: construct the printed
   * source as a real function body. `new Function` throws a SyntaxError at
   * construction time if the body doesn't parse — exactly the failure mode
   * the substring check above can miss if the doubling takes a shape that
   * substring omits.
   */
  it("emits a method-shorthand function as parseable source", () => {
    const provider = {
      async list(params: unknown) {
        return params;
      },
    };
    const out = renderConfig({ list: provider.list });
    const result = new Function("return (" + out + ")")() as {
      list: (...args: unknown[]) => unknown;
    };
    expect(typeof result.list).toBe("function");
  });

  it("emits a non-async method-shorthand function as parseable source", () => {
    const provider = {
      create(input: unknown) {
        return input;
      },
    };
    const out = renderConfig({ create: provider.create });
    const result = new Function("return (" + out + ")")() as {
      create: (...args: unknown[]) => unknown;
    };
    expect(typeof result.create).toBe("function");
  });

  it("emits a generator method-shorthand function as parseable source", () => {
    const provider = {
      *list() {
        yield 1;
      },
    };
    const out = renderConfig({ list: provider.list });
    const result = new Function("return (" + out + ")")() as {
      list: () => Generator<number>;
    };
    expect(typeof result.list).toBe("function");
  });

  /**
   * The key must match the function's own name exactly, not merely share a
   * prefix with it — in either direction. Emitting either of these as bare
   * shorthand (dropping the `key: ` prefix) would silently lose the key.
   */
  it("keeps the key prefix when the key is not the function's own name", () => {
    const impl = {
      async list() {
        return [];
      },
    };
    const out = renderConfig({ listDelay: impl.list });
    expect(out).toContain("listDelay: async list(");
  });

  it("keeps the key prefix when the function's name only shares a prefix with the key", () => {
    const impl = {
      async listDelay() {
        return 0;
      },
    };
    const out = renderConfig({ list: impl.listDelay });
    expect(out).toContain("list: async listDelay(");
  });

  /**
   * An arrow assigned to a same-named key must keep its `key: ` prefix — arrow
   * source never takes method-shorthand form, so this is a negative control
   * for the shorthand detection rather than a case it needs to special-case.
   */
  it("keeps the key prefix for an arrow function even when it shares the key's name", () => {
    const out = renderConfig({ list: async () => [] });
    expect(out).toContain("list: async () =>");
  });

  it("prints an empty array", () => {
    expect(renderConfig({ recipients: [] })).toBe("{\n  recipients: []\n}");
  });

  it("prints a non-empty array of strings", () => {
    const out = renderConfig({ allowedRecipients: ["a@x.com", "b@x.com"] });
    expect(out).toBe(
      '{\n  allowedRecipients: [\n    "a@x.com",\n    "b@x.com"\n  ]\n}',
    );
  });

  it("prints a nested array inside an object", () => {
    const out = renderConfig({ testEmail: { allowedRecipients: ["a@x.com"] } });
    expect(out).toBe(
      '{\n  testEmail: {\n    allowedRecipients: [\n      "a@x.com"\n    ]\n  }\n}',
    );
  });

  it("prints an empty object", () => {
    expect(renderConfig({ savedBlocks: {} })).toBe(
      "{\n  savedBlocks: {}\n}",
    );
  });
});

describe("values TypeScript source cannot carry", () => {
  it("annotates a DOM element rather than printing an empty object", () => {
    const out = renderConfig({ container: document.createElement("div") });
    expect(out).toContain("container: /* HTMLDivElement */");
    expect(out).not.toContain("container: {}");
  });

  it("prints undefined as itself, not as an empty object", () => {
    expect(renderConfig({ onRequestMedia: undefined })).toContain(
      "onRequestMedia: undefined",
    );
  });

  it("still renders a plain object normally", () => {
    expect(renderConfig({ savedBlocks: { update: false } })).toContain(
      "update: false",
    );
  });
});
