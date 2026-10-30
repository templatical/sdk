import { describe, expect, it } from "vitest";
import * as liquidjs from "liquidjs";
import { createCustomBlockLiquid } from "../src/index";

function createEngine(): liquidjs.Liquid {
  return createCustomBlockLiquid(liquidjs);
}

describe("createCustomBlockLiquid", () => {
  it("uses the fixed block engine options", () => {
    const engine = createEngine();
    expect(engine.options.strictVariables).toBe(false);
    expect(engine.options.strictFilters).toBe(false);
    expect(engine.options.outputEscape).toBeTypeOf("function");
  });

  it.each([
    ["output", "{{ v }}", "&lt;script&gt;x&lt;/script&gt;"],
    ["echo", "{% echo v %}", "&lt;script&gt;x&lt;/script&gt;"],
    ["liquid echo", "{% liquid\necho v\n%}", "&lt;script&gt;x&lt;/script&gt;"],
    ["cycle", "{% cycle v %}", "&lt;script&gt;x&lt;/script&gt;"],
    ["raw output", "{{ v | raw }}", "<script>x</script>"],
    ["raw echo", "{% echo v | raw %}", "<script>x</script>"],
  ])("renders %s with exact HTML output", async (_name, template, expected) => {
    expect(await createEngine().parseAndRender(template, { v: "<script>x</script>" })).toBe(expected);
  });

  it("uses liquidjs's five-character escape set", async () => {
    expect(await createEngine().parseAndRender("{{ v }}", { v: '&<>"\'' })).toBe("&amp;&lt;&gt;&#34;&#39;");
  });

  it("preserves falsy cycle candidates exactly as stock liquidjs", async () => {
    const template = "{% cycle 0, 1 %}|{% cycle 0, 1 %}|{% cycle 0, 1 %}|{% cycle 0, 1 %};{% cycle false, 'x' %}|{% cycle false, 'x' %}|{% cycle false, 'x' %}";
    const stock = await new liquidjs.Liquid({ outputEscape: "escape", templates: {} }).parseAndRender(template);
    expect(stock).toBe("|1||1;|x|");
    expect(await createEngine().parseAndRender(template)).toBe(stock);
  });

  it("keeps named cycle groups rotating while escaping values", async () => {
    const template = "{% cycle 'g': a, b %}|{% cycle 'g': a, b %}|{% cycle 'g': a, b %}";
    expect(await createEngine().parseAndRender(template, { a: "<b>a</b>", b: "<i>b</i>" })).toBe("&lt;b&gt;a&lt;/b&gt;|&lt;i&gt;b&lt;/i&gt;|&lt;b&gt;a&lt;/b&gt;");
  });

  it("keeps liquidjs's explicit escape and capture semantics", async () => {
    const engine = createEngine();
    expect(await engine.parseAndRender("{{ v | escape }}", { v: "<b>" })).toBe("&amp;lt;b&amp;gt;");
    expect(await engine.parseAndRender("{% capture name %}{{ v }}{% endcapture %}{{ name }}", { v: "<b>" })).toBe("&amp;lt;b&amp;gt;");
    expect(await engine.parseAndRender("{% capture name %}{{ v }}{% endcapture %}{{ name | raw }}", { v: "<b>" })).toBe("&lt;b&gt;");
    expect(await engine.parseAndRender("{{ v | escape | newline_to_br | raw }}", { v: "a<b>\nc" })).toBe("a&lt;b&gt;<br />\nc");
  });

  it("refuses to load a partial outside the template", async () => {
    await expect(createEngine().parseAndRender("{% include 'header' %}")).rejects.toThrow(/header/);
  });
});
