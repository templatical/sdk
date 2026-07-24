import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RESOLVED_COLORS,
  type ResolvedColors,
} from "../src/utils/resolveColorsConfig";
import { resolveFieldColors } from "../src/utils/resolveFieldColors";

/** An unlocked editor palette (wheel + hex still offered). */
const OPEN_EDITOR: ResolvedColors = {
  presets: ["#abcdef", "#123456"],
  allowCustom: true,
  allowCustomIgnored: false,
  invalidPresets: [],
};

/** A locked editor palette — the brand-kit case a field may not unlock. */
const LOCKED_EDITOR: ResolvedColors = {
  presets: ["#abcdef", "#123456"],
  allowCustom: false,
  allowCustomIgnored: false,
  invalidPresets: [],
};

describe("resolveFieldColors — presets", () => {
  it("inherits the editor palette when the field sets no presets", () => {
    expect(resolveFieldColors({}, OPEN_EDITOR)).toEqual({
      presets: ["#abcdef", "#123456"],
      allowCustom: true,
      invalidPresets: [],
      emptyPresets: false,
      presetsInherited: true,
      allowCustomIgnored: false,
    });
  });

  it("replaces the editor palette with the field's own valid presets", () => {
    expect(
      resolveFieldColors({ presets: ["#0b5cff", "#fff"] }, OPEN_EDITOR),
    ).toEqual({
      presets: ["#0b5cff", "#fff"],
      allowCustom: true,
      invalidPresets: [],
      emptyPresets: false,
      presetsInherited: false,
      allowCustomIgnored: false,
    });
  });

  it("inherits the editor palette for an explicitly empty list, flagging it", () => {
    // `[]` used to mean "no chips"; it now narrows nothing, because an empty
    // grid on a locked field would leave the picker with nothing to pick.
    expect(resolveFieldColors({ presets: [] }, OPEN_EDITOR)).toEqual({
      presets: ["#abcdef", "#123456"],
      allowCustom: true,
      invalidPresets: [],
      emptyPresets: true,
      presetsInherited: true,
      allowCustomIgnored: false,
    });
  });

  it("keeps the valid subset and collects the invalid entries", () => {
    expect(
      resolveFieldColors(
        { presets: ["#0b5cff", "nope", "#abcd", "#abc"] },
        OPEN_EDITOR,
      ),
    ).toEqual({
      presets: ["#0b5cff", "#abc"],
      allowCustom: true,
      invalidPresets: ["nope", "#abcd"],
      emptyPresets: false,
      presetsInherited: false,
      allowCustomIgnored: false,
    });
  });

  it("inherits the editor palette when every field preset is invalid", () => {
    expect(
      resolveFieldColors({ presets: ["nope", "#12"] }, OPEN_EDITOR),
    ).toEqual({
      presets: ["#abcdef", "#123456"],
      allowCustom: true,
      invalidPresets: ["nope", "#12"],
      emptyPresets: false,
      presetsInherited: true,
      allowCustomIgnored: false,
    });
  });

  it("never re-reports invalid entries inherited from the editor palette", () => {
    // The editor level already filtered and warned about its own entries; the
    // field's `invalidPresets` reflects only what the FIELD supplied.
    const dirtyEditor: ResolvedColors = {
      presets: ["#111111"],
      allowCustom: true,
      allowCustomIgnored: false,
      invalidPresets: ["not-a-color"],
    };
    expect(resolveFieldColors({}, dirtyEditor).invalidPresets).toEqual([]);
  });

  it("resolves against the unconfigured baseline with no editor colors config", () => {
    expect(
      resolveFieldColors(
        { presets: ["#111111"], allowCustom: false },
        DEFAULT_RESOLVED_COLORS,
      ),
    ).toEqual({
      presets: ["#111111"],
      allowCustom: false,
      invalidPresets: [],
      emptyPresets: false,
      presetsInherited: false,
      allowCustomIgnored: false,
    });
  });
});

describe("resolveFieldColors — allowCustom is narrowing-only", () => {
  it("keeps the editor's free-form entry when the field says nothing", () => {
    expect(resolveFieldColors({}, OPEN_EDITOR).allowCustom).toBe(true);
  });

  it("locks a field under an unlocked editor", () => {
    const result = resolveFieldColors(
      { presets: ["#0b5cff"], allowCustom: false },
      OPEN_EDITOR,
    );
    expect(result.allowCustom).toBe(false);
    expect(result.allowCustomIgnored).toBe(false);
  });

  it("inherits the lock when the field says nothing", () => {
    const result = resolveFieldColors({}, LOCKED_EDITOR);
    expect(result.allowCustom).toBe(false);
    expect(result.allowCustomIgnored).toBe(false);
  });

  it("ignores allowCustom:true under a locked editor, flagging it", () => {
    const result = resolveFieldColors({ allowCustom: true }, LOCKED_EDITOR);
    expect(result.allowCustom).toBe(false);
    expect(result.allowCustomIgnored).toBe(true);
  });

  it("does not flag a redundant allowCustom:false under a locked editor", () => {
    const result = resolveFieldColors({ allowCustom: false }, LOCKED_EDITOR);
    expect(result.allowCustom).toBe(false);
    expect(result.allowCustomIgnored).toBe(false);
  });

  it("leaves a lock with no palette anywhere for the picker's own guard", () => {
    // `ColorPicker` renders the wheel whenever there are no presets
    // (`showFreeform = allowCustom || !hasPresets`), so nothing is unusable.
    expect(
      resolveFieldColors({ allowCustom: false }, DEFAULT_RESOLVED_COLORS),
    ).toEqual({
      presets: [],
      allowCustom: false,
      invalidPresets: [],
      emptyPresets: false,
      presetsInherited: true,
      allowCustomIgnored: false,
    });
  });
});

describe("resolveFieldColors — purity", () => {
  it("never logs, even for a fully broken field config", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolveFieldColors(
      { presets: ["nope"], allowCustom: true },
      LOCKED_EDITOR,
    );

    expect(result.invalidPresets).toEqual(["nope"]);
    expect(result.allowCustomIgnored).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("passes valid presets through verbatim, leaving casing to the picker", () => {
    // Membership matching is canonicalized downstream (`canonicalizeHexColor`);
    // the resolver must not rewrite what the author configured, or the rendered
    // chip titles would stop matching the config.
    expect(
      resolveFieldColors({ presets: ["#ABCDEF", "#Fff"] }, OPEN_EDITOR).presets,
    ).toEqual(["#ABCDEF", "#Fff"]);
  });
});
