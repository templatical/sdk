// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { nextTick } from "vue";
import {
  chooseLanguage,
  languageContent,
  openLanguages,
} from "./helpers/localization";

const SRC = join(import.meta.dirname, "..", "src");
const languageNames = { en: "English (UK)", de: "German", nl: "Dutch" };

describe("localization.languageNames", () => {
  it("labels the trigger, its accessible name, the menu rows and the Add language submenu", async () => {
    const { wrapper } = await openLanguages({
      localization: { locales: ["en", "de", "nl"], languageNames },
    });
    const trigger = wrapper.get('[data-testid="language-menu"]');
    expect(trigger.get(".tpl-language-name").text()).toBe("English (UK)");
    expect(trigger.attributes("aria-label")).toBe("English (UK) (en)");
    await trigger.trigger("click");
    expect(wrapper.get('[data-testid="language-option-en"]').text()).toContain(
      "English (UK)",
    );
    expect(wrapper.get('[data-testid="language-option-de"]').text()).toContain(
      "German",
    );
    // `fr` is in the template but has no host label, so it keeps its own name.
    expect(wrapper.get('[data-testid="language-option-fr"]').text()).toContain(
      "Français",
    );
    await wrapper.get('[data-testid="language-add"]').trigger("click");
    await nextTick();
    expect(wrapper.get('[data-testid="language-add-nl"]').text()).toBe("Dutch");
  });

  it("labels the language bar of a language view", async () => {
    const { wrapper } = await openLanguages({
      localization: { locales: ["en", "de", "nl"], languageNames },
    });
    await chooseLanguage(wrapper, "de");
    expect(wrapper.get('[data-testid="language-bar"]').text()).toContain(
      "Editing German",
    );
    expect(
      wrapper.get('[data-testid="language-menu"]').attributes("aria-label"),
    ).toContain("German");
  });

  it("uses full names only when configured or template languages share a language", async () => {
    const content = languageContent();
    content.settings.locale = "en-GB";
    content.settings.locales = ["de-DE"];
    const duplicate = await openLanguages({
      content,
      localization: { locales: ["en-GB", "en-US"] },
    });
    expect(
      duplicate.wrapper.get('[data-testid="language-menu"] .tpl-language-name').text(),
    ).toBe("British English");

    const lone = await openLanguages({
      content: structuredClone(content),
      localization: { locales: ["en-GB", "de-DE"] },
    });
    expect(
      lone.wrapper.get('[data-testid="language-menu"] .tpl-language-name').text(),
    ).toBe("English");
  });

  it("includes a template version outside the configured language list", async () => {
    const content = languageContent();
    content.settings.locale = "en-GB";
    content.settings.locales = ["en-US"];
    const { wrapper } = await openLanguages({
      content,
      localization: { locales: ["en-GB"] },
    });
    expect(
      wrapper.get('[data-testid="language-menu"] .tpl-language-name').text(),
    ).toBe("British English");
  });

  it("includes the template default outside the configured language list", async () => {
    const content = languageContent();
    content.settings.locale = "en-GB";
    content.settings.locales = ["en-US"];
    const { wrapper, editor } = await openLanguages({
      content,
      localization: { locales: ["en-US"] },
    });
    editor.setActiveLocale("en-US");
    await nextTick();
    expect(
      wrapper.get('[data-testid="language-menu"] .tpl-language-name').text(),
    ).toBe("American English");
  });

  it("updates the name when a template version is added after mount", async () => {
    const content = languageContent();
    content.settings.locale = "en-GB";
    content.settings.locales = [];
    const { wrapper, editor } = await openLanguages({
      content,
      localization: { locales: ["en-GB"] },
    });
    const name = () =>
      wrapper.get('[data-testid="language-menu"] .tpl-language-name').text();
    expect(name()).toBe("English");

    const updated = languageContent();
    updated.settings.locale = "en-GB";
    updated.settings.locales = ["en-US"];
    editor.setContent(updated);
    await nextTick();
    expect(name()).toBe("British English");
  });

  it("reaches every language label through useLanguageName", () => {
    const direct = readdirSync(SRC, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(ts|vue)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((file) =>
        /from\s+["'][./]*utils\/languageName["']/.test(
          readFileSync(file, "utf8"),
        ),
      )
      .map((file) => relative(SRC, file).split(sep).join("/"));
    expect(direct).toEqual(["composables/useLanguageName.ts"]);
  });
});
