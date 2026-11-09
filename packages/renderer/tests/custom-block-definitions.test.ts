import { describe, expect, it } from "vitest";
import * as liquidjs from "liquidjs";
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

describe("renderToMjml customBlocks definitions", () => {
  it("escapes field values in output and echo tags", async () => {
    const def = definition("card", "<p>{{ value }} {% echo value %}</p>");
    const mjml = await renderToMjml(content(def, ["<script>x</script>"]), {
      customBlocks: [def],
      liquidjs,
    });
    expect(mjml).toContain(
      "<p>&lt;script&gt;x&lt;/script&gt; &lt;script&gt;x&lt;/script&gt;</p>",
    );
  });

  it("passes HTML through a final raw filter", async () => {
    const def = definition("card", "<p>{{ value | raw }}</p>");
    const mjml = await renderToMjml(content(def, ["<b>x</b>"]), {
      customBlocks: [def],
      liquidjs,
    });
    expect(mjml).toContain("<p><b>x</b></p>");
  });

  it("emits a definition stylesheet once for two instances", async () => {
    const css = ".card { color: red; }";
    const def = definition("card", "<p>{{ value }}</p>", css);
    const mjml = await renderToMjml(content(def, ["a", "b"]), {
      customBlocks: [def],
      liquidjs,
    });
    expect(mjml.match(/\.card \{ color: red; \}/g)).toHaveLength(1);
  });

  it("uses the last definition for a duplicate type", async () => {
    const first = definition("card", "<p>first</p>", ".first {}");
    const last = definition("card", "<p>last</p>", ".last {}");
    const mjml = await renderToMjml(content(first, ["x"]), {
      customBlocks: [first, last],
      liquidjs,
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
    const mjml = await renderToMjml(saved, { customBlocks: [], liquidjs });
    expect(mjml).toContain("<p>saved</p>");
    expect(mjml).toContain(".saved { color: blue; }");
  });

  it("emits no saved CSS when the listed definition has no stylesheet", async () => {
    const def = definition("card", "<p>fresh</p>");
    const saved = content(def, ["x"]);
    const block = saved.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom block");
    block.renderedStylesheet = ".saved { color: blue; }";
    const mjml = await renderToMjml(saved, { customBlocks: [def], liquidjs });
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
    await expect(renderToMjml(content(def, ["x"]), { customBlocks: [def], liquidjs })).rejects.toThrow(/missing/);
  });

  it("rejects a custom block whose Liquid range exceeds the memory budget", async () => {
    const huge = definition("card", "{% for i in (1..100000000) %}{{ i }}{% endfor %}");
    await expect(renderToMjml(content(huge, ["x"]), { customBlocks: [huge], liquidjs })).rejects.toMatchObject({ message: "memory alloc limit exceeded, line:1, col:1" });
  });

  it("needs no liquidjs module when the content holds no custom block", async () => {
    const mjml = await renderToMjml(createDefaultTemplateContent(), { customBlocks: [] });
    expect(mjml).toContain("<mj-body");
  });

  it.each([
    ["omitted", undefined],
    ["not a liquidjs module", {} as never],
  ] as const)("rejects a custom block when liquidjs is %s", async (_name, module) => {
    const def = definition("card", "<p>{{ value }}</p>");
    const render = () => renderToMjml(content(def, ["x"]), { customBlocks: [def], liquidjs: module });
    await expect(render()).rejects.toThrowError(TypeError);
    await expect(render()).rejects.toMatchObject({
      message: '[Templatical] customBlocks requires the liquidjs option: import * as liquidjs from "liquidjs" and pass { customBlocks, liquidjs }.',
    });
  });

  it("ignores liquidjs without customBlocks", async () => {
    const def = definition("card", "<p>{{ value }}</p>");
    const saved = content(def, ["x"]);
    const block = saved.blocks[0];
    if (block.type !== "custom") throw new Error("expected custom block");
    block.renderedHtml = "<p>saved</p>";
    const mjml = await renderToMjml(saved, { liquidjs });
    expect(mjml).toContain("<p>saved</p>");
  });
});
