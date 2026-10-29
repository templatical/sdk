import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const pattern = "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$";

describe("localization public contracts", () => {
  it.each(["types", "ai-kit"])(
    "discloses required producers in the %s changeset",
    (pkg) => {
      const text = read(
        pkg === "types"
          ? ".changeset/localized-templates-types.md"
          : ".changeset/translation-ai-kit.md",
      );
      for (const term of [
        "AiRequestBase.locale",
        "AiRewriteRequest.locale",
        "CollaborationRemoteChange.locale",
        "excluding `setDefaultLocale`",
        "required",
        "null",
        "must set",
        "existing templates need no migration",
      ])
        expect.soft(text).toContain(term);
      expect(text).toContain(`"@templatical/${pkg}": minor`);
    },
  );
  it.each(["", "de/"])("%s collaboration links reach compatibility", (lang) => {
    const text = read(`apps/docs/${lang}backend/collaboration.md`);
    expect(text).toContain("localized-templates#compatibility");
    expect(text).not.toContain("localized-templates#upgrading");
  });
  it.each([
    "apps/docs/guide/localized-templates.md",
    "apps/docs/de/guide/localized-templates.md",
    "skills/templatical/reference/localize.md",
  ])("%s states the exact language-tag pattern", (path) => {
    const text = read(path);
    for (const term of [pattern, "x-…", "i-…", "no-bok", "zh-min-nan"])
      expect.soft(text).toContain(term);
    expect(text).not.toMatch(
      /grandfathered.*(?:rejected|aren't accepted)|historische Tags.*nicht akzeptiert/,
    );
  });
  it.each([
    ["", ["language versions", "Translate"]],
    ["de/", ["Sprachversionen", "übersetzen"]],
  ])(
    "%s guide description contains the lookup terms in one sentence",
    (lang, words) => {
      const description =
        read(`apps/docs/${lang}guide/localized-templates.md`).match(
          /^description: (.+)$/m,
        )?.[1] ?? "";
      for (const term of [
        "settings.locales",
        "l10n",
        "resolveLocale",
        "--locale",
        "TranslationProvider",
        ...words,
      ])
        expect.soft(description).toContain(term);
      expect(
        description
          .replaceAll("settings.locales", "settings_locales")
          .match(/[.!?]/g),
      ).toHaveLength(1);
    },
  );
});

it.each(["", "de/"])(
  "%s types reference includes value-aware structural checking",
  (lang) => {
    expect(read(`apps/docs/${lang}api/types.md`)).toContain(
      "isStructuralLocalePath(block: Block, path: string, value?: unknown): boolean",
    );
  },
);

it("the shared localization snippet includes the replacement-value parameter", () => {
  const snippet = read("apps/docs/snippets/localization-contract.ts");
  expect(snippet).toMatch(
    /function isStructuralLocalePath\(\s*block: Block,\s*path: string,\s*value\?: unknown,?\s*\): boolean/,
  );
});

describe("eval-driven guidance", () => {
  it.each([
    ["", "either lock's locale is `null` or both are equal"],
    [
      "de/",
      "die Locale einer der beiden Sperren `null` ist oder beide gleich sind",
    ],
  ])(
    "%s collaboration samples carry the lock locale and state the acquire rule",
    (lang, rule) => {
      const text = read(`apps/docs/${lang}backend/collaboration.md`);
      for (const method of ["acquireLock", "renewLock", "releaseLock"])
        expect
          .soft(text, method)
          .toMatch(
            new RegExp(
              `${method}: (?:async )?\\(templateId, blockId, locale\\) =>`,
            ),
          );
      expect(text).toContain(
        "body: JSON.stringify({ blockId, locale: locale ?? null })",
      );
      expect(text).toContain("locale: lock.locale ?? null");
      expect(text).toContain(rule);
    },
  );

  it.each([
    [
      "",
      "HTML block content does count",
      "including descendants of hidden blocks",
    ],
    [
      "de/",
      "Inhalt von HTML-Blöcken zählt mit",
      "einschließlich Kindern ausgeblendeter Blöcke",
    ],
  ])(
    "%s says HTML blocks count as missing and hidden blocks are listed by their own flag",
    (lang, html, ambiguous) => {
      expect(read(`apps/docs/${lang}guide/localized-templates.md`)).toContain(
        html,
      );
      const operations = read(`apps/docs/${lang}api/operations.md`);
      expect(operations).toContain("`l10n[locale].hidden`");
      expect(operations).not.toContain(ambiguous);
    },
  );

  it.each([
    ["", "the three rules below", "written before this"],
    ["de/", "den drei Regeln unten", "der davor geschrieben wurde"],
  ])(
    "%s guide names the localization rules and which comments follow the default",
    (lang, count, ambiguous) => {
      const text = read(`apps/docs/${lang}guide/localized-templates.md`);
      expect(text).not.toContain(count);
      expect(text).not.toContain(ambiguous);
      for (const rule of [
        "`localization.untranslated`, `localization.stale`",
        "`localization.merge-tags-differ`",
        "Cloud",
      ])
        expect.soft(text).toContain(rule);
    },
  );

  it.each([
    ["", "an empty `text` is applied when the source has no placeholders"],
    [
      "de/",
      "ein leerer `text` wird angewendet, wenn die Quelle keine Platzhalter enthält",
    ],
  ])(
    "%s template-tools gives the validate --json shape and the empty-text rule",
    (lang, empty) => {
      const text = read(`apps/docs/${lang}api/template-tools.md`);
      const lintIssue = read("packages/quality/src/types.ts").match(
        /export interface LintIssue \{([\s\S]*?)\n\}/,
      )?.[1];
      const fields = [
        ...(lintIssue ?? "").matchAll(/^\s+([a-zA-Z]+)\??:/gm),
      ].map((match) => match[1]);
      expect(fields).toContain("ruleId");
      const shape = text
        .split("\n")
        .find(
          (line) =>
            line.startsWith("Structural validation") ||
            line.startsWith("Strukturelle Validierung"),
        );
      expect(shape).toContain("`{ valid, errors, issues }`");
      for (const field of fields) expect.soft(shape, field).toContain(field);
      expect(text).toContain(empty);
    },
  );
});

it("the types changeset announces the shared URL policy export", () => {
  expect(read(".changeset/localized-templates-types.md")).toContain(
    "`isSafeUrlAttribute(name, value): boolean`",
  );
});

describe("re-review and run-2 guidance", () => {
  it.each([
    [
      "",
      {
        "backend/collaboration.md": [
          "refuse it with `409` and `precondition_failed` when its `baseRevision` isn't the current revision",
          "once this editor has received another session's batch after it",
          "Selecting a block takes its lock in the active view's language",
          "`addBlock` checks no locks",
          "ops.some((op) => op.op === 'setContent') && baseRevision !== template.revision",
        ],
        "api/operations.md": [
          "whose `baseRevision` isn't the current revision",
          "the old default keeps it as a current `text` entry",
        ],
        "api/editor.md": [
          "or a loaded or restored template whose default differs",
          "`translation must be an object with a translate function.`",
        ],
        "api/template-tools.md": [
          "followed by `;` (for example `data:image/png;base64,…`)",
        ],
        "backend/translation.md": [
          "the run stops at that field without calling the provider",
          "1 field is too long to translate.",
        ],
        "guide/localized-templates.md": [
          "Labels name each language in itself",
          "Selecting a block there still takes its lock for that language",
          "`addBlock` checks no locks",
          "keeps a current English entry",
        ],
      },
    ],
    [
      "de/",
      {
        "backend/collaboration.md": [
          "lehnen Sie ihn mit `409` und `precondition_failed` ab, wenn seine `baseRevision` nicht die aktuelle Revision ist",
          "sobald dieser Editor danach einen Batch einer anderen Sitzung empfangen hat",
          "nimmt seine Sperre in der Sprache der aktiven Ansicht",
          "`addBlock` prüft keine Sperren",
          "ops.some((op) => op.op === 'setContent') && baseRevision !== template.revision",
        ],
        "api/operations.md": [
          "dessen `baseRevision` nicht die aktuelle Revision ist",
          "behält die bisherige Standardsprache ihn als aktuellen `text`-Eintrag",
        ],
        "api/editor.md": [
          "oder ein geladenes oder wiederhergestelltes Template mit anderer Standardsprache",
          "`translation must be an object with a translate function.`",
        ],
        "api/template-tools.md": [
          "gefolgt von `;` (etwa `data:image/png;base64,…`)",
        ],
        "backend/translation.md": [
          "Der Durchlauf endet an diesem Feld, ohne den Provider aufzurufen",
          "1 Feld ist zu lang zum Übersetzen.",
        ],
        "guide/localized-templates.md": [
          "Beschriftungen nennen jede Sprache in ihrer eigenen Sprache",
          "Wer dort einen Block auswählt, nimmt trotzdem seine Sperre für diese Sprache",
          "`addBlock` prüft keine Sperren",
          "behält einen aktuellen englischen Eintrag",
        ],
      },
    ],
  ])(
    "%s docs state the snapshot rule and the corrected contracts",
    (lang, pages) => {
      for (const [page, terms] of Object.entries(pages)) {
        const text = read(`apps/docs/${lang}${page}`);
        for (const term of terms)
          expect.soft(text, `${page}: ${term}`).toContain(term);
      }
      expect(read(`apps/docs/${lang}backend/collaboration.md`)).not.toContain(
        "once any other session's batch has landed after it",
      );
    },
  );

  it("the skill and changesets carry the same corrections", () => {
    const skill = (name: string) =>
      read(`skills/templatical/reference/${name}.md`);
    for (const [text, term] of [
      [
        skill("providers"),
        "a loaded or restored template whose default differs",
      ],
      [skill("providers"), "`addBlock` checks no locks"],
      [
        skill("providers"),
        "translation must be an object with a translate function.",
      ],
      [skill("providers"), "refuses a batch with a `setContent`"],
      [
        skill("localize"),
        "once this editor has received another session's batch after it",
      ],
      [skill("localize"), "Labels name each language in itself"],
      [skill("localize"), "including a read-only **Not enabled** view"],
      [skill("localize"), "`addBlock` checks no locks"],
      [skill("localize"), "keeps a current entry"],
      [skill("edit"), "keeps a current entry"],
      [skill("cli"), "followed by `;` (for example `data:image/png;base64,…`)"],
      [read(".changeset/localized-templates-types.md"), "followed by `;`"],
      [
        read(".changeset/localized-templates-core.md"),
        "`baseRevision` isn't the current revision",
      ],
    ] as const)
      expect.soft(text, term).toContain(term);
  });
});

describe("snapshot race guidance", () => {
  it.each([
    [
      "",
      "Check a repeated `batchId` first, as the sample below does",
      "unless the template is exactly as the turn",
      "the turn's own inverse, refused when someone changed those blocks since.",
    ],
    [
      "de/",
      "Prüfen Sie eine wiederholte `batchId` zuerst, wie im Beispiel unten",
      "außer das Template ist genau so, wie der Durchlauf",
      "Hat jemand die betroffenen Blöcke inzwischen geändert, wird dies verweigert.",
    ],
  ])(
    "%s docs give the duplicate check's order and the chat Undo's snapshot rule",
    (lang, order, chat, old) => {
      expect(read(`apps/docs/${lang}backend/collaboration.md`)).toContain(
        order,
      );
      const ai = read(`apps/docs/${lang}backend/ai.md`);
      expect(ai).toContain(chat);
      expect(ai).not.toContain(old);
    },
  );
});
