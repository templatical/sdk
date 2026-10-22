import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import { resolveDeliverabilityOptions, resolveStructureOptions, runRules } from "../src/run-rules";
import { DEFAULT_SHORTENER_HOSTS } from "../src";
import type { Rule } from "../src/types";

describe("runRules message variants", () => {
  const rule: Rule = {
    meta: {
      id: "test.variant",
      severity: "warning",
      reference: "https://docs.templatical.com/quality/structure/rule-catalog#tree-integrity",
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
        return { message: `message for ${messageId}`, suggestion: "Fix the variant." };
      },
    );
    expect(seen).toEqual(["test.variant.b"]);
    expect(issues[0]).toMatchObject({
      ruleId: "test.variant",
      message: "message for test.variant.b",
      suggestion: "Fix the variant.",
      reference: "https://docs.templatical.com/quality/structure/rule-catalog#tree-integrity",
    });
  });
});

describe("resolveDeliverabilityOptions", () => {
  it("uses the default threshold and shortener hosts", () => {
    const resolved = resolveDeliverabilityOptions("en", {}, []);
    expect(resolved.deliverability).toEqual({
      minTextLength: 200,
      shortenerHosts: DEFAULT_SHORTENER_HOSTS,
    });
  });

  it("applies threshold and host overrides", () => {
    const resolved = resolveDeliverabilityOptions("de", {
      thresholds: { minTextLength: 50 },
      shortenerHosts: ["go.example.com"],
    }, []);
    expect(resolved.deliverability).toEqual({
      minTextLength: 50,
      shortenerHosts: ["go.example.com"],
    });
    expect(resolved.locale).toBe("de");
  });
});
