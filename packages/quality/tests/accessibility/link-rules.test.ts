import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type Block,
} from "@templatical/types";
import { lintAccessibility } from "../../src";

function lint(html: string, opts?: Parameters<typeof lintAccessibility>[1]) {
  const block = createParagraphBlock({ content: html });
  const content = createDefaultTemplateContent();
  content.settings.preheaderText = "x";
  content.blocks = [block];
  return { all: lintAccessibility(content, opts), block };
}

describe("link-vague-text", () => {
  it("fires for 'Click here'", () => {
    const { all } = lint('<p><a href="/x">Click here</a></p>');
    const issues = all.filter((i) => i.ruleId === "link-vague-text");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("fires for 'read more' (case insensitive)", () => {
    const { all } = lint('<p><a href="/x">READ MORE</a></p>');
    expect(all.filter((i) => i.ruleId === "link-vague-text")).toHaveLength(1);
  });

  it("does not fire for descriptive text", () => {
    const { all } = lint('<p><a href="/x">Buy spring sale tickets</a></p>');
    expect(all.filter((i) => i.ruleId === "link-vague-text")).toEqual([]);
  });

  it("uses German dictionary when locale=de", () => {
    const { all } = lint('<p><a href="/x">hier klicken</a></p>', {
      locale: "de",
    });
    expect(all.filter((i) => i.ruleId === "link-vague-text")).toHaveLength(1);
  });
});

describe("link-href-empty", () => {
  it("fires for empty href", () => {
    const { all } = lint('<p><a href="">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "link-href-empty")).toHaveLength(1);
  });

  it("fires for href='#'", () => {
    const { all } = lint('<p><a href="#">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "link-href-empty")).toHaveLength(1);
  });

  it("does not fire for real href", () => {
    const { all } = lint('<p><a href="/buy">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "link-href-empty")).toEqual([]);
  });
});

describe("link-target-blank-no-rel", () => {
  it("fires for target=_blank without rel", () => {
    const { all } = lint('<p><a href="/x" target="_blank">Buy</a></p>');
    const issues = all.filter((i) => i.ruleId === "link-target-blank-no-rel");
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeDefined();
  });

  it("does not fire when rel=noopener present", () => {
    const { all } = lint(
      '<p><a href="/x" target="_blank" rel="noopener">Buy</a></p>',
    );
    expect(
      all.filter((i) => i.ruleId === "link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("does not fire when rel=noreferrer present", () => {
    const { all } = lint(
      '<p><a href="/x" target="_blank" rel="noreferrer">Buy</a></p>',
    );
    expect(
      all.filter((i) => i.ruleId === "link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("does not fire when target is not _blank", () => {
    const { all } = lint('<p><a href="/x">Buy</a></p>');
    expect(
      all.filter((i) => i.ruleId === "link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("auto-fix appends rel=noopener", () => {
    const { all, block } = lint(
      '<p><a href="/x" target="_blank">Buy</a></p>',
    );
    const issue = all.find((i) => i.ruleId === "link-target-blank-no-rel")!;
    let patched: Partial<Block> | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch;
      },
      updateSettings: () => {},
    });
    expect(patched).not.toBeNull();
    expect((patched as Partial<Block> & { content: string }).content).toContain(
      'rel="noopener"',
    );
  });

  it("auto-fix preserves existing rel tokens", () => {
    const { all, block } = lint(
      '<p><a href="/x" target="_blank" rel="external">Buy</a></p>',
    );
    const issue = all.find((i) => i.ruleId === "link-target-blank-no-rel")!;
    let patched: { content: string } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id)
          patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    expect(patched!.content).toContain('rel="external noopener"');
  });
});
