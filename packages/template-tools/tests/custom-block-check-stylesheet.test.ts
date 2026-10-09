import { describe, expect, it, vi } from "vitest";

vi.mock("../src/custom-block/render", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/custom-block/render")>();
  return {
    ...actual,
    renderSpecimenMjml: async () => "<mjml><mj-body></mj-body></mjml>",
  };
});

import { checkCustomBlock } from "../src/custom-block/check";

const def = {
  type: "quote",
  name: "Quote",
  fields: [{ key: "text", label: "Text", type: "textarea", default: "Hi" }],
  template:
    '<table role="presentation" width="100%"><tr><td class="tplc-quote-cell">{{ text }}</td></tr></table>',
  stylesheet: ".tplc-quote-cell { font-style: italic; }",
};

describe("checkCustomBlock stylesheet reporting", () => {
  it("errors when the stylesheet is absent from the rendered MJML", async () => {
    expect(await checkCustomBlock(def)).toEqual({
      valid: false,
      issues: [
        {
          ruleId: "render.stylesheet-missing",
          severity: "error",
          message:
            "The stylesheet did not reach <mj-head> in the rendered MJML.",
        },
      ],
    });
  });
});
