// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createButtonBlock } from "@templatical/types";
import Toolbar from "../src/components/Toolbar.vue";
import { mountEditor } from "./helpers/mount";
import { FONTS_MANAGER_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

/**
 * The block toolbars' font select lists the block's own font when the options
 * don't include it. The labelling rules are tested on `withCurrentFont`; this
 * pins that `Toolbar.vue` feeds the block's font through it.
 */

const fontsManager = {
  fonts: ref([
    { label: "Arial", value: "Arial" },
    { label: "Helvetica", value: "Helvetica" },
  ]),
  loadCustomFonts: async () => {},
  cleanupFontLinks: () => {},
  setCustomFontsEnabled: () => {},
};

const ButtonToolbar = {
  props: ["fontFamilies"],
  template:
    '<ul data-testid="fonts"><li v-for="f in fontFamilies" :key="f.value" :data-value="f.value">{{ f.label }}</li></ul>',
};

function fontsFor(fontFamily: string | undefined) {
  const wrapper = mountEditor(Toolbar, {
    props: { block: createButtonBlock({ fontFamily }) },
    provides: { [TRANSLATIONS_KEY]: en, [FONTS_MANAGER_KEY]: fontsManager },
    global: { stubs: { ButtonToolbar, CommonBlockSettings: true } },
  });
  return wrapper
    .findAll('[data-testid="fonts"] li')
    .map((li) => [li.attributes("data-value"), li.text()]);
}

describe("toolbar font options", () => {
  it("lists a block's own font stack first when the picker doesn't offer it", () => {
    const stack = "Helvetica Neue, Helvetica, Arial, sans-serif";
    expect(fontsFor(stack)).toEqual([
      [stack, "Helvetica Neue"],
      ["Arial", "Arial"],
      ["Helvetica", "Helvetica"],
    ]);
  });

  it("leaves the list alone for a listed font or none", () => {
    const listed = [
      ["Arial", "Arial"],
      ["Helvetica", "Helvetica"],
    ];
    expect(fontsFor("Arial")).toEqual(listed);
    expect(fontsFor(undefined)).toEqual(listed);
  });
});
