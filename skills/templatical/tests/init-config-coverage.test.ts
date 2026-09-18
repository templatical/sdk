import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A new `TemplaticalEditorConfig` key is a public `init()` option. If the
 * skill never names it, an agent invents `footerBlocks` / a render splice /
 * content JSON instead of the real key. Naming it in an island (usually
 * integrate.md, providers.md, or failure-modes.md) is required; adding it
 * to EXEMPT is the explicit "not agent-facing" decision.
 */

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const EDITOR_INDEX = resolve(
  import.meta.dirname,
  "../../../packages/editor/src/index.ts",
);

/**
 * Named in docs.md (fetch llms.txt) rather than an island, or not an agent
 * mount concern. A new key does **not** go here by default — name it in
 * integrate.md / providers.md / failure-modes.md.
 */
const EXEMPT = new Set([
  "onChange",
  "onError",
  "onDirtyChange",
  "changeDebounce",
  "onRequestMedia",
  "resolvePreview",
  "resolveImageUrl",
  "mergeTags",
  "logicTags",
  "displayConditions",
  "customBlocks",
  "htmlBlockPreview",
  "socialIconsBaseUrl",
  "templateSettings",
  "blockDefaults",
  "templateDefaults",
  "branding",
  "smallScreenNotice",
]);

function interfaceKeys(src: string, name: string): string[] {
  const header = new RegExp(`export interface ${name}\\s*\\{`);
  const match = header.exec(src);
  if (!match) throw new Error(`no interface ${name}`);
  const open = src.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const body = src.slice(open + 1, i);
        return [...body.matchAll(/^  ([A-Za-z][A-Za-z0-9]*)\??:/gm)].map(
          (m) => m[1],
        );
      }
    }
  }
  throw new Error(`unclosed ${name}`);
}

function skillCorpus(): string {
  const files = [
    resolve(SKILL_ROOT, "SKILL.md"),
    ...readdirSync(resolve(SKILL_ROOT, "reference"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => resolve(SKILL_ROOT, "reference", f)),
  ];
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

describe("init() config keys reach the skill", () => {
  const keys = interfaceKeys(
    readFileSync(EDITOR_INDEX, "utf8"),
    "TemplaticalEditorConfig",
  );
  const corpus = skillCorpus();

  it("finds TemplaticalEditorConfig keys", () => {
    expect(keys).toContain("layout");
    expect(keys).toContain("sectionWrapper");
    expect(keys.length).toBeGreaterThan(10);
  });

  it("names every non-exempt key in a skill island", () => {
    const missing = keys.filter((key) => {
      if (EXEMPT.has(key)) return false;
      return !corpus.includes(key);
    });
    expect(
      missing,
      `init() keys with no skill mention: ${missing.join(", ")}. Name them in integrate.md / providers.md / failure-modes.md, or add to EXEMPT with a reason.`,
    ).toEqual([]);
  });

  it("does not exempt layout or sectionWrapper", () => {
    expect(EXEMPT.has("layout")).toBe(false);
    expect(EXEMPT.has("sectionWrapper")).toBe(false);
  });
});
