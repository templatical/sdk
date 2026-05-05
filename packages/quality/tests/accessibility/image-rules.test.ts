import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createImageBlock,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function issuesFor(
  block: ReturnType<typeof createImageBlock>,
  ruleId: string,
) {
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return lintAccessibility(content).filter((i) => i.ruleId === ruleId);
}

describe("img-alt-is-filename", () => {
  it("fires for jpeg-extension alt", () => {
    const block = createImageBlock({ src: "x.png", alt: "hero.jpg" });
    const issues = issuesFor(block, "img-alt-is-filename");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].fix).toBeDefined();
  });

  it("fires for IMG_1234 pattern", () => {
    const block = createImageBlock({ src: "x.png", alt: "IMG_1234" });
    expect(issuesFor(block, "img-alt-is-filename")).toHaveLength(1);
  });

  it("fires for Screen Shot pattern", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "Screen Shot 2026-01-01",
    });
    expect(issuesFor(block, "img-alt-is-filename")).toHaveLength(1);
  });

  it("fires for DSC_0001 pattern (Sony/Nikon camera output)", () => {
    const block = createImageBlock({ src: "x.png", alt: "DSC_0001" });
    expect(issuesFor(block, "img-alt-is-filename")).toHaveLength(1);
  });

  it("fires for DSC-1234 pattern", () => {
    const block = createImageBlock({ src: "x.png", alt: "DSC-1234" });
    expect(issuesFor(block, "img-alt-is-filename")).toHaveLength(1);
  });

  it("does not fire for descriptive alt", () => {
    const block = createImageBlock({ src: "x.png", alt: "Spring sale 30% off" });
    expect(issuesFor(block, "img-alt-is-filename")).toEqual([]);
  });

  it("auto-fix clears the alt", () => {
    const block = createImageBlock({ src: "x.png", alt: "hero.jpg" });
    const issue = issuesFor(block, "img-alt-is-filename")[0];
    let updated: { id: string; patch: Record<string, unknown> } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        updated = { id, patch };
      },
      updateSettings: () => {},
    });
    expect(updated).toEqual({ id: block.id, patch: { alt: "" } });
  });
});

describe("img-alt-too-long", () => {
  it("fires when alt > 125 chars", () => {
    const block = createImageBlock({ src: "x.png", alt: "a".repeat(126) });
    expect(issuesFor(block, "img-alt-too-long")).toHaveLength(1);
  });

  it("does not fire at threshold (125)", () => {
    const block = createImageBlock({ src: "x.png", alt: "a".repeat(125) });
    expect(issuesFor(block, "img-alt-too-long")).toEqual([]);
  });

  it("respects threshold override", () => {
    const block = createImageBlock({ src: "x.png", alt: "a".repeat(50) });
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "x";
    content.blocks = [block];
    const issues = lintAccessibility(content, {
      thresholds: { altMaxLength: 30 },
    }).filter((i) => i.ruleId === "img-alt-too-long");
    expect(issues).toHaveLength(1);
  });
});

describe("img-decorative-needs-empty-alt", () => {
  it("fires when decorative + non-empty alt", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "ignored",
      decorative: true,
    });
    expect(issuesFor(block, "img-decorative-needs-empty-alt")).toHaveLength(1);
  });

  it("does not fire when decorative + empty alt", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "",
      decorative: true,
    });
    expect(issuesFor(block, "img-decorative-needs-empty-alt")).toEqual([]);
  });

  it("does not fire when not decorative", () => {
    const block = createImageBlock({ src: "x.png", alt: "Hero" });
    expect(issuesFor(block, "img-decorative-needs-empty-alt")).toEqual([]);
  });
});

describe("img-linked-no-context", () => {
  it("fires when linked image alt has no action verb", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "Smiling person",
      linkUrl: "/buy",
    });
    expect(issuesFor(block, "img-linked-no-context")).toHaveLength(1);
  });

  it("does not fire when alt contains action verb", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "Buy spring sale tickets",
      linkUrl: "/buy",
    });
    expect(issuesFor(block, "img-linked-no-context")).toEqual([]);
  });

  it("fires when alt only incidentally contains an action-verb substring", () => {
    // "logo" contains the substring "go" — must not be treated as the action verb.
    const block = createImageBlock({
      src: "x.png",
      alt: "Company logo",
      linkUrl: "/about",
    });
    expect(issuesFor(block, "img-linked-no-context")).toHaveLength(1);
  });

  it("fires for alt 'forget password' — 'get' is a substring, not the verb", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "forget password",
      linkUrl: "/reset",
    });
    expect(issuesFor(block, "img-linked-no-context")).toHaveLength(1);
  });

  it("does not fire when image is not linked", () => {
    const block = createImageBlock({ src: "x.png", alt: "Smiling person" });
    expect(issuesFor(block, "img-linked-no-context")).toEqual([]);
  });

  it("does not fire when alt is empty (covered by missing-alt)", () => {
    const block = createImageBlock({
      src: "x.png",
      alt: "",
      linkUrl: "/buy",
    });
    expect(issuesFor(block, "img-linked-no-context")).toEqual([]);
  });
});
