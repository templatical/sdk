import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createMenuBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createTableBlock,
} from "@templatical/types";
import { validateTemplate } from "../src/validate";

describe("element id validation", () => {
  it("reports every offending id with its exact template path", () => {
    const content = createDefaultTemplateContent();
    const menu = createMenuBlock({
      items: [
        {
          id: "v1.2",
          text: "Shop",
          url: "https://example.com",
          openInNewTab: false,
          bold: false,
          underline: false,
        },
      ],
    });
    menu.items[0].id = "v1.2";
    const social = createSocialIconsBlock({
      icons: [{ id: "a/b", platform: "facebook", url: "https://example.com" }],
    });
    social.icons[0].id = "a/b";
    const table = createTableBlock({
      rows: [{ id: "r.1", cells: [{ id: "c/1", content: "Cell" }] }],
    });
    content.blocks = [
      createSectionBlock({ children: [[menu, social, table]] }),
    ];
    expect(validateTemplate(content)).toEqual({
      valid: false,
      errors: [
        'blocks[0].children[0][0].items[0].id: Element id "v1.2" must not contain "." or "/".',
        'blocks[0].children[0][1].icons[0].id: Element id "a/b" must not contain "." or "/".',
        'blocks[0].children[0][2].rows[0].id: Element id "r.1" must not contain "." or "/".',
        'blocks[0].children[0][2].rows[0].cells[0].id: Element id "c/1" must not contain "." or "/".',
      ],
    });
  });

  it("accepts valid ids", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createMenuBlock(),
      createSocialIconsBlock(),
      createTableBlock(),
    ];
    expect(validateTemplate(content)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a text entry with source instead of sourceHash", () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "Hello";
    content.settings.locales = ["de"];
    Object.assign(content.settings, {
      l10n: {
        de: { text: { preheaderText: { value: "Hallo", source: "12345678" } } },
      },
    });
    expect(validateTemplate(content).valid).toBe(false);
  });
});
