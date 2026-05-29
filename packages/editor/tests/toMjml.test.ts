import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import type {
  CustomBlock,
  CustomBlockDefinition,
  TemplateContent,
} from "@templatical/types";

const definition: CustomBlockDefinition = {
  type: "event",
  name: "Event",
  template: "<div>{{ title }}</div>",
  fields: [{ key: "title", type: "text", label: "Title" }],
};

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

const renderToMjmlMock = vi.fn();

describe("toMjmlForInstance", () => {
  beforeEach(() => {
    renderToMjmlMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@templatical/renderer");
  });

  it("calls renderToMjml with the editor's content and wires renderCustomBlock", async () => {
    vi.doMock("@templatical/renderer", () => ({
      renderToMjml: renderToMjmlMock.mockResolvedValue("<mjml/>"),
    }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    const block = createCustomBlock(definition);
    const content = makeContent([block]);
    const renderCustomBlock = vi.fn(async () => "<p>x</p>");

    const result = await toMjmlForInstance({
      getContent: () => content,
      renderCustomBlock,
    });

    expect(result).toBe("<mjml/>");
    expect(renderToMjmlMock).toHaveBeenCalledTimes(1);
    expect(renderToMjmlMock).toHaveBeenCalledWith(content, {
      renderCustomBlock,
    });
  });

  it("propagates the renderer's resolved value verbatim", async () => {
    const expected = "<mjml><mj-body>...</mj-body></mjml>";
    vi.doMock("@templatical/renderer", () => ({
      renderToMjml: vi.fn().mockResolvedValue(expected),
    }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    const result = await toMjmlForInstance({
      getContent: () => makeContent([createParagraphBlock({ content: "hi" })]),
      renderCustomBlock: vi.fn(async () => ""),
    });

    expect(result).toBe(expected);
  });

  it("throws a clear error when @templatical/renderer is not installed", async () => {
    vi.doMock("@templatical/renderer", () => {
      throw new Error("Cannot find module '@templatical/renderer'");
    });

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    await expect(
      toMjmlForInstance({
        getContent: () => makeContent([]),
        renderCustomBlock: vi.fn(async () => ""),
      }),
    ).rejects.toThrow(
      /toMjml\(\) requires the @templatical\/renderer package/,
    );
  });

  it("error message names the missing package without referencing a specific package manager", async () => {
    vi.doMock("@templatical/renderer", () => {
      throw new Error("not found");
    });

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    await expect(
      toMjmlForInstance({
        getContent: () => makeContent([]),
        renderCustomBlock: vi.fn(async () => ""),
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining("@templatical/renderer"),
      }),
    );

    // Specifically must NOT mention any package manager — install command
    // depends on the consumer's setup (npm/pnpm/yarn/bun).
    const error = await toMjmlForInstance({
      getContent: () => makeContent([]),
      renderCustomBlock: vi.fn(async () => ""),
    }).catch((e: Error) => e);

    expect((error as Error).message).not.toMatch(/\b(npm|pnpm|yarn|bun)\b/i);
  });

  it("propagates errors thrown by the renderer", async () => {
    vi.doMock("@templatical/renderer", () => ({
      renderToMjml: vi
        .fn()
        .mockRejectedValue(new Error("renderer blew up")),
    }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    await expect(
      toMjmlForInstance({
        getContent: () => makeContent([]),
        renderCustomBlock: vi.fn(async () => ""),
      }),
    ).rejects.toThrow("renderer blew up");
  });

  it("invokes getContent and renderCustomBlock fresh on each call (no caching)", async () => {
    const renderToMjml = vi.fn().mockResolvedValue("<mjml/>");
    vi.doMock("@templatical/renderer", () => ({ renderToMjml }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    const getContent = vi.fn(() => makeContent([]));
    const renderCustomBlock = vi.fn(async () => "<p/>");

    const source = { getContent, renderCustomBlock };
    await toMjmlForInstance(source);
    await toMjmlForInstance(source);

    expect(getContent).toHaveBeenCalledTimes(2);
    expect(renderToMjml).toHaveBeenCalledTimes(2);
  });

  it("wires getCustomBlockStylesheet through to the renderer when the source provides it", async () => {
    const renderToMjml = vi.fn().mockResolvedValue("<mjml/>");
    vi.doMock("@templatical/renderer", () => ({ renderToMjml }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    const getCustomBlockStylesheet = vi.fn(
      (t: string) => (t === "event" ? ".tplc-event { color: red; }" : undefined),
    );
    const content = makeContent([createCustomBlock(definition)]);

    await toMjmlForInstance({
      getContent: () => content,
      renderCustomBlock: vi.fn(async () => ""),
      getCustomBlockStylesheet,
    });

    // The renderer received a stylesheet resolver and calling it with
    // "event" returns the source's CSS — proving the wiring is end-to-end,
    // not just a shape match.
    const optionsArg = renderToMjml.mock.calls[0][1];
    expect(typeof optionsArg.getCustomBlockStylesheet).toBe("function");
    expect(optionsArg.getCustomBlockStylesheet("event")).toBe(
      ".tplc-event { color: red; }",
    );
    expect(optionsArg.getCustomBlockStylesheet("unknown")).toBe(undefined);
  });

  it("omits getCustomBlockStylesheet from renderer options when the source doesn't provide one", async () => {
    const renderToMjml = vi.fn().mockResolvedValue("<mjml/>");
    vi.doMock("@templatical/renderer", () => ({ renderToMjml }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    await toMjmlForInstance({
      getContent: () => makeContent([]),
      renderCustomBlock: vi.fn(async () => ""),
      // No getCustomBlockStylesheet
    });

    const optionsArg = renderToMjml.mock.calls[0][1];
    expect(optionsArg).not.toHaveProperty("getCustomBlockStylesheet");
  });

  it("does not call renderCustomBlock itself — that's the renderer's job", async () => {
    const renderCustomBlock = vi.fn(async () => "<p/>");
    vi.doMock("@templatical/renderer", () => ({
      renderToMjml: vi.fn(async () => "<mjml/>"),
    }));

    const { toMjmlForInstance } = await import("../src/utils/toMjml");

    await toMjmlForInstance({
      getContent: () =>
        makeContent([createCustomBlock(definition) as CustomBlock]),
      renderCustomBlock,
    });

    // toMjmlForInstance just hands the callback to the renderer; it never
    // invokes it directly. The renderer drives the resolution.
    expect(renderCustomBlock).not.toHaveBeenCalled();
  });
});
