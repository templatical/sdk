import { describe, expect, it } from "vitest";
import { createDefaultTemplateContent } from "@templatical/types";
import { lintAccessibility } from "../../src";

describe("missing-preheader", () => {
  it("fires when preheaderText is unset", () => {
    const content = createDefaultTemplateContent();
    const issues = lintAccessibility(content).filter(
      (i) => i.ruleId === "missing-preheader",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
    expect(issues[0].blockId).toBeNull();
  });

  it("fires when preheaderText is whitespace", () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "   ";
    expect(
      lintAccessibility(content).filter(
        (i) => i.ruleId === "missing-preheader",
      ),
    ).toHaveLength(1);
  });

  it("does not fire when preheaderText is set", () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "Spring sale";
    expect(
      lintAccessibility(content).filter(
        (i) => i.ruleId === "missing-preheader",
      ),
    ).toEqual([]);
  });
});
