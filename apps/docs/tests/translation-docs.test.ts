import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as types from "../../../packages/types/src";
import * as server from "../../../packages/ai-kit/src/server";
import * as client from "../../../packages/ai-kit/src/client";
import * as testing from "../../../packages/ai-kit/src/testing";
import { lintTemplate } from "../../../packages/quality/src";

const DOCS = join(import.meta.dirname, "..");
const read = (path: string) =>
  existsSync(join(DOCS, path)) ? readFileSync(join(DOCS, path), "utf8") : "";

async function snippet(name: string, result: string) {
  const source = read(`snippets/${name}.ts`);
  expect(source, `${name} must exist`).not.toBe("");
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const modules: Record<string, object> = {
    "@templatical/types": types,
    "@templatical/ai-kit/server": server,
    "@templatical/ai-kit/client": client,
    "@templatical/ai-kit/testing": testing,
  };
  const bindings: Record<string, unknown> = {};
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node) || node.importClause?.isTypeOnly)
      continue;
    const module = modules[(node.moduleSpecifier as ts.StringLiteral).text];
    expect(module).toBeDefined();
    const imports = node.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports))
      for (const entry of imports.elements) {
        if (entry.isTypeOnly) continue;
        const name = (entry.propertyName ?? entry.name).text;
        expect(module, name).toHaveProperty(name);
        bindings[entry.name.text] = (module as Record<string, unknown>)[name];
      }
  }
  const body = file.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(file).replace(/^export /, ""))
    .join("\n");
  const js = ts.transpileModule(body, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return new Function(
    ...Object.keys(bindings),
    `return (async () => { ${js}\nreturn { ${result} }; })();`,
  )(...Object.values(bindings));
}

describe("translation documentation", () => {
  it.each(["", "de/"])(
    "%sbackend exposes the contract, wire and self-check",
    (prefix) => {
      const page = read(`${prefix}backend/translation.md`);
      for (const term of [
        "TranslationProvider",
        "TranslationRequest",
        "TranslationResult",
        "<<< @/snippets/translation-contract.ts",
        "<<< @/snippets/translate-server.ts",
        "createHttpTranslationProvider",
        "translateFields",
        "readTranslationRequest",
        "createMockTranslationProvider",
        "runTranslationConformance",
        "20,000",
        "50",
        "rate_limited",
        "limit_reached",
        "content_too_large",
        "translation_failed",
        "/templates/{template}/translate",
        "Templatical-AI-Wire: 1",
        "AbortError",
        // The single source for masking, do-not-translate and DeepL.
        '<x id="n"/>',
        "__xn__",
        "doNotTranslate",
        "tag_handling=html",
        "tag_handling=xml",
        "https://developers.deepl.com/docs/xml-and-html-handling/html",
        "https://developers.deepl.com/docs/xml-and-html-handling/xml",
      ]) {
        expect.soft(page, term).toContain(term);
      }
      expect(read(".vitepress/config.ts")).toContain(
        `/${prefix}backend/translation`,
      );
    },
  );

  it.each([
    ["", "/backend/translation#provider-contract"],
    ["de/", "/de/backend/translation#provider-vertrag"],
  ])(
    "%sguide explains translation, includes the strings round trip and links the contract",
    (prefix, contract) => {
      const page = read(`${prefix}guide/localized-templates.md`);
      for (const term of [
        "<<< @/snippets/translate-strings.ts",
        "<<< @/snippets/translate-subject.ts",
        "translation",
        "localization.untranslated",
        "localization.stale",
        `](${contract})`,
      ])
        expect.soft(page).toContain(term);
      // Masking, limits and the DeepL settings live on the contract page only.
      for (const term of ["__xn__", "tag_handling=", "UTF-16", "sanitizeHtml"])
        expect.soft(page, term).not.toContain(term);
      expect(page).toMatch(/^## (Limits|Grenzen)/m);
    },
  );

  it.each([
    [
      "",
      "**Translate {count} fields**",
      /The dismissible result notice[^\n]*/,
      /cancellation/,
    ],
    [
      "de/",
      "**{count} Felder übersetzen**",
      /Die schließbare Ergebnismeldung[^\n]*/,
      /Abbrüche/,
    ],
  ] as const)(
    "%sguide matches the translation labels and notice",
    (prefix, label, notice, cancellation) => {
      const page = read(`${prefix}guide/localized-templates.md`);
      expect.soft(page).toContain(label);
      const result = page.match(notice)?.[0];
      expect(result).toBeDefined();
      expect.soft(result).not.toMatch(cancellation);
    },
  );

  it.each([
    ["", "`locale`, `mergeTags` and `content` are JSON strings"],
    ["de/", "`locale`, `mergeTags` und `content` sind JSON-Strings"],
  ])(
    "%sAI wire documents multipart locale serialization",
    (prefix, serialization) => {
      expect(read(`${prefix}api/ai-kit.md`)).toContain(serialization);
    },
  );

  it("German alt text names the active template language", () => {
    const page = read("de/backend/ai.md");
    expect(page).toContain("`locale` ist die aktive Template-Sprache");
  });

  it("keeps backend heading levels and snippet includes mirrored", () => {
    const en = read("backend/translation.md");
    const de = read("de/backend/translation.md");
    expect(en).not.toBe("");
    expect([...de.matchAll(/^(#+) /gm)].map((m) => m[1])).toEqual(
      [...en.matchAll(/^(#+) /gm)].map((m) => m[1]),
    );
    expect(de.match(/^<<< .+$/gm)).toEqual(en.match(/^<<< .+$/gm));
    expect(
      de.match(/\]\(\/de\/[^)]+\)/g)?.map((s) => s.replace("/de/", "/")),
    ).toEqual(en.match(/\]\(\/[^)]+\)/g));
  });

  it.each(["", "de/"])(
    "%sapi/types gives isSafeUrlAttribute's exact signature and every attribute and scheme it allows",
    (prefix) => {
      const source = readFileSync(
        join(DOCS, "../../packages/types/src/url-policy.ts"),
        "utf8",
      );
      const signature = source.match(
        /export function (isSafeUrlAttribute\([^)]*\): \w+)/,
      )?.[1];
      expect(signature).toBe(
        "isSafeUrlAttribute(name: string, value: string): boolean",
      );
      const paragraph = read(`${prefix}api/types.md`)
        .split("\n")
        .find((line) => line.startsWith(`\`${signature}\``));
      expect(paragraph).toBeDefined();
      const allowed = [
        ...types.SAFE_LINK_SCHEMES,
        ...types.HTML_URL_ATTRIBUTES,
      ];
      expect(allowed).toContain("cid");
      expect(allowed).toContain("poster");
      for (const value of allowed)
        expect.soft(paragraph, value).toContain(`\`${value}\``);
      for (const value of types.HTML_FORBIDDEN_ATTRIBUTES)
        expect.soft(paragraph, value).toContain(`\`${value}\``);
    },
  );

  it.each(["", "de/"])(
    "%sAPI pages expose translation and language-aware AI",
    (prefix) => {
      expect(read(`${prefix}api/editor.md`)).toContain("TranslationProvider");
      for (const term of [
        "maskTags",
        "unmaskTags",
        "localeStrings",
        "applyLocaleStrings",
        "TRANSLATABLE_HTML_FIELDS",
        "TRANSLATION_MAX_FIELDS",
        "TRANSLATION_MAX_CHARS",
      ])
        expect.soft(read(`${prefix}api/types.md`)).toContain(term);
      for (const term of [
        "createHttpTranslationProvider",
        "readTranslationRequest",
        "translateFields",
        "createMockTranslationProvider",
        "runTranslationConformance",
      ])
        expect.soft(read(`${prefix}api/ai-kit.md`)).toContain(term);
      const ai = read(`${prefix}backend/ai.md`);
      expect(ai).toContain("locale");
      expect(ai).toContain(`/${prefix}backend/translation`);
      expect(ai).not.toMatch(
        /Whole-template translation is not a separate feature|Eine gesonderte Funktion für die Übersetzung ganzer Templates gibt es nicht/,
      );
    },
  );

  it("runs the JSON strings round trip without missing, stale or changed tags", async () => {
    const { content, german, rejected, json } = await snippet(
      "translate-strings",
      "content, german, rejected, json",
    );
    expect(rejected).toEqual([]);
    // The protected term leaves the file as a placeholder, like the merge tag.
    expect(JSON.parse(json).strings).toEqual([
      {
        id: "greeting/content",
        format: "html",
        source: '<p>Hello <x id="1"/>, welcome to <x id="2"/></p>',
        sourceHash: types.sourceHash(
          "<p>Hello {{first_name}}, welcome to Sable</p>",
        ),
      },
    ]);
    expect(german.blocks[0].content).toBe(
      "<p>Hallo {{first_name}}, willkommen bei Sable</p>",
    );
    expect(content.blocks[0].content).toBe(
      "<p>Hello {{first_name}}, welcome to Sable</p>",
    );
    expect(
      lintTemplate(content, { contentLocale: "de" }).filter((issue) =>
        issue.ruleId.startsWith("localization."),
      ),
    ).toEqual([]);
  });

  it.each([
    ["", "as **Keep** does"],
    ["de/", "wie **Beibehalten**"],
  ])(
    "%sguide warns that an out-of-date entry applied unchanged turns current",
    (prefix, keep) => {
      const page = read(`${prefix}guide/localized-templates.md`);
      for (const term of [keep, "`previous`", "`strings export`"])
        expect.soft(page).toContain(term);
      const original = types.createDefaultTemplateContent("Arial", {
        locale: "en",
      });
      original.blocks.push(
        types.createParagraphBlock({ id: "p", content: "<p>New</p>" }),
      );
      const content = types.applyOperations(original, [
        { op: "addLocale", locale: "de" },
        {
          op: "updateBlockLocale",
          blockId: "p",
          locale: "de",
          text: {
            content: {
              value: "<p>Alt</p>",
              sourceHash: types.sourceHash("<p>Old</p>"),
            },
          },
        },
      ]);
      const syntax = types.SYNTAX_PRESETS.liquid;
      const { strings, tokens } = types.localeStrings(content, "de", {
        syntax,
        only: "gaps",
      });
      expect(strings).toEqual([
        {
          id: "p/content",
          format: "html",
          source: "<p>New</p>",
          sourceHash: types.sourceHash("<p>New</p>"),
          text: "<p>Alt</p>",
        },
      ]);
      const { operations } = types.applyLocaleStrings(
        content,
        "de",
        strings.map(({ id, text, sourceHash }) => ({
          id,
          text: text!,
          sourceHash,
        })),
        { syntax, tokens },
      );
      expect(
        types.localeCoverage(types.applyOperations(content, operations), "de"),
      ).toEqual({ translated: ["p/content"], missing: [], stale: [] });
    },
  );

  it("runs the subject-line example through a TranslationProvider with tags and terms masked", async () => {
    const { subject, masked, germanSubject } = await snippet(
      "translate-subject",
      "subject, masked, germanSubject",
    );
    expect(subject).toContain("{{first_name}}");
    expect(subject).toContain("Sable");
    expect(masked.text).not.toContain("{{first_name}}");
    expect(masked.text).not.toContain("Sable");
    expect(masked.tokens).toEqual(["{{first_name}}", "Sable"]);
    expect(germanSubject).toBe(
      "{{first_name}}, Ihre Sable-Bestellung ist unterwegs",
    );
  });

  it("runs the server example through the HTTP provider and conformance suite", async () => {
    const { handleTranslation } = await snippet(
      "translate-server",
      "handleTranslation",
    );
    const model: server.AiModelAdapter = {
      async *stream({ messages }) {
        const input = JSON.parse(
          (messages[0] as { content: string }).content.split("Fields:\n")[1],
        );
        yield {
          type: "text",
          text: JSON.stringify({
            fields: input.map((field: { id: string; text: string }) => ({
              id: field.id,
              text: field.text,
            })),
          }),
        };
      },
    };
    const provider = client.createHttpTranslationProvider({
      url: "https://example.test/api",
      fetch: async (url, init) => {
        expect(String(url)).toContain("/templates/_/translate");
        const response = await handleTranslation(new Request(url, init), model);
        expect(response.headers.get("Templatical-AI-Wire")).toBe("1");
        return response;
      },
    });
    const checks = await testing.runTranslationConformance(provider);
    expect(checks.filter((check) => !check.ok)).toEqual([]);
    expect(checks).toHaveLength(5);
    const invalid = await handleTranslation(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ fields: [] }),
      }),
      model,
    );
    expect(invalid.status).toBe(422);
  });
});
