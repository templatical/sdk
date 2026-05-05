import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lint(text: string, bg: string, fontSize?: number) {
  const block = createButtonBlock({
    text: "Buy ticket",
    url: "/x",
    textColor: text,
    backgroundColor: bg,
    ...(fontSize !== undefined ? { fontSize } : {}),
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

  it("uses 4.5:1 threshold for default-sized button (15px)", () => {
    // #888888 on white = ~3.5:1. Default fontSize 15 < 24 → strict 4.5:1.
    const issues = lint("#888888", "#ffffff");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/4\.5:1/);
  });

  it("uses 4.5:1 threshold for small button (fontSize 16)", () => {
    const issues = lint("#888888", "#ffffff", 16);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/4\.5:1/);
  });

  it("uses 3:1 threshold for large button (fontSize ≥ 24)", () => {
    // Same ~3.5:1 ratio passes the relaxed 3:1 threshold.
    expect(lint("#888888", "#ffffff", 24)).toEqual([]);
  });

  it("still fires for large button when below 3:1", () => {
    // #bbbbbb on white ≈ 1.95:1 — fails even relaxed 3:1.
    const issues = lint("#bbbbbb", "#ffffff", 28);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/3:1/);
  });
});
