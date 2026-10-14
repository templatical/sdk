// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createDefaultTemplateContent } from "@templatical/types";
import { afterEach, describe, expect, it } from "vitest";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations, type Translations } from "../src/i18n";
import EditorFooter from "../src/components/EditorFooter.vue";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

const TRANSLATIONS = {
  footer: { poweredBy: "Powered by" },
} as unknown as Translations;

const mountFooter = () =>
  mountEditor(EditorFooter, { provides: { [TRANSLATIONS_KEY]: TRANSLATIONS } });

describe("EditorFooter", () => {
  it("credits Templatical with one link and no licence label", () => {
    const wrapper = mountFooter();
    expect(wrapper.text().replace(/\s+/g, " ").trim()).toBe(
      "Powered by Templatical",
    );
    expect(wrapper.findAll("a").map((a) => a.attributes("href"))).toEqual([
      "https://templatical.com",
    ]);
  });

  it("draws the mark inline instead of fetching it", () => {
    const wrapper = mountFooter();
    expect(wrapper.findAll("img")).toHaveLength(0);
    const mark = wrapper.find("a svg");
    expect(mark.attributes("aria-hidden")).toBe("true");
    expect(mark.attributes("width")).toBe("14");
    expect(mark.attributes("viewBox")).toBe("0 0 32 32");
    expect(mark.html()).not.toMatch(/https?:\/\//);
  });
});

/**
 * license-faq.md tells embedders that `branding: false` hides the footer. The
 * flag is read in Editor.vue's own template, so a case that provides keys
 * straight into EditorFooter cannot see it: these mount the real Editor.vue
 * with a real config.
 */
describe("config.branding on the real Editor.vue", () => {
  let editor: VueWrapper | undefined;

  afterEach(() => {
    editor?.unmount();
    editor = undefined;
  });

  async function mountRealEditor(config: Record<string, unknown> = {}) {
    const translations = await loadTranslations("en");
    editor = mount(Editor, {
      props: {
        config: {
          container: document.createElement("div"),
          content: createDefaultTemplateContent(),
          ...config,
        },
        translations,
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true } },
    });
    return editor;
  }

  it.each([
    ["no branding key", {}],
    ["branding: true", { branding: true }],
  ])(
    "renders the credit and one link to templatical.com with %s",
    async (_label, config) => {
      const wrapper = await mountRealEditor(config);
      const footer = wrapper.findComponent(EditorFooter);
      expect(footer.exists()).toBe(true);
      expect(footer.text().replace(/\s+/g, " ").trim()).toBe(
        "Powered by Templatical",
      );
      expect(wrapper.findAll('a[href="https://templatical.com"]')).toHaveLength(
        1,
      );
    },
  );

  it("renders no footer for branding: false", async () => {
    const wrapper = await mountRealEditor({ branding: false });
    expect(wrapper.findComponent(EditorFooter).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Powered by");
    expect(wrapper.findAll('a[href="https://templatical.com"]')).toHaveLength(
      0,
    );
  });
});

/**
 * installation.md promises that init() makes no requests to Templatical. Only
 * src/cloud talks to Templatical, by design, so it is excluded.
 */
describe("requests to templatical.com", () => {
  const SRC = join(import.meta.dirname, "../src");
  const REMOTE_ASSET =
    /(?:\bsrc=|url\(|fetch\()\s*["'`]?https?:\/\/(?:[a-z0-9-]+\.)*templatical\.com/;

  function walk(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      const rel = relative(SRC, abs).split(sep).join("/");
      if (statSync(abs).isDirectory()) {
        if (rel !== "cloud") walk(abs, acc);
      } else if (/\.(vue|ts)$/.test(name)) {
        acc.push(rel);
      }
    }
    return acc;
  }

  it("no editor source outside src/cloud loads anything from templatical.com", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(50);
    const hits = files.flatMap((rel) =>
      readFileSync(join(SRC, rel), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          REMOTE_ASSET.test(line) ? [`${rel}:${i + 1}`] : [],
        ),
    );
    expect(hits).toEqual([]);
  });
});
