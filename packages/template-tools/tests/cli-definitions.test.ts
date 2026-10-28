import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  sourceHash,
  type CustomBlockDefinition,
} from "@templatical/types";

let dir: string;
let file: string;
let definitions: string;
const bin = resolve(import.meta.dirname, "../dist/bin.js");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
const write = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value));
const defs: CustomBlockDefinition[] = ["welcome", "footer"].map((type) => ({
  type,
  name: type,
  fields: [
    { key: "heading", label: "Heading", type: "text", default: "Welcome" },
  ],
  template: `<p class="${type}">{{ heading }}</p>`,
  stylesheet: `.${type} { color: ${type === "welcome" ? "#123456" : "#654321"}; }`,
}));

beforeEach(() => {
  dir = mkdtempSync(join(import.meta.dirname, ".definitions-"));
  file = join(dir, "template.json");
  definitions = join(dir, "definitions.json");
  write(definitions, defs);
  const content = createDefaultTemplateContent();
  content.settings.locales = ["de"];
  content.blocks = defs.map((def) => ({
    ...createCustomBlock(def),
    id: def.type,
    renderedHtml: "Cached Welcome",
    l10n: {
      de: {
        text: {
          "fieldValues.heading": {
            value: `Willkommen ${def.type}`,
            sourceHash: sourceHash("Welcome"),
          },
        },
      },
    },
  }));
  write(file, content);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("CLI definitions", () => {
  it("preserves cached HTML and CSS for a type absent from partial definitions", () => {
    const content = JSON.parse(readFileSync(file, "utf8"));
    delete content.blocks[1].l10n;
    content.blocks[1].renderedHtml =
      '<p class="cached-footer">Cached footer</p>';
    content.blocks[1].renderedStylesheet = ".cached-footer { color: #abcdef; }";
    write(file, content);
    write(definitions, [defs[0]]);
    const result = run(
      "render",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--json",
    );
    expect(result.status, result.stderr).toBe(0);
    const { output } = JSON.parse(result.stdout);
    expect(output).toContain("Willkommen welcome");
    expect(output).toContain(content.blocks[1].renderedHtml);
    expect(output).toContain(content.blocks[1].renderedStylesheet);
  });
  it("validates custom text translations and lints their coverage with definitions, refusing them without", () => {
    const result = run(
      "validate",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--json",
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      valid: true,
      errors: [],
    });
    expect(
      JSON.parse(result.stdout).issues.filter((i: { ruleId: string }) =>
        i.ruleId.startsWith("localization."),
      ),
    ).toEqual([]);
    const without = run("validate", file, "--locale", "de", "--json");
    expect(without.status).toBe(1);
    expect(JSON.parse(without.stdout).errors.join(" ")).toContain(
      "not translatable",
    );
  });
  it("renders two custom types in German with both definition stylesheets", () => {
    const result = run(
      "render",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--json",
    );
    expect(result.status, result.stderr).toBe(0);
    const { output } = JSON.parse(result.stdout);
    for (const def of defs) {
      expect(output).toContain(`Willkommen ${def.type}`);
      expect(output).toContain(def.stylesheet);
    }
    expect(output).not.toContain("Cached Welcome");
  });
  it("uses the same localized custom render options for validate --html", () => {
    const { status, stderr } = run(
      "render",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--out",
      join(dir, "expected.mjml"),
    );
    expect(status, stderr).toBe(0);
    const expected = readFileSync(join(dir, "expected.mjml"), "utf8");
    // The real compiler's output verifies the HTML size path against render too.
    const rendered = run(
      "render",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--format",
      "html",
      "--json",
      "--cwd",
      resolve(import.meta.dirname, ".."),
    );
    expect(rendered.status, rendered.stderr).toBe(0);
    const html = JSON.parse(rendered.stdout).output;
    expect(html).toContain("Willkommen welcome");
    expect(html).toContain("Willkommen footer");
    expect(html).toContain("#123456");
    expect(html).toContain("#654321");
    expect(expected).toContain("#123456");
    const result = run(
      "validate",
      file,
      "--html",
      "--locale",
      "de",
      "--definitions",
      definitions,
      "--json",
      "--cwd",
      resolve(import.meta.dirname, ".."),
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).htmlBytes).toBe(Buffer.byteLength(html));
  });
  it("supports definitions in strings export and import", () => {
    const result = run(
      "strings",
      "export",
      file,
      "--locale",
      "de",
      "--only",
      "all",
      "--definitions",
      definitions,
    );
    expect(result.status, result.stderr).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.strings.map((s: { id: string }) => s.id)).toEqual([
      "welcome/fieldValues.heading",
      "footer/fieldValues.heading",
    ]);
    data.strings[0].text = "Guten Tag";
    const strings = join(dir, "strings.json");
    write(strings, data);
    const applied = run(
      "strings",
      "import",
      file,
      strings,
      "--definitions",
      definitions,
      "--json",
    );
    expect(applied.status, applied.stderr).toBe(0);
    expect(JSON.parse(applied.stdout).applied).toBe(2);
    expect(
      JSON.parse(readFileSync(file, "utf8")).blocks[0].l10n.de.text[
        "fieldValues.heading"
      ].value,
    ).toBe("Guten Tag");
  });
  it.each(
    [null, {}, [null], [{ type: "broken" }]].map((data, index) => ({
      data,
      index,
    })),
  )("rejects invalid definitions file $index for every command", ({ data }) => {
    write(definitions, data);
    for (const args of [
      ["validate", file],
      ["render", file],
      ["strings", "export", file, "--locale", "de"],
    ]) {
      const result = run(...args, "--definitions", definitions, "--json");
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("--definitions");
      expect(result.stdout).toBe("");
    }
  });
});
