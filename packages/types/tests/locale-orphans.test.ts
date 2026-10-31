import { describe, expect, it } from "vitest";
import {
  applyOperations,
  invertOperations,
  createDefaultTemplateContent,
  createMenuBlock,
  sourceHash,
  pruneLocaleOrphans,
  pruneSettingsLocaleOrphans,
  type Operation,
} from "../src";

function menuContent() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de", "fr"];
  content.settings.preheaderText = "Hello";
  content.settings.l10n = {
    de: {
      text: { preheaderText: { value: "Hallo", sourceHash: sourceHash("Hello") } },
    },
  };
  content.blocks = [
    createMenuBlock({
      id: "menu",
      items: [{ id: "home", text: "Home", url: "/" }],
      l10n: {
        de: {
          text: {
            "items.home.text": { value: "Start", sourceHash: sourceHash("Home") },
          },
          set: { "items.home.url": "/de" },
        },
        fr: { hidden: true },
      },
    }),
  ];
  return content;
}

describe("locale orphan pruning", () => {
  it.each(["item", "preheader"])(
    "prunes a deleted %s and restores its layers on inverse",
    (kind) => {
      const before = menuContent();
      const ops: Operation[] =
        kind === "item"
          ? [{ op: "updateBlock", blockId: "menu", set: { items: [] } }]
          : [{ op: "updateSettings", unset: ["preheaderText"] }];
      const inverse = invertOperations(before, ops);
      const after = applyOperations(before, ops);
      if (kind === "item")
        expect(after.blocks[0].l10n).toEqual({ fr: { hidden: true } });
      else expect(after.settings.l10n).toBeUndefined();
      const remove: Operation[] = [{ op: "removeLocale", locale: "de" }];
      expect(
        applyOperations(
          applyOperations(after, remove),
          invertOperations(after, remove),
        ),
      ).toEqual(after);
      expect(applyOperations(after, inverse)).toEqual(before);
      expect(
        inverse.some(
          (op) =>
            op.op ===
            (kind === "item" ? "updateBlockLocale" : "updateSettingsLocale"),
        ),
      ).toBe(true);
    },
  );
});

it("prunes layers purely and preserves optional set leaves with existing parents", () => {
  const before = menuContent();
  const menu = before.blocks[0];
  if (menu.type !== "menu") throw new Error("Expected menu");
  menu.items = [];
  menu.l10n!.de.set!.color = "#123456";
  const snapshot = structuredClone(menu);
  expect(pruneLocaleOrphans(menu).l10n).toEqual({
    de: { set: { color: "#123456" } },
    fr: { hidden: true },
  });
  expect(menu).toEqual(snapshot);
  delete before.settings.preheaderText;
  expect(pruneSettingsLocaleOrphans(before.settings).l10n).toBeUndefined();
  expect(before.settings.l10n).toBeDefined();
});
