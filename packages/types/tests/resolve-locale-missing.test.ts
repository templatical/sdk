import { describe, expect, it } from "vitest";
import {
  applyLayout,
  applyLocaleStrings,
  applyOperations,
  createDefaultTemplateContent,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
  elementIdIssues,
  invertOperations,
  localeCoverage,
  localeStrings,
  pruneLocaleOrphans,
  resolveLocale,
  sourceHash,
  SYNTAX_PRESETS,
  type Operation,
} from "../src";

function layout() {
  const doc = createDefaultTemplateContent(undefined, { locale: "en" });
  doc.settings.locales = ["de"];
  doc.blocks = [
    createWrapperBlock({
      id: "band",
      children: [
        createSlotBlock(),
        createSectionBlock({
          id: "footer-section",
          columns: "1",
          children: [
            [
              createParagraphBlock({
                id: "footer",
                content: "Unsubscribe",
                l10n: {
                  de: {
                    text: {
                      content: {
                        value: "Abmelden",
                        sourceHash: sourceHash("Unsubscribe"),
                      },
                    },
                  },
                },
              }),
            ],
          ],
        }),
      ],
    }),
  ];
  return doc;
}

describe("missing locale projection", () => {
  it("projects the default without localization fields for missing: default", () => {
    const doc = layout();
    const before = JSON.stringify(doc);
    const projected = resolveLocale(doc, "fr", { missing: "default" });
    expect(projected).toEqual(resolveLocale(doc, "en"));
    expect(projected.settings.locale).toBe("en");
    expect(JSON.stringify(projected)).not.toContain("l10n");
    expect(projected.settings).not.toHaveProperty("locales");
    expect(JSON.stringify(doc)).toBe(before);
  });

  it.each([undefined, { missing: "throw" as const }])(
    "keeps unknown_locale with %j",
    (options) => {
      expect(() => resolveLocale(layout(), "fr", options)).toThrowError(
        expect.objectContaining({ code: "unknown_locale" }),
      );
    },
  );

  it("keeps a known locale with missing: default", () => {
    const doc = layout();
    expect(resolveLocale(doc, "de", { missing: "default" })).toEqual(
      resolveLocale(doc, "de"),
    );
    expect(
      JSON.stringify(resolveLocale(doc, "de", { missing: "default" })),
    ).toContain("Abmelden");
  });
});

describe("localization inside layout wrappers", () => {
  it("projects descendants and retains the wrapper and slot composition", () => {
    const doc = layout();
    const localized = resolveLocale(doc, "de");
    expect(JSON.stringify(localized)).toContain("Abmelden");
    expect(JSON.stringify(localized)).not.toContain("l10n");
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "body", content: "Body" })];
    const composed = applyLayout(localized, content);
    const band = composed.blocks[0];
    expect(band.type).toBe("wrapper");
    if (band.type !== "wrapper") throw new Error("Missing wrapper");
    expect(band.children.map((block) => block.type)).toEqual([
      "paragraph",
      "section",
    ]);
    expect(band.children[0]).toEqual(content.blocks[0]);
    expect(JSON.stringify(composed)).toContain("Abmelden");
    expect(JSON.stringify(composed)).not.toContain('"type":"slot"');
  });

  it("counts and exports the footer in document order", () => {
    const doc = layout();
    expect(localeCoverage(doc, "de")).toEqual({
      translated: ["footer/content"],
      missing: [],
      stale: [],
    });
    expect(
      localeStrings(doc, "de", { syntax: SYNTAX_PRESETS.liquid, only: "all" })
        .strings,
    ).toEqual([
      {
        id: "footer/content",
        format: "html",
        source: "Unsubscribe",
        sourceHash: sourceHash("Unsubscribe"),
        text: "Abmelden",
      },
    ]);
  });

  it("imports strings through locale operations and inverts them exactly", () => {
    const doc = layout();
    const result = applyLocaleStrings(
      doc,
      "de",
      [
        {
          id: "footer/content",
          text: "Jetzt abmelden",
          sourceHash: sourceHash("Unsubscribe"),
        },
      ],
      {
        syntax: SYNTAX_PRESETS.liquid,
        tokens: { "footer/content": [] },
      },
    );
    expect(result.rejected).toEqual([]);
    expect(result.operations).toHaveLength(1);
    const inverse = invertOperations(doc, result.operations);
    const updated = applyOperations(doc, result.operations);
    expect(JSON.stringify(resolveLocale(updated, "de"))).toContain(
      "Jetzt abmelden",
    );
    expect(JSON.stringify(applyOperations(updated, inverse))).toBe(
      JSON.stringify(doc),
    );
  });

  it("removes and restores wrapper descendants' locale layers", () => {
    const doc = layout();
    const ops: Operation[] = [{ op: "removeLocale", locale: "de" }];
    const removed = applyOperations(doc, ops);
    expect(JSON.stringify(removed)).not.toContain("l10n");
    expect(
      JSON.stringify(applyOperations(removed, invertOperations(doc, ops))),
    ).toBe(JSON.stringify(doc));
  });

  it("prunes orphan paths below wrappers without changing the original", () => {
    const doc = layout();
    const band = doc.blocks[0];
    if (band.type !== "wrapper") throw new Error("Missing wrapper");
    const section = band.children[1];
    if (section.type !== "section") throw new Error("Missing section");
    section.children[0][0].l10n!.de.text!.missing = {
      value: "Fehlt",
      sourceHash: "00000000",
    };
    const pruned = pruneLocaleOrphans(band);
    expect(JSON.stringify(pruned)).not.toContain('"missing"');
    expect(JSON.stringify(band)).toContain('"missing"');
  });

  it("keeps element-id checks inside wrappers", () => {
    const doc = layout();
    const band = doc.blocks[0];
    if (band.type !== "wrapper") throw new Error("Missing wrapper");
    const menu = createMenuBlock({
      items: [
        {
          id: "bad.id",
          text: "Shop",
          url: "https://example.com",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    });
    band.children.push(menu);
    expect(elementIdIssues(doc)).toContainEqual({
      path: "blocks[0].children[2].items[0].id",
      id: "bad.id",
    });
  });
});
