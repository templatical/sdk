import { readFileSync } from "node:fs";
import { join } from "node:path";
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
