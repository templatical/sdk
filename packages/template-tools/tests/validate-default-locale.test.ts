import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  applyOperations,
  invertOperations,
  resolveLocale,
  type Operation,
  type TemplateContent,
} from "../../types/src";
import { validateTemplate } from "../src/validate";

it.each([
  "locale-default-removed-parent.json",
  "locale-default-removed-nested-parent.json",
])(
  "validates a promoted default while preserving the former French subtree: %s",
  (name) => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          import.meta.dirname,
          "../../types/tests/fixtures/operations",
          name,
        ),
        "utf8",
      ),
    ) as { content: TemplateContent; ops: Operation[] };
    const before = fixture.content;
    expect(validateTemplate(before)).toEqual({ valid: true, errors: [] });
    const after = applyOperations(before, fixture.ops);
    expect(validateTemplate(after)).toEqual({ valid: true, errors: [] });
    expect(resolveLocale(after, "fr").blocks[0]).toEqual(
      resolveLocale(before, "fr").blocks[0],
    );
    expect(
      JSON.stringify(
        applyOperations(after, invertOperations(before, fixture.ops)),
      ),
    ).toBe(JSON.stringify(before));
  },
);
