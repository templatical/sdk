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

describe("a11y.link-vague-text", () => {
  it("fires for 'Click here'", () => {
    const { all } = lint('<p><a href="/x">Click here</a></p>');
    const issues = all.filter((i) => i.ruleId === "a11y.link-vague-text");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("fires for 'read more' (case insensitive)", () => {
    const { all } = lint('<p><a href="/x">READ MORE</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("does not fire for descriptive text", () => {
    const { all } = lint('<p><a href="/x">Buy spring sale tickets</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toEqual([]);
  });

  it("uses German dictionary when locale=de", () => {
    const { all } = lint('<p><a href="/x">hier klicken</a></p>', {
      locale: "de",
    });
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("fires for vague phrase with trailing exclamation", () => {
    const { all } = lint('<p><a href="/x">Click here!</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("fires for vague phrase with trailing question mark", () => {
    const { all } = lint('<p><a href="/x">Click here?</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("fires for vague phrase with trailing ellipsis", () => {
    const { all } = lint('<p><a href="/x">Read more...</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("fires for vague phrase with leading arrow symbol", () => {
    const { all } = lint('<p><a href="/x">→ click here</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("fires for vague phrase with surrounding punctuation and whitespace", () => {
    const { all } = lint('<p><a href="/x">  »Click here«  </a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toHaveLength(
      1,
    );
  });

  it("does not strip internal punctuation that changes meaning", () => {
    // "click, here" is not a vague phrase; only outer-only stripping.
    const { all } = lint('<p><a href="/x">click, here</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-vague-text")).toEqual([]);
  });
});

describe("a11y.link-href-empty", () => {
  it("fires for empty href", () => {
    const { all } = lint('<p><a href="">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-href-empty")).toHaveLength(
      1,
    );
  });

  it("fires for href='#'", () => {
    const { all } = lint('<p><a href="#">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-href-empty")).toHaveLength(
      1,
    );
  });

  it("does not fire for real href", () => {
    const { all } = lint('<p><a href="/buy">Buy</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-href-empty")).toEqual([]);
  });
});

describe("a11y.link-target-blank-no-rel", () => {
  it("fires for target=_blank without rel", () => {
    const { all } = lint('<p><a href="/x" target="_blank">Buy</a></p>');
    const issues = all.filter(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].fix).toBeDefined();
  });

  it("does not fire when rel=noopener present", () => {
    const { all } = lint(
      '<p><a href="/x" target="_blank" rel="noopener">Buy</a></p>',
    );
    expect(
      all.filter((i) => i.ruleId === "a11y.link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("does not fire when rel=noreferrer present", () => {
    const { all } = lint(
      '<p><a href="/x" target="_blank" rel="noreferrer">Buy</a></p>',
    );
    expect(
      all.filter((i) => i.ruleId === "a11y.link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("does not fire when target is not _blank", () => {
    const { all } = lint('<p><a href="/x">Buy</a></p>');
    expect(
      all.filter((i) => i.ruleId === "a11y.link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("auto-fix appends rel=noopener", () => {
    const { all, block } = lint('<p><a href="/x" target="_blank">Buy</a></p>');
    const issue = all.find(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    )!;
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
    const issue = all.find(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    )!;
    let patched: { content: string } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    expect(patched!.content).toContain('rel="external noopener"');
  });

  it("auto-fix merges into unquoted rel without producing duplicate rel", () => {
    const { all, block } = lint(
      '<p><a href="/x" target="_blank" rel=author>Buy</a></p>',
    );
    const issue = all.find(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    )!;
    let patched: { content: string } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    const matches = patched!.content.match(/\brel\s*=/gi) ?? [];
    expect(matches.length).toBe(1);
    expect(patched!.content).toContain("noopener");
    expect(patched!.content).toContain("author");
  });

  it("auto-fix targets the real rel attr when an earlier attr value contains a 'rel=' substring", () => {
    // Single-quoted data-* whose value literally contains `rel="external"`.
    // The naive `attrs.replace(relAttr.raw, …)` would hit the substring inside
    // data-x first and corrupt the data attribute instead of the actual rel.
    const { all, block } = lint(
      '<p><a data-x=\'rel="external"\' rel="external" target="_blank" href="/x">Buy</a></p>',
    );
    const issue = all.find(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    )!;
    let patched: { content: string } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    // data-x value preserved verbatim.
    expect(patched!.content).toContain(`data-x='rel="external"'`);
    // The actual rel attribute gained noopener (single occurrence).
    expect(patched!.content).toContain('rel="external noopener"');
    // Exactly one rel= attribute on the anchor.
    const relMatches = patched!.content.match(/\srel\s*=/gi) ?? [];
    expect(relMatches.length).toBe(1);
  });

  it("auto-fix repairs unquoted target=_blank", () => {
    const { all, block } = lint('<p><a href="/x" target=_blank>Buy</a></p>');
    const issue = all.find(
      (i) => i.ruleId === "a11y.link-target-blank-no-rel",
    )!;
    let patched: { content: string } | null = null;
    issue.fix!.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    expect(patched).not.toBeNull();
    expect(patched!.content).toContain("noopener");
  });

  function applyRelFix(html: string): string {
    const { all, block } = lint(html);
    const issue = all.find((i) => i.ruleId === "a11y.link-target-blank-no-rel");
    if (issue?.fix === undefined) {
      throw new Error("expected a fixable a11y.link-target-blank-no-rel issue");
    }
    let patched: { content: string } | null = null;
    issue.fix.apply({
      updateBlock: (id, patch) => {
        if (id === block.id) patched = patch as { content: string };
      },
      updateSettings: () => {},
    });
    const content = patched?.content;
    if (content === undefined) {
      throw new Error("expected the fix to update the paragraph");
    }
    return content;
  }

  it("auto-fix rewrites a single-quoted rel without injecting an attribute", () => {
    expect(
      applyRelFix(`<p><a target="_blank" rel='foo" x="'>Buy</a></p>`),
    ).toBe(
      `<p><a target="_blank" rel="foo&quot; x=&quot; noopener">Buy</a></p>`,
    );
  });

  it("auto-fix adds noopener when the target is written with a character reference", () => {
    expect(applyRelFix('<p><a href="/x" target="&#95;blank">Buy</a></p>')).toBe(
      '<p><a href="/x" target="&#95;blank" rel="noopener">Buy</a></p>',
    );
  });

  it("auto-fix decodes named target references the same way as detection", () => {
    expect(
      applyRelFix('<p><a href="/x" target="&lowbar;blank">Buy</a></p>'),
    ).toBe('<p><a href="/x" target="&lowbar;blank" rel="noopener">Buy</a></p>');
  });

  it("does not decode an escaped named reference twice", () => {
    const { all } = lint(
      '<p><a href="/x" target="&amp;lowbar;blank">Buy</a></p>',
    );
    expect(
      all.filter((i) => i.ruleId === "a11y.link-target-blank-no-rel"),
    ).toEqual([]);
  });

  it("auto-fix treats a non-breaking space in rel as part of the token", () => {
    expect(
      applyRelFix(
        '<p><a href="/x" target="_blank" rel="foo&nbsp;noopener">Buy</a></p>',
      ),
    ).toBe(
      '<p><a href="/x" target="_blank" rel="foo&nbsp;noopener noopener">Buy</a></p>',
    );
  });

  it("auto-fix preserves a literal non-breaking space in rel", () => {
    expect(applyRelFix('<p><a target="_blank" rel="\u00a0">Buy</a></p>')).toBe(
      '<p><a target="_blank" rel="\u00a0 noopener">Buy</a></p>',
    );
  });

  it("recognizes noopener after each HTML ASCII whitespace character", () => {
    for (const separator of [" ", "\t", "\n", "\f", "\r"]) {
      const { all } = lint(
        `<p><a href="/x" target="_blank" rel="external${separator}noopener">Buy</a></p>`,
      );
      expect(
        all.filter((i) => i.ruleId === "a11y.link-target-blank-no-rel"),
      ).toEqual([]);
    }
  });

  it("auto-fix skips a commented anchor before the real link", () => {
    expect(
      applyRelFix(
        '<p><!-- <a title=" --> <a href="/x" target="_blank">Buy</a></p>',
      ),
    ).toBe(
      '<p><!-- <a title=" --> <a href="/x" target="_blank" rel="noopener">Buy</a></p>',
    );
  });

  it("auto-fix of double-quoted anchors stays byte-identical", () => {
    expect(applyRelFix('<p><a href="/x" target="_blank">Buy</a></p>')).toBe(
      '<p><a href="/x" target="_blank" rel="noopener">Buy</a></p>',
    );
    expect(
      applyRelFix('<p><a href="/x" target="_blank" rel="external">Buy</a></p>'),
    ).toBe(
      '<p><a href="/x" target="_blank" rel="external noopener">Buy</a></p>',
    );
  });

  it("auto-fix lowercases the anchor tag for double-quoted input", () => {
    expect(
      applyRelFix('<p><A target="_blank" rel="external">Buy</A></p>'),
    ).toBe('<p><a target="_blank" rel="external noopener">Buy</A></p>');
    expect(applyRelFix('<p><A href="/x" target="_blank">Buy</A></p>')).toBe(
      '<p><a href="/x" target="_blank" rel="noopener">Buy</A></p>',
    );
  });

  it("auto-fix keeps a double-quoted rel entity as written", () => {
    expect(applyRelFix('<p><a target="_blank" rel="&copy;">Buy</a></p>')).toBe(
      '<p><a target="_blank" rel="&copy; noopener">Buy</a></p>',
    );
  });

  it("auto-fix re-quotes a single-quoted rel without decoding entities", () => {
    expect(applyRelFix(`<p><a target="_blank" rel='&copy;"'>Buy</a></p>`)).toBe(
      '<p><a target="_blank" rel="&copy;&quot; noopener">Buy</a></p>',
    );
  });
});

describe("a11y.link-nested-anchor", () => {
  it("fires when an anchor opens inside another open anchor", () => {
    const { all, block } = lint(
      '<p><a href="/outer">before <a href="/inner">inner</a> after</a></p>',
    );
    const issues = all.filter((i) => i.ruleId === "a11y.link-nested-anchor");
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(block.id);
    expect(issues[0].severity).toBe("error");
  });

  it("does not fire for sibling anchors", () => {
    const { all } = lint('<p><a href="/a">A</a> and <a href="/b">B</a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-nested-anchor")).toEqual(
      [],
    );
  });

  it("does not fire for a single anchor wrapping formatting", () => {
    const { all } = lint(
      '<p><a href="/x">Hello <strong>world</strong></a></p>',
    );
    expect(all.filter((i) => i.ruleId === "a11y.link-nested-anchor")).toEqual(
      [],
    );
  });

  it("ignores anchor-like tokens inside HTML comments", () => {
    const { all } = lint('<p><a href="/x">x<!-- <a href="/y"> --></a></p>');
    expect(all.filter((i) => i.ruleId === "a11y.link-nested-anchor")).toEqual(
      [],
    );
  });

  it("honours severity override", () => {
    const { all } = lint('<p><a href="/outer"><a href="/inner">x</a></a></p>', {
      accessibility: { rules: { "a11y.link-nested-anchor": "warning" } },
    });
    const issue = all.find((i) => i.ruleId === "a11y.link-nested-anchor");
    expect(issue?.severity).toBe("warning");
  });

  it("can be disabled via severity 'off'", () => {
    const { all } = lint('<p><a href="/outer"><a href="/inner">x</a></a></p>', {
      accessibility: { rules: { "a11y.link-nested-anchor": "off" } },
    });
    expect(all.filter((i) => i.ruleId === "a11y.link-nested-anchor")).toEqual(
      [],
    );
  });
});
