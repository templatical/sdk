import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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
const outline = {
  "guide/localized-templates.md": [
    "# Localized templates",
    "## Setup",
    "## Adding a language",
    "## Translating {#translating}",
    "## Checking a language",
    "### Missing values {#missing-values}",
    "### Out-of-date values {#out-of-date-values}",
    "### Merge tags {#merge-tags}",
    "## Rendering a language",
    "## Data shape",
    "## Layouts",
    "## Default language",
    "## Comments",
    "## Subject lines",
    "## Operations and collaboration",
    "## Compatibility",
    "## Limits",
    "## Check your work",
    "## In the playground",
  ],
  "de/guide/localized-templates.md": [
    "# Lokalisierte Templates",
    "## Einrichtung",
    "## Eine Sprache hinzufügen",
    "## Übersetzen {#translating}",
    "## Eine Sprache prüfen",
    "### Fehlende Werte {#missing-values}",
    "### Veraltete Werte {#out-of-date-values}",
    "### Merge-Tags {#merge-tags}",
    "## Eine Sprache rendern",
    "## Datenstruktur",
    "## Layouts",
    "## Standardsprache",
    "## Kommentare",
    "## Betreffzeilen {#subject-lines}",
    "## Operationen und Zusammenarbeit",
    "## Kompatibilität {#compatibility}",
    "## Grenzen",
    "## Ergebnis prüfen {#check-your-work}",
    "## Im Playground",
  ],
} as Record<string, string[]>;

/** The body of the section under `heading`, up to the next heading of its level or above. */
function section(source: string, heading: string): string {
  const start = source.indexOf(`\n${heading}\n`);
  if (start < 0) return "";
  const level = heading.match(/^#+/)![0].length;
  const rest = source.slice(start + heading.length + 2);
  const end = rest.search(new RegExp(`^#{1,${level}} `, "m"));
  return end < 0 ? rest : rest.slice(0, end);
}

/** VitePress's heading slug (`@mdit-vue/shared`), for links without an explicit id. */
function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();
}

/** Every anchor a page's headings answer to: explicit `{#id}`s and slugs. */
function headingIds(source: string): Set<string> {
  const ids = new Set<string>();
  let fenced = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = fenced ? null : /^#{1,6} (.+?)\s*$/.exec(line);
    if (!match) continue;
    const explicit = /\{#([\w-]+)\}$/.exec(match[1])?.[1];
    ids.add(explicit ?? slugify(match[1].replace(/`/g, "")));
  }
  return ids;
}

function markdownPages(dir = DOCS, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      ["public", "node_modules", ".vitepress", "tests", "scripts"].includes(
        name,
      )
    )
      continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) markdownPages(abs, out);
    else if (name.endsWith(".md"))
      out.push(relative(DOCS, abs).split(sep).join("/"));
  }
  return out;
}

const publicSurfaces = [
  ...pages,
  "backend/translation.md",
  "de/backend/translation.md",
  "backend/ai.md",
  "de/backend/ai.md",
  ...["localize.md", "cli.md", "edit.md", "rules.md", "providers.md"].map(
    (name) => `../../skills/templatical/reference/${name}`,
  ),
  "../../skills/templatical/evals/evals.json",
  ...readdirSync(join(DOCS, "../../.changeset"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `../../.changeset/${name}`),
];

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

  it.each(publicSurfaces)(
    "%s contains no internal tracker ids or slice names",
    (page) => {
      expect(readFileSync(join(DOCS, page), "utf8")).not.toMatch(
        /OI-\d+|LOC[1-3]|LOCR/,
      );
    },
  );
  it.each(pages)("%s has the task path, then the reference", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    expect(source.match(/^#{1,6} .+$/gm)).toEqual(outline[page]);
  });

  it.each([...pages, "../../skills/templatical/reference/localize.md"])(
    "%s has Limits covering columns, fields, Translate, AI and comments",
    (page) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      const limits =
        source.split(/^## (?:Limits|Grenzen)\n/m)[1]?.split(/^## /m)[0] ?? "";
      const phrases = page.startsWith("de/")
        ? [
            "Die Spaltenstruktur ist für alle Sprachen gemeinsam",
            "die erste Spalte rechts",
            "werden nicht gespiegelt",
            "wiederholbaren Elementen",
            "HTML-Blöcke",
            "Text als Standardinhalt",
            "nicht das gesamte Template ersetzen",
            "Kommentar-Threads werden zwischen den Sprachen geteilt",
            "den Sprach-Tag der Ansicht",
            "Der Versionsverlauf gilt weiterhin pro Template",
            "XLIFF und CSV",
          ]
        : [
            "Column structure is shared across languages",
            "the first column on the right",
            "aren't mirrored",
            "repeatable items",
            "HTML blocks",
            "their text as default content",
            "can't replace the whole template",
            "Comment threads are shared across languages",
            "its view’s language tag",
            "Version history remains per template",
            "XLIFF and CSV",
          ];
      expect(limits).not.toMatch(/glossary|Glossar/);
      // The language-tag pattern is the data shape, not a limit.
      expect(limits).not.toContain("A-Za-z");
      for (const phrase of phrases)
        expect.soft(limits, phrase).toContain(phrase);
      if (pages.includes(page))
        expect(source).toMatch(
          /^## (?:Limits|Grenzen)\n(?:(?!^## )[\s\S])*^## (?:Check your work|Ergebnis prüfen \{#check-your-work\})\n/m,
        );
    },
  );

  it.each(pages)("%s preserves the lint reference anchors", (page) => {
    const source = readFileSync(join(DOCS, page), "utf8");
    for (const anchor of anchors) {
      expect(source).toMatch(new RegExp(`^#{2,3} .+ \\{#${anchor}\\}$`, "m"));
    }
  });

  it("resolves every lint rule reference and docs link into the guide", () => {
    const rules = readFileSync(
      join(DOCS, "../../packages/quality/src/localization/rules.ts"),
      "utf8",
    );
    const references = [
      ...rules.matchAll(
        /https:\/\/docs\.templatical\.com\/guide\/localized-templates#([\w-]+)/g,
      ),
    ].map((match) => match[1]);
    expect([...new Set(references)].sort()).toEqual([...anchors].sort());
    const ids = Object.fromEntries(
      pages.map((page) => [
        page,
        headingIds(readFileSync(join(DOCS, page), "utf8")),
      ]),
    );
    for (const page of pages)
      for (const anchor of references)
        expect(ids[page].has(anchor), `${page}#${anchor}`).toBe(true);
    const broken: string[] = [];
    for (const rel of markdownPages()) {
      const source = readFileSync(join(DOCS, rel), "utf8");
      for (const match of source.matchAll(
        /\]\((\/(?:de\/)?)guide\/localized-templates#([^)\s]+)\)/g,
      )) {
        const page = `${match[1].slice(1)}guide/localized-templates.md`;
        if (!ids[page].has(match[2])) broken.push(`${rel}: ${match[0]}`);
      }
    }
    for (const page of pages)
      for (const match of readFileSync(join(DOCS, page), "utf8").matchAll(
        /\]\(#([^)\s]+)\)/g,
      ))
        if (!ids[page].has(match[1])) broken.push(`${page}: ${match[0]}`);
    expect(broken).toEqual([]);
  });

  it.each([
    [
      "guide/localized-templates.md",
      "## Setup",
      "/getting-started/quick-start",
    ],
    [
      "de/guide/localized-templates.md",
      "## Einrichtung",
      "/de/getting-started/quick-start",
    ],
    [
      "backend/translation.md",
      "## Editor setup",
      "/getting-started/quick-start",
    ],
    [
      "de/backend/translation.md",
      "## Editor-Einrichtung",
      "/de/getting-started/quick-start",
    ],
  ])(
    "%s opens setup with a plain init() block and links the CDN Quick Start",
    (page, heading, quickStart) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      expect(source).not.toMatch(/Vite app|Vite-App/);
      expect(source).not.toContain("localized-editor.html");
      const setup = section(source, heading);
      expect(setup.trimStart()).toMatch(
        /^```ts\nimport \{ init \} from "@templatical\/editor";\n/,
      );
      expect(setup).toContain(`](${quickStart}`);
    },
  );

  it("removes the HTML entry-point snippet", () => {
    expect(existsSync(join(DOCS, "snippets/localized-editor.html"))).toBe(
      false,
    );
  });

  it.each([
    ["guide/localized-templates.md", "## Check your work"],
    [
      "de/guide/localized-templates.md",
      "## Ergebnis prüfen {#check-your-work}",
    ],
  ])("%s gives the exit codes as a table", (page, heading) => {
    const check = section(readFileSync(join(DOCS, page), "utf8"), heading);
    expect(check).toMatch(/^\| Exit \|/m);
    for (const code of ["0", "1", "2", "3"])
      expect(check).toMatch(new RegExp(`^\\| \`${code}\` \\|`, "m"));
  });

  it.each([
    [
      "guide/localized-templates.md",
      ["## Data shape", "## Default language", "## Subject lines"],
      "must not contain `.` or `/`",
    ],
    [
      "de/guide/localized-templates.md",
      [
        "## Datenstruktur",
        "## Standardsprache",
        "## Betreffzeilen {#subject-lines}",
      ],
      "dürfen weder `.` noch `/` enthalten",
    ],
  ])(
    "%s keeps the tag pattern, id rule, default language, layouts and subject lines in their sections",
    (page, [shape, defaultLanguage, subject], idRule) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      const data = section(source, shape);
      expect(data).toContain("^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$");
      expect(data).toContain(idRule);
      const promote = section(source, defaultLanguage);
      for (const term of [
        "setDefaultLocale",
        "defaultLocaleGaps",
        "localeHiddenBlocks",
        "invalid_operation",
      ])
        expect.soft(promote, term).toContain(term);
      const layout = section(source, "## Layouts");
      for (const term of [
        'missing: "default"',
        "strings export",
        "strings import",
      ])
        expect.soft(layout, term).toContain(term);
      const subjects = section(source, subject);
      expect(subjects).toContain("<<< @/snippets/translate-subject.ts");
      expect(subjects).toContain("maskTags");
      expect(subjects).toContain("unmaskTags");
    },
  );

  it.each([
    [
      "guide/localized-templates.md",
      {
        "## Default language": [
          "English keeps no copy of those fields",
          'until `defaultLocaleGaps(content, "de")` returns `[]`',
          "translate HTML blocks by hand in the German view",
          "unless that hash equals the promoted German value, in which case it becomes current",
          "`locked_by_others`",
          '`settings.locale` `"de"` with `"en"` in `settings.locales`',
          "`validate template.json --locale en --json`",
        ],
        "## Checking a language": [
          "icon badge",
          "its tooltip and accessible name give the label",
          "| Badge label |",
          "its label counts them",
        ],
        "## Layouts": ["Set each entry's `text` in `layout.de.json`"],
        "## Subject lines": [
          "Pass the merge-tag syntax and `doNotTranslate` list your editor uses",
        ],
        "## Check your work": [
          "No string was rejected (entries without `text` are skipped)",
          "`targetLocale` isn't a version of it (nothing is written)",
          "or for `validate` an error-severity lint issue",
        ],
      },
      ["out-of-date ones stay out of date", "the badge counts them"],
    ],
    [
      "de/guide/localized-templates.md",
      {
        "## Standardsprache": [
          "Englisch behält für diese Felder keine eigene Kopie",
          'bis `defaultLocaleGaps(content, "de")` `[]` liefert',
          "Übersetzen Sie HTML-Blöcke von Hand in der deutschen Ansicht",
          "außer dieser Hash entspricht dem übernommenen deutschen Wert, dann wird er aktuell",
          "`locked_by_others`",
          '`settings.locale` `"de"` und `"en"` in `settings.locales`',
          "`validate template.json --locale en --json`",
        ],
        "## Eine Sprache prüfen": [
          "ein Symbol als Statusabzeichen",
          "sein Tooltip und sein zugänglicher Name nennen die Beschriftung",
          "| Abzeichen-Beschriftung |",
          "zählt seine Beschriftung sie",
        ],
        "## Layouts": [
          "Setzen Sie zwischen Export und Import den `text` jedes Eintrags",
        ],
        "## Betreffzeilen {#subject-lines}": [
          "Übergeben Sie die Merge-Tag-Syntax und die `doNotTranslate`-Liste Ihres Editors",
        ],
        "## Ergebnis prüfen {#check-your-work}": [
          "Kein String wurde abgelehnt (Einträge ohne `text` werden übersprungen)",
          "`targetLocale` ist keine seiner Versionen (nichts wird geschrieben)",
          "oder bei `validate` ein Lint-Befund",
        ],
      },
      ["veraltete bleiben veraltet", "zählt das Abzeichen sie"],
    ],
  ] as const)(
    "%s states gaps, re-basing, badge labels, layout text, subject syntax and import exits as shipped",
    (page, sections, retired) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      for (const [heading, phrases] of Object.entries(sections)) {
        const body = section(source, heading);
        expect(body, heading).not.toBe("");
        for (const phrase of phrases)
          expect.soft(body, `${heading}: ${phrase}`).toContain(phrase);
      }
      for (const phrase of retired) expect(source).not.toContain(phrase);
    },
  );

  it.each([
    [
      "backend/translation.md",
      "are decoded before matching",
      "`&Amp;` stays literal",
      "are compared as written",
    ],
    [
      "de/backend/translation.md",
      "werden vor dem Abgleich dekodiert",
      "`&Amp;` bleibt wörtlich",
      "werden so verglichen, wie sie geschrieben sind",
    ],
  ])(
    "%s states which references are decoded before term matching",
    (page, decoded, caseExact, retired) => {
      const source = readFileSync(join(DOCS, page), "utf8");
      expect(source).toContain(decoded);
      expect(source).toContain(caseExact);
      expect(source).not.toContain(retired);
    },
  );

  it.each([
    ["api/operations.md", "or a change of the default language"],
    ["de/api/operations.md", "oder einem Wechsel der Standardsprache"],
  ])(
    "%s lists locked_by_others for a default-language change",
    (page, cell) => {
      const row = readFileSync(join(DOCS, page), "utf8")
        .split("\n")
        .find((line) => line.startsWith("| `locked_by_others` |"));
      expect(row).toContain(cell);
    },
  );

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
