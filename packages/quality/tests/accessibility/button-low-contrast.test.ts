import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lint(text: string, bg: string) {
  const block = createButtonBlock({
    text: "Buy ticket",
    url: "/x",
    textColor: text,
    backgroundColor: bg,
  });
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return lintAccessibility(content).filter(
    (i) => i.ruleId === "button-low-contrast",
  );
}

describe("button-low-contrast", () => {
  it("fires when contrast is below 4.5:1", () => {
    const issues = lint("#aaaaaa", "#cccccc");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("does not fire when contrast is above 4.5:1", () => {
    expect(lint("#000000", "#ffffff")).toEqual([]);
  });

  it("does not fire when colors are unparseable", () => {
    expect(lint("transparent", "rgb(0,0,0)")).toEqual([]);
  });

  it("includes computed ratio in the message", () => {
    const issues = lint("#aaaaaa", "#cccccc");
    expect(issues[0].message).toMatch(/\d\.\d{2}:1/);
  });
});
