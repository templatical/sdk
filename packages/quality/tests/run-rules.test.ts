import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import { resolveStructureOptions, runRules } from "../src/run-rules";
import type { Rule } from "../src/types";

describe("runRules message variants", () => {
  const rule: Rule = {
    meta: {
      id: "test.variant",
      severity: "warning",
      messageVariants: ["a", "b"],
    },
    block: (block) =>
      block.type === "section" ? { blockId: block.id, messageVariant: "b" } : null,
  };

  it("formats a hit's message from its variant's key", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createSectionBlock()];
    const seen: string[] = [];
    const issues = runRules(
      content,
      [rule],
      resolveStructureOptions("en", {}, [rule]),
      (_locale, messageId) => {
        seen.push(messageId);
        return `message for ${messageId}`;
      },
    );
    expect(seen).toEqual(["test.variant.b"]);
    expect(issues[0]).toMatchObject({
      ruleId: "test.variant",
      message: "message for test.variant.b",
    });
  });
});
