import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  sourceHash,
} from "@templatical/types";
import { parseArgs } from "../src/cli/args";
import { runValidate } from "../src/cli/commands/validate";
import { runRender } from "../src/cli/commands/render";
import { setJsonMode } from "../src/cli/output";
import { runQualityLint } from "../src/validate";

let dir: string;
let file: string;
let stdout: string[];

function fixture(
  kind: "missing" | "stale" | "tags" | "translated" = "translated",
) {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  const base = kind === "tags" ? "Hello {{name}}" : "Hello";
  content.blocks = [
    createParagraphBlock({
      id: "copy",
      content: base,
      ...(kind === "missing"
        ? {}
        : {
            l10n: {
              de: {
                text: {
                  content: {
                    value: "Hallo",
                    sourceHash: sourceHash(kind === "stale" ? "Old text" : base),
                  },
                },
              },
            },
          }),
    }),
  ];
  writeFileSync(file, JSON.stringify(content));
  return content;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-locale-"));
  file = join(dir, "template.json");
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  setJsonMode(true);
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("CLI language versions", () => {
  it("exits 1 when the selected translation drops an unsubscribe token from an href", () => {
    const content = fixture();
    const base = '<a href="{{unsubscribe_url}}">Unsubscribe</a>';
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: base,
        l10n: {
          de: {
            text: {
              content: {
                value: '<a href="https://example.com/unsubscribe">Abmelden</a>',
                sourceHash: sourceHash(base),
              },
            },
          },
        },
      }),
    ];
    writeFileSync(file, JSON.stringify(content));
    const result = spawnSync(
      process.execPath,
      [
        resolve(import.meta.dirname, "../dist/bin.js"),
        "validate",
        file,
        "--locale",
        "de",
        "--json",
      ],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).issues).toContainEqual(
      expect.objectContaining({
        ruleId: "localization.merge-tags-differ",
        severity: "warning",
        blockId: "copy",
      }),
    );
  });
  it.each(["missing", "stale"] as const)(
    "prints %s warnings and exits 0",
    async (kind) => {
      fixture(kind);
      expect(
        await runValidate(parseArgs(["validate", file, "--locale", "de"])),
      ).toBe(0);
      const output = JSON.parse(stdout.join(""));
      expect(output.issues).toContainEqual(
        expect.objectContaining({
          ruleId: `localization.${kind === "missing" ? "untranslated" : "stale"}`,
          severity: "warning",
        }),
      );
    },
  );

  it("exits 1 for merge-tag mismatches even though their severity is warning", async () => {
    fixture("tags");
    expect(
      await runValidate(parseArgs(["validate", file, "--locale=de"])),
    ).toBe(1);
    expect(JSON.parse(stdout.join("")).issues).toContainEqual(
      expect.objectContaining({
        ruleId: "localization.merge-tags-differ",
        severity: "warning",
      }),
    );
  });

  it("passes lint options through the library and rethrows unknown_locale", () => {
    const content = fixture("missing");
    expect(
      runQualityLint(content, { contentLocale: "de" }).issues,
    ).toContainEqual(
      expect.objectContaining({ ruleId: "localization.untranslated" }),
    );
    expect(() => runQualityLint(content, { contentLocale: "fr" })).toThrowError(
      expect.objectContaining({ code: "unknown_locale" }),
    );
  });

  it("renders the selected language", async () => {
    fixture();
    expect(await runRender(parseArgs(["render", file, "--locale", "de"]))).toBe(
      0,
    );
    const { output } = JSON.parse(stdout.join(""));
    expect(output).toContain('<mjml lang="de"');
    expect(output).toContain("Hallo");
    expect(output).not.toContain("Hello");
  });

  it("validates compiled HTML for the same selected language", async () => {
    const content = fixture();
    content.settings.l10n = {
      de: {
        text: {
          preheaderText: { value: "x".repeat(100_000), sourceHash: sourceHash("") },
        },
      },
    };
    content.settings.preheaderText = "";
    writeFileSync(file, JSON.stringify(content));
    expect(
      await runValidate(
        parseArgs(["validate", file, "--locale", "de", "--html"]),
      ),
    ).toBe(0);
    expect(JSON.parse(stdout.join("")).issues).toContainEqual(
      expect.objectContaining({ ruleId: "compat.gmail-clipping" }),
    );
    expect(JSON.parse(stdout.join("")).htmlBytes).toBeGreaterThan(100_000);
  });

  it.each(["validate", "render"])(
    "%s exits 1 and prints unknown_locale for an unknown tag",
    (command) => {
      fixture();
      const result = spawnSync(
        process.execPath,
        [
          resolve(import.meta.dirname, "../dist/bin.js"),
          command,
          file,
          "--locale",
          "fr",
        ],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("unknown_locale");
      expect(result.stderr).toContain('This template has no "fr" version.');
    },
  );

  it.each(["validate", "render"])(
    "%s rejects missing --locale values as usage errors",
    (command) => {
      fixture();
      for (const flags of [
        ["--locale"],
        ["--locale="],
        ["--locale", "--json"],
      ]) {
        const result = spawnSync(
          process.execPath,
          [
            resolve(import.meta.dirname, "../dist/bin.js"),
            command,
            file,
            ...flags,
          ],
          { encoding: "utf8" },
        );
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("--locale needs a language tag.");
      }
    },
  );
});
