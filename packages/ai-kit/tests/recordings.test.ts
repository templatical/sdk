import { describe, expect, it } from "vitest";
import { createParagraphBlock } from "@templatical/types";
import {
  AI_EVAL_TEMPLATES,
  AI_RECORDINGS,
  createMockAiProvider,
  createStandInEditor,
} from "../src/testing";

const base = {
  templateId: "t-1",
  content: AI_EVAL_TEMPLATES.welcome,
  revision: null,
  sessionId: "s-1",
  mergeTags: { syntax: "liquid" as const, tags: [] },
};

describe("AI_RECORDINGS", () => {
  it("explains when a template has no title and leaves its content intact", async () => {
    const content = {
      ...base.content,
      blocks: base.content.blocks.filter((block) => block.type !== "title"),
    };
    const provider = createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0 });
    if (!provider.chat) throw new Error("The recordings must enable chat.");
    const editor = createStandInEditor(content);
    const handlers = editor.handlers();
    expect(
      await provider.chat(
        {
          ...base,
          content,
          message: "Change the headline",
          selectedBlockId: null,
        },
        handlers,
        new AbortController().signal,
      ),
    ).toEqual({
      messageId: null,
      text: "This template has no title to change.",
    });
    expect(handlers.text).toBe("This template has no title to change.");
    expect(editor.content).toEqual(content);
    expect(editor.applied).toEqual([]);
  });

  it.each(["headline", "intro"])(
    "fixes a text finding by shortening %s",
    async (blockId) => {
      const provider = createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0 });
      if (!provider.fixFinding)
        throw new Error("The recordings must enable fixing findings.");
      const editor = createStandInEditor(base.content);
      const finding = {
        ruleId: "custom.too-long",
        reference: "https://docs.templatical.com/quality/",
        blockId,
        message: "Too long.",
        suggestion: "Shorten.",
      };
      expect(
        await provider.fixFinding(
          { ...base, finding },
          editor.handlers(),
          new AbortController().signal,
        ),
      ).toEqual({ messageId: null, text: "Shortening that block. Fixed." });
      expect(editor.applied).toEqual([
        [
          {
            op: "updateBlock",
            blockId,
            set: { content: "<p>A shorter, clearer line.</p>" },
          },
        ],
      ]);
      expect(
        editor.content.blocks.find((block) => block.id === blockId),
      ).toMatchObject({ content: "<p>A shorter, clearer line.</p>" });
    },
  );

  it.each(["cta", "missing", null])(
    "fixes a template finding with a preheader when its target is %s",
    async (blockId) => {
      const provider = createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0 });
      if (!provider.fixFinding)
        throw new Error("The recordings must enable fixing findings.");
      const editor = createStandInEditor(base.content);
      const finding = {
        ruleId: "a11y.missing-preheader",
        reference: "https://docs.templatical.com/quality/",
        blockId,
        message: "No preheader.",
        suggestion: "Add one.",
      };
      expect(
        await provider.fixFinding(
          { ...base, finding },
          editor.handlers(),
          new AbortController().signal,
        ),
      ).toEqual({ messageId: null, text: "Adding a preheader. Fixed." });
      expect(editor.applied).toEqual([
        [
          {
            op: "updateSettings",
            set: { preheaderText: "Your update from Acme" },
          },
        ],
      ]);
      expect(editor.content).toEqual({
        ...base.content,
        settings: {
          ...base.content.settings,
          preheaderText: "Your update from Acme",
        },
      });
    },
  );
});

describe("AI_RECORDINGS lint fixes", () => {
  it.each([
    ["a11y.link-vague-text", "click here", "Read the March update"],
    ["deliverability.link-text-domain-mismatch", "www.acme.com", "Visit Acme"],
  ])(
    "fixes %s with one update while preserving the href and surrounding HTML",
    async (ruleId, label, replacement) => {
      const before = `<p>Before <a href="https://tracking.example.net/r/1" title="March"><strong>${label}</strong></a> after <a href="https://example.com/other">Other news</a>.</p>`;
      const content = {
        ...base.content,
        blocks: [createParagraphBlock({ id: "link", content: before })],
      };
      const editor = createStandInEditor(content);
      const provider = createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0 });
      if (!provider.fixFinding) throw new Error("Fix must be enabled");
      await provider.fixFinding(
        {
          ...base,
          content,
          finding: {
            ruleId,
            blockId: "link",
            message: "Link text needs a change.",
            suggestion: "Rewrite the visible text.",
            reference: "https://docs.templatical.com/quality/",
          },
        },
        editor.handlers(),
        new AbortController().signal,
      );
      expect(editor.applied).toEqual([
        [
          {
            op: "updateBlock",
            blockId: "link",
            set: {
              content: `<p>Before <a href="https://tracking.example.net/r/1" title="March">${replacement}</a> after <a href="https://example.com/other">Other news</a>.</p>`,
            },
          },
        ],
      ]);
    },
  );
});
