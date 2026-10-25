import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * `api/types.md` (and the German mirror) must list every field on the
 * published `@templatical/types` surfaces an agent copies from: template
 * settings, merge tags, social platforms, block types. A new source field
 * that the page omits is the drift this fails on.
 */

const DOCS = join(import.meta.dirname, "..");
const TYPES = join(DOCS, "../../packages/types/src");

function readDocs(rel: string): string {
  return readFileSync(join(DOCS, rel), "utf8");
}

function readTypes(rel: string): string {
  return readFileSync(join(TYPES, rel), "utf8");
}

function braceBody(src: string, header: RegExp): string {
  const match = header.exec(src);
  if (!match) throw new Error(`no match for ${header}`);
  const open = src.indexOf("{", match.index);
  if (open < 0) throw new Error(`no body for ${header}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed body for ${header}`);
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function interfaceFields(src: string, name: string): string[] {
  const body = braceBody(
    stripComments(src),
    new RegExp(`(?:export )?interface ${name}\\s*\\{`),
  );
  return [...body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/gm)].map(
    (m) => m[1],
  );
}

function stringUnionMembers(src: string, name: string): string[] {
  const header = new RegExp(`(?:export )?type ${name}\\s*=`);
  const match = header.exec(src);
  if (!match) throw new Error(`no union ${name}`);
  const from = match.index + match[0].length;
  const end = src.indexOf(";", from);
  if (end < 0) throw new Error(`no terminator for ${name}`);
  return [...src.slice(from, end).matchAll(/["']([a-z0-9-]+)["']/g)].map(
    (m) => m[1],
  );
}

function blockTypeLiterals(blocksSrc: string): string[] {
  return [
    ...blocksSrc.matchAll(
      /export interface \w+ extends BaseBlock \{\n  type: "([^"]+)"/g,
    ),
  ].map((m) => m[1]);
}

describe("api/types.md stays aligned with @templatical/types", () => {
  const en = readDocs("api/types.md");
  const de = readDocs("de/api/types.md");
  const templateSrc = readTypes("template.ts");
  const configSrc = readTypes("config.ts");
  const blocksSrc = readTypes("blocks.ts");

  it.each([
    ["TemplateSettings", templateSrc],
    ["MergeTag", configSrc],
    ["MergeTagRequestContext", configSrc],
    ["MergeTagsConfig", configSrc],
  ] as const)("%s fields match source", (name, src) => {
    const expected = interfaceFields(src, name).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(interfaceFields(en, name).sort()).toEqual(expected);
    expect(interfaceFields(de, name).sort()).toEqual(expected);
  });

  it("SocialPlatform members match source", () => {
    const expected = stringUnionMembers(blocksSrc, "SocialPlatform").sort();
    expect(expected).toContain("website");
    expect(stringUnionMembers(en, "SocialPlatform").sort()).toEqual(expected);
    expect(stringUnionMembers(de, "SocialPlatform").sort()).toEqual(expected);
  });

  it("BlockType literals match every BaseBlock discriminant", () => {
    const expected = blockTypeLiterals(blocksSrc).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(stringUnionMembers(en, "BlockType").sort()).toEqual(expected);
    expect(stringUnionMembers(de, "BlockType").sort()).toEqual(expected);
  });
});

describe("block interface fields, optionality and types", () => {
  function fields(src: string, name: string): string[] {
    const body = braceBody(
      stripComments(src),
      new RegExp(`interface ${name} extends BaseBlock\\s*\\{`),
    );
    return body
      .split(";")
      .map((field) => field.replaceAll("'", '\"').replace(/\s+/g, ""))
      .filter(Boolean)
      .sort();
  }

  it.each(["TitleBlock", "ParagraphBlock", "SectionBlock"])(
    "%s matches source in EN and DE",
    (name) => {
      const expected = fields(readTypes("blocks.ts"), name);
      expect(expected.length).toBeGreaterThan(2);
      for (const rel of ["api/types.md", "de/api/types.md"]) {
        expect.soft(fields(readDocs(rel), name), rel).toEqual(expected);
      }
    },
  );
});


describe("public AI and collaboration declarations", () => {
  it("adapter-options.ts retains the adapters' exact option and client types", () => {
    const declarations = (text: string) => {
      const file = ts.createSourceFile("options.ts", text, ts.ScriptTarget.Latest, true);
      return new Map(file.statements.flatMap((node) =>
        ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
          ? [[node.name.text, stripComments(node.getText(file)).replace(/\s/g, "")]]
          : [],
      ));
    };
    const documented = declarations(readDocs("snippets/adapter-options.ts"));
    const sources = [
      ["anthropic", ["StreamParams", "AnthropicAdapterClient", "AnthropicAdapterOptions"]],
      ["openai", ["CreateParams", "OpenAiAdapterClient", "OpenAiAdapterOptions"]],
      ["vercel", ["StreamTextParams", "VercelAdapterOptions"]],
    ] as const;
    expect([...documented.keys()]).toEqual(sources.flatMap(([, names]) => [...names]));
    for (const [adapter, names] of sources) {
      const maintained = declarations(readFileSync(
        join(DOCS, `../../packages/ai-kit/src/adapters/${adapter}.ts`), "utf8",
      ));
      for (const name of names) {
        expect(documented.get(name), name).toBe(maintained.get(name));
      }
    }
    for (const page of ["api/ai-kit.md", "de/api/ai-kit.md"]) {
      expect(readDocs(page)).toContain("<<< @/snippets/adapter-options.ts");
    }
  });

  it("model-contract.ts retains the kit's exact model contract", () => {
    const declarations = (text: string) => {
      const file = ts.createSourceFile("contract.ts", text, ts.ScriptTarget.Latest, true);
      return new Map(file.statements.flatMap((node) =>
        ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
          ? [[node.name.text, stripComments(node.getText(file)).replace(/\s/g, "")]]
          : [],
      ));
    };
    const maintained = declarations(
      readFileSync(join(DOCS, "../../packages/ai-kit/src/server/model.ts"), "utf8"),
    );
    const documented = declarations(readFileSync(join(DOCS, "snippets/model-contract.ts"), "utf8"));
    expect([...documented.keys()]).toEqual([...maintained.keys()]);
    for (const [name, declaration] of documented) {
      expect(declaration, name).toBe(maintained.get(name));
    }
    for (const page of ["api/ai-kit.md", "de/api/ai-kit.md"]) {
      expect(readDocs(page)).toContain("<<< @/snippets/model-contract.ts");
    }
  });

  it.each([
    ["ai.ts", "ai-contract.ts"],
    ["collaboration.ts", "collaboration-contract.ts"],
  ])("%s declarations retain their exact public types", (source, snippet) => {
    expect(existsSync(join(DOCS, "snippets", snippet)), snippet).toBe(true);
    const docs = readFileSync(join(DOCS, "snippets", snippet), "utf8");
    const declarations = (text: string) => {
      const file = ts.createSourceFile("contract.ts", text, ts.ScriptTarget.Latest, true);
      return new Map(file.statements.flatMap((node) =>
        ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
          ? [[node.name.text, stripComments(node.getText(file)).replace(/\s/g, "")]]
          : [],
      ));
    };
    const maintained = declarations(readTypes(source));
    const documented = declarations(docs);
    expect(documented.size).toBeGreaterThan(10);
    expect([...documented.keys()]).toEqual([...maintained.keys()]);
    for (const [name, declaration] of documented) {
      expect(declaration, name).toBe(maintained.get(name));
    }
    for (const page of source === "ai.ts"
      ? ["api/ai-kit.md", "de/api/ai-kit.md", "backend/ai.md", "de/backend/ai.md"]
      : ["backend/collaboration.md", "de/backend/collaboration.md"]) {
      expect(readDocs(page)).toContain(`<<< @/snippets/${snippet}`);
    }
  });
});
