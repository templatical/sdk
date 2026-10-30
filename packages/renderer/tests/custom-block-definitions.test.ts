import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  type CustomBlockDefinition,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";

function definition(
  type: string,
  template: string,
  stylesheet?: string,
): CustomBlockDefinition {
  return {
    type,
    name: type,
    template,
    fields: [{ key: "value", type: "text", label: "Value" }],
    stylesheet,
  };
}

function content(
  def: CustomBlockDefinition,
  values: string[],
): TemplateContent {
  const result = createDefaultTemplateContent();
  result.blocks = values.map((value) => {
    const block = createCustomBlock(def);
    block.fieldValues.value = value;
    return block;
  });
  return result;
}

afterEach(() => vi.doUnmock("liquidjs"));

describe("renderToMjml customBlocks definitions", () => {
  it("escapes field values in output and echo tags", async () => {
    const def = definition("card", "<p>{{ value }} {% echo value %}</p>");
    const mjml = await renderToMjml(content(def, ["<script>x</script>"]), {
      customBlocks: [def],
    });
    expect(mjml).toContain(
      "<p>&lt;script&gt;x&lt;/script&gt; &lt;script&gt;x&lt;/script&gt;</p>",
    );
  });

  it("passes HTML through a final raw filter", async () => {
    const def = definition("card", "<p>{{ value | raw }}</p>");
    const mjml = await renderToMjml(content(def, ["<b>x</b>"]), {
      customBlocks: [def],
    });
    expect(mjml).toContain("<p><b>x</b></p>");
  });

  it("emits a definition stylesheet once for two instances", async () => {
    const css = ".card { color: red; }";
    const def = definition("card", "<p>{{ value }}</p>", css);
    const mjml = await renderToMjml(content(def, ["a", "b"]), {
      customBlocks: [def],
    });
    expect(mjml.match(/\.card \{ color: red; \}/g)).toHaveLength(1);
  });

  it("uses the last definition for a duplicate type", async () => {
    const first = definition("card", "<p>first</p>", ".first {}");
    const last = definition("card", "<p>last</p>", ".last {}");
    const mjml = await renderToMjml(content(first, ["x"]), {
      customBlocks: [first, last],
    });
    expect(mjml).toContain("<p>last</p>");
    expect(mjml).toContain(".last {}");
    expect(mjml).not.toContain("<p>first</p>");
    expect(mjml).not.toContain(".first {}");
  });

  it("falls back to copied HTML and CSS for an unknown type", async () => {
    const unknown = definition("unknown", "<p>unused</p>");
    const saved = content(unknown, ["x"]);
    const block = saved.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom block");
    block.renderedHtml = "<p>saved</p>";
    block.renderedStylesheet = ".saved { color: blue; }";
    const mjml = await renderToMjml(saved, { customBlocks: [] });
    expect(mjml).toContain("<p>saved</p>");
    expect(mjml).toContain(".saved { color: blue; }");
  });

  it("emits no saved CSS when the listed definition has no stylesheet", async () => {
    const def = definition("card", "<p>fresh</p>");
    const saved = content(def, ["x"]);
    const block = saved.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom block");
    block.renderedStylesheet = ".saved { color: blue; }";
    const mjml = await renderToMjml(saved, { customBlocks: [def] });
    expect(mjml).not.toContain(".saved { color: blue; }");
  });

  it.each([
    ["renderCustomBlock", "[Templatical] customBlocks cannot be combined with renderCustomBlock"],
    ["getCustomBlockStylesheet", "[Templatical] customBlocks cannot be combined with getCustomBlockStylesheet"],
  ] as const)("rejects customBlocks with %s", async (name, message) => {
    const options = name === "renderCustomBlock"
      ? { customBlocks: [], renderCustomBlock: async () => "" }
      : { customBlocks: [], getCustomBlockStylesheet: () => "" };
    await expect(renderToMjml(createDefaultTemplateContent(), options)).rejects.toThrowError(TypeError);
    await expect(renderToMjml(createDefaultTemplateContent(), options)).rejects.toMatchObject({ message });
  });

  it("propagates a Liquid template error like a rejected callback", async () => {
    const def = definition("card", "{% include 'missing' %}");
    await expect(renderToMjml(content(def, ["x"]), { customBlocks: [def] })).rejects.toThrow(/missing/);
  });

  it("does not import liquidjs without custom blocks, but reports a missing peer when needed", async () => {
    vi.doMock("liquidjs", () => {
      throw new Error("Cannot find module 'liquidjs'");
    });
    await expect(renderToMjml(createDefaultTemplateContent(), { customBlocks: [] })).resolves.toContain("<mjml");
    const def = definition("card", "<p>{{ value }}</p>");
    await expect(renderToMjml(content(def, ["x"]), { customBlocks: [def] })).rejects.toThrowError(
      "[Templatical] customBlocks requires the optional liquidjs package.",
    );
  });
});
