import { describe, expect, it } from "vitest";
import type { LintOptions } from "@templatical/quality";
import { isLintFullyDisabled as qualityIsLintFullyDisabled } from "@templatical/quality";
import { isLintFullyDisabled as editorIsLintFullyDisabled } from "../src/composables/useTemplateLint";

const keys = ["accessibility", "structure", "links", "deliverability"] as const;

describe("editor lint disable parity", () => {
  it("matches quality for every absent/false key combination, with and without disabled", () => {
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      for (const disabled of [undefined, true]) {
        const options: LintOptions = {};
        for (let index = 0; index < keys.length; index++) {
          if (mask & (1 << index)) options[keys[index]] = false;
        }
        if (disabled !== undefined) options.disabled = disabled;

        expect(editorIsLintFullyDisabled(options), JSON.stringify(options)).toBe(
          qualityIsLintFullyDisabled(options),
        );
      }
    }
  });
});
