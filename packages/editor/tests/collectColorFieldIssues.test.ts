import { describe, expect, it, vi } from "vitest";
import type {
  CustomBlockColorField,
  CustomBlockDefinition,
  CustomBlockField,
} from "@templatical/types";
import { collectColorFieldIssues } from "../src/utils/collectColorFieldIssues";
import {
  DEFAULT_RESOLVED_COLORS,
  type ResolvedColors,
} from "../src/utils/resolveColorsConfig";

const OPEN_EDITOR: ResolvedColors = {
  presets: ["#abcdef"],
  allowCustom: true,
  allowCustomIgnored: false,
  invalidPresets: [],
};

const LOCKED_EDITOR: ResolvedColors = {
  presets: ["#abcdef"],
  allowCustom: false,
  allowCustomIgnored: false,
  invalidPresets: [],
};

function colorField(
  overrides: Partial<CustomBlockColorField> = {},
): CustomBlockColorField {
  return {
    type: "color",
    key: "accentColor",
    label: "Accent Color",
    ...overrides,
  };
}

function definition(fields: CustomBlockField[]): CustomBlockDefinition {
  return {
    type: "event-details",
    name: "Event Details",
    fields,
    template: "<div />",
  };
}

describe("collectColorFieldIssues — clean configs", () => {
  it("reports nothing for a field that sets no palette at all", () => {
    expect(
      collectColorFieldIssues(definition([colorField()]), OPEN_EDITOR),
    ).toEqual([]);
  });

  it("reports nothing for a valid narrowing field config", () => {
    expect(
      collectColorFieldIssues(
        definition([
          colorField({
            presets: ["#0b5cff", "#111827"],
            allowCustom: false,
            default: "#0b5cff",
          }),
        ]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
  });

  it("ignores non-color fields entirely", () => {
    const issues = collectColorFieldIssues(
      definition([
        { type: "text", key: "title", label: "Title" },
        { type: "number", key: "count", label: "Count" },
        { type: "boolean", key: "featured", label: "Featured" },
      ]),
      LOCKED_EDITOR,
    );
    expect(issues).toEqual([]);
  });

  it("never logs — the caller owns the warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const issues = collectColorFieldIssues(
      definition([colorField({ presets: ["nope"] })]),
      OPEN_EDITOR,
    );

    expect(issues).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("collectColorFieldIssues — invalid preset entries", () => {
  it("lists the skipped entries, naming the block and the field", () => {
    const issues = collectColorFieldIssues(
      definition([
        colorField({ presets: ["#0b5cff", "nope", "#abcd"] }),
      ]),
      OPEN_EDITOR,
    );

    expect(issues).toEqual([
      {
        id: "event-details:accentColor:invalid-presets",
        message:
          'custom block "event-details" field "accentColor": presets ' +
          "skipped invalid entries: nope, #abcd — presets must be hex " +
          "colors (#rgb or #rrggbb).",
      },
    ]);
  });

  it("adds the inherit note when no valid entry survives", () => {
    const issues = collectColorFieldIssues(
      definition([colorField({ presets: ["nope", "#12"] })]),
      OPEN_EDITOR,
    );

    expect(issues).toEqual([
      {
        id: "event-details:accentColor:invalid-presets",
        message:
          'custom block "event-details" field "accentColor": presets ' +
          "skipped invalid entries: nope, #12 — presets must be hex colors " +
          "(#rgb or #rrggbb). No valid entries are left, so the field " +
          "inherits colors.presets.",
      },
    ]);
  });

  it("does not report invalid entries inherited from the editor config", () => {
    const dirtyEditor: ResolvedColors = {
      ...OPEN_EDITOR,
      invalidPresets: ["not-a-color"],
    };
    expect(
      collectColorFieldIssues(definition([colorField()]), dirtyEditor),
    ).toEqual([]);
  });
});

describe("collectColorFieldIssues — empty presets", () => {
  it("reports an explicitly empty list as ignored", () => {
    const issues = collectColorFieldIssues(
      definition([colorField({ presets: [] })]),
      OPEN_EDITOR,
    );

    expect(issues).toEqual([
      {
        id: "event-details:accentColor:empty-presets",
        message:
          'custom block "event-details" field "accentColor": presets is ' +
          "empty — a field palette can only narrow the editor's, so an empty " +
          "list is ignored and the field inherits colors.presets.",
      },
    ]);
  });
});

describe("collectColorFieldIssues — allowCustom cannot widen", () => {
  it("reports allowCustom:true under a locked editor", () => {
    const issues = collectColorFieldIssues(
      definition([colorField({ allowCustom: true })]),
      LOCKED_EDITOR,
    );

    expect(issues).toEqual([
      {
        id: "event-details:accentColor:allow-custom-ignored",
        message:
          'custom block "event-details" field "accentColor": allowCustom: ' +
          "true is ignored because colors.allowCustom is false — a field can " +
          "narrow the editor-wide palette, never unlock it.",
      },
    ]);
  });

  it("says nothing about allowCustom:true under an unlocked editor", () => {
    expect(
      collectColorFieldIssues(
        definition([colorField({ allowCustom: true })]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
  });
});

describe("collectColorFieldIssues — off-palette default", () => {
  it("reports a default the field's own locked palette can't reselect", () => {
    const issues = collectColorFieldIssues(
      definition([
        colorField({
          presets: ["#0b5cff", "#111827"],
          allowCustom: false,
          default: "#7c3aed",
        }),
      ]),
      OPEN_EDITOR,
    );

    expect(issues).toEqual([
      {
        id: "event-details:accentColor:off-palette-default",
        message:
          'custom block "event-details" field "accentColor" locks custom ' +
          "colours, but its default #7c3aed falls outside the field's " +
          "presets: #0b5cff, #111827. New blocks start on a colour the " +
          "picker can't reselect — set the default from the same palette.",
      },
    ]);
  });

  it("compares through the canonical hex form", () => {
    // `#ABC` and `#aabbcc` are the same colour; a case/shorthand difference
    // must not read as off-palette.
    expect(
      collectColorFieldIssues(
        definition([
          colorField({
            presets: ["#ABC"],
            allowCustom: false,
            default: "#aabbcc",
          }),
        ]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
  });

  it("audits the default against the INHERITED palette when the field has none", () => {
    const issues = collectColorFieldIssues(
      definition([colorField({ default: "#7c3aed" })]),
      LOCKED_EDITOR,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe("event-details:accentColor:off-palette-default");
    expect(issues[0].message).toContain("presets: #abcdef");
  });

  it("stays silent while the field is unlocked", () => {
    // The wheel is available, so an off-palette default is always reselectable
    // — same gate as the editor-wide defaults audit.
    expect(
      collectColorFieldIssues(
        definition([
          colorField({ presets: ["#0b5cff"], default: "#7c3aed" }),
        ]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
  });

  it("treats an absent default as the unset seed the none chip reselects", () => {
    // `createCustomBlock` seeds `field.default ?? ""`, and the locked grid
    // leads with a none chip for exactly that state.
    expect(
      collectColorFieldIssues(
        definition([colorField({ presets: ["#0b5cff"], allowCustom: false })]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
    expect(
      collectColorFieldIssues(
        definition([
          colorField({
            presets: ["#0b5cff"],
            allowCustom: false,
            default: "",
          }),
        ]),
        OPEN_EDITOR,
      ),
    ).toEqual([]);
  });

  it("exempts a lock with no palette anywhere (the picker keeps the wheel)", () => {
    expect(
      collectColorFieldIssues(
        definition([colorField({ allowCustom: false, default: "#7c3aed" })]),
        DEFAULT_RESOLVED_COLORS,
      ),
    ).toEqual([]);
  });
});

describe("collectColorFieldIssues — field walking", () => {
  it("audits repeater sub-fields under a parent[].child path", () => {
    const issues = collectColorFieldIssues(
      definition([
        {
          type: "repeatable",
          key: "items",
          label: "Items",
          fields: [
            { type: "text", key: "label", label: "Label" },
            colorField({ key: "swatch", presets: ["nope"] }),
          ],
        },
      ]),
      OPEN_EDITOR,
    );

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe(
      "event-details:items[].swatch:invalid-presets",
    );
    expect(issues[0].message).toContain('field "items[].swatch"');
  });

  it("keeps a top-level field distinct from a repeater child of the same key", () => {
    const issues = collectColorFieldIssues(
      definition([
        colorField({ key: "swatch", presets: [] }),
        {
          type: "repeatable",
          key: "items",
          label: "Items",
          fields: [colorField({ key: "swatch", presets: [] })],
        },
      ]),
      OPEN_EDITOR,
    );

    expect(issues.map((issue) => issue.id)).toEqual([
      "event-details:swatch:empty-presets",
      "event-details:items[].swatch:empty-presets",
    ]);
  });

  it("reports every offending issue on one field", () => {
    const issues = collectColorFieldIssues(
      definition([
        colorField({
          presets: ["#0b5cff", "nope"],
          allowCustom: true,
          default: "#7c3aed",
        }),
      ]),
      LOCKED_EDITOR,
    );

    // Invalid entry, the ignored unlock attempt, and a default outside the
    // narrowed palette that the inherited lock keeps in force.
    expect(issues.map((issue) => issue.id)).toEqual([
      "event-details:accentColor:invalid-presets",
      "event-details:accentColor:allow-custom-ignored",
      "event-details:accentColor:off-palette-default",
    ]);
  });
});
