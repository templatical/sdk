import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import * as types from "../../../packages/types/src";
import { renderToMjml } from "../../../packages/renderer/src";
import { validateTemplate } from "../../../packages/template-tools/src";
import { lintTemplate } from "../../../packages/quality/src";
import { Liquid } from "liquidjs";

const DOCS = join(import.meta.dirname, "..");
const pages = [
  "guide/localized-templates.md",
  "de/guide/localized-templates.md",
];
const anchors = ["missing-values", "out-of-date-values", "merge-tags"];

describe("localized template guide", () => {
  it.each(["", "de/"])(
    "%squality pages keep localization in the category contract",
    (prefix) => {
      const headless = readFileSync(
        join(DOCS, `${prefix}quality/headless-usage.md`),
        "utf8",
      );
      expect(headless).toContain("lintLocalization(content, options?)");
      expect(headless).toContain("compatibility: false, localization: false");
      const contributing = readFileSync(
        join(DOCS, `${prefix}quality/contributing-locales.md`),
        "utf8",
      );
      expect(contributing).toContain("src/localization/messages/{locale}.ts");
      expect(contributing).not.toMatch(
        /no test update|kein Test zu aktualisieren/i,
      );
      expect(contributing).toMatch(
        /packages\/quality\/src\/localization\/messages\/\n\s+en\.ts[^\n]*\n\s+de\.ts[^\n]*\n\s+index\.ts/,
      );
      const instructions = contributing.match(
        /^### 7\. [^\n]+\n([\s\S]*)/m,
      )?.[1];
      expect(instructions).toBeDefined();
      for (const term of [
        "localization/messages/<lang>.ts",
        "message",
        "suggestion",
        "{field}",
        "typeof en",
        "import.meta.glob",
        "SUPPORTED_LOCALIZATION_MESSAGE_LOCALES",
        "pnpm --filter @templatical/quality run test",
        "tests/localization/messages.test.ts",
      ]) {
        expect(instructions).toContain(term);
      }
      for (const page of [
        "structure/index",
        "links/index",
        "accessibility/index",
        "compatibility/index",
        "contributing-locales",
      ]) {
        const source = readFileSync(
          join(DOCS, `${prefix}quality/${page}.md`),
          "utf8",
        );
        expect(source).not.toMatch(
          /all five|alle fünf|Alle fünf|runs compatibility last/,
        );
      }
    },
  );

  it.each([...pages, "../../skills/templatical/reference/localize.md"])(
    "%s contains no internal tracker ids or slice names",
    (page) => {
      expect(readFileSync(join(DOCS, page), "utf8")).not.toMatch(
        /OI-\d+|LOC[1-3]/,
      );
    },
  );
  it.each(pages)("%s has the complete mirrored heading outline", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    const outline = [...source.matchAll(/^(#{1,6}) /gm)].map(
      (match) => match[1].length,
    );
    expect(outline).toEqual([1, ...Array<number>(14).fill(2)]);
  });

  it.each([...pages, "../../skills/templatical/reference/localize.md"])(
    "%s has Limits covering defaults, fields, Translate, AI and other services",
    (page) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      const limits =
        source.split(/^## (?:Limits|Grenzen)\n/m)[1]?.split(/^## /m)[0] ?? "";
      const phrases = page.startsWith("de/")
        ? [
            "die erste Spalte rechts",
            "wiederholbaren Elementen",
            "Text als Standardinhalt",
            "nicht pro Sprache",
          ]
        : [
            "the first column on the right",
            "repeatable items",
            "their text as default content",
            "not per language",
          ];
      expect(limits).not.toMatch(/glossary|Glossar/);
      for (const phrase of phrases)
        expect.soft(limits, phrase).toContain(phrase);
      if (pages.includes(page))
        expect(source).toMatch(
          /^## (?:Limits|Grenzen)\n(?:(?!^## )[\s\S])*^## (?:Check your work|Ergebnis prüfen)\n/m,
        );
    },
  );

  it.each(pages)("%s preserves the lint reference anchors", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    for (const anchor of anchors) {
      expect(source).toMatch(new RegExp(`^## .+ \\{#${anchor}\\}$`, "m"));
    }
  });

  it.each(pages)("%s names the model, projection and self-check", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    for (const name of [
      "settings.locales",
      "l10n",
      "resolveLocale",
      "--locale",
    ]) {
      expect(source).toContain(name);
    }
  });

  it("lists the guide in the generated English agent index", () => {
    const index = readFileSync(join(DOCS, "public/llms.txt"), "utf8");
    expect(index).toContain(
      "https://docs.templatical.com/guide/localized-templates)",
    );
  });

  it.each(pages)("%s keeps CLI examples on the docs release path", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    expect(source).toContain("npx -y @templatical/template-tools validate");
    expect(source).not.toMatch(/@templatical\/template-tools@\d/);
  });

  it("runs the included authoring and rendering example", async () => {
    const source = readFileSync(
      join(DOCS, "snippets/localize-template.ts"),
      "utf8",
    );
    const file = ts.createSourceFile(
      "example.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const body = file.statements
      .filter((node) => !ts.isImportDeclaration(node))
      .map((node) => node.getText(file))
      .join("\n");
    const js = ts.transpileModule(body, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    const names = [
      "applyOperations",
      "createDefaultTemplateContent",
      "createTitleBlock",
      "sourceHash",
      "resolveLocale",
      "localeCoverage",
    ];
    const run = new Function(
      ...names,
      "renderToMjml",
      `return (async () => { ${js}\nreturn { content, german, mjml, coverage }; })();`,
    );
    const result = await run(
      ...names.map((name) => types[name as keyof typeof types]),
      renderToMjml,
    );
    expect(result.content.settings.locales).toEqual(["de"]);
    expect(result.german.blocks[0].content).toBe("Willkommen");
    expect(result.german.settings.locale).toBe("de");
    expect(result.german.settings.locales).toBeUndefined();
    expect(result.mjml).toContain('lang="de"');
    expect(result.mjml).toContain("Willkommen");
    expect(result.coverage.missing).toEqual([]);
    expect(result.coverage.stale).toEqual([]);
  });

  it("checks and renders custom translations with definitions through the library", async () => {
    const source = readFileSync(
      join(DOCS, "snippets/localize-custom-block.ts"),
      "utf8",
    );
    const file = ts.createSourceFile(
      "example.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const body = file.statements
      .filter((node) => !ts.isImportDeclaration(node))
      .map((node) => node.getText(file))
      .join("\n");
    const js = ts.transpileModule(body, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    const run = new Function(
      "createCustomBlock",
      "createDefaultTemplateContent",
      "sourceHash",
      "validateTemplate",
      "lintTemplate",
      "renderToMjml",
      "Liquid",
      `return (async () => { ${js}\nreturn { content, validation, issues, mjml }; })();`,
    );
    const result = await run(
      types.createCustomBlock,
      types.createDefaultTemplateContent,
      types.sourceHash,
      validateTemplate,
      lintTemplate,
      renderToMjml,
      Liquid,
    );
    expect(result.validation.valid).toBe(true);
    expect(
      result.issues.filter((issue: { ruleId: string }) =>
        issue.ruleId.startsWith("localization."),
      ),
    ).toEqual([]);
    expect(result.mjml).toContain("<p>Willkommen</p>");
    expect(result.mjml).not.toContain("Welcome");
    expect(result.content.blocks[0].renderedHtml).toBe("<p>Welcome</p>");
    expect(validateTemplate(result.content).valid).toBe(false);
  });
});
