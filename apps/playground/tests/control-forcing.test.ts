import { afterEach, describe, expect, it, vi } from "vitest";
import {
  controlDefault,
  isControlForced,
  type BooleanControl,
  type Control,
  type ControlState,
} from "../src/config/types";
import {
  buildAllCapabilityConfig,
  capabilities,
  resolveControlState,
} from "../src/config/capabilities";
import { versionHistoryCapability } from "../src/config/capabilities/version-history";
import { TEMPLATES_SAVE_PATH } from "../src/config/capabilities/templates";

const restoreControl = versionHistoryCapability.controls.find(
  (c) => c.path === "versionHistory.restore",
)!;

describe("isControlForced", () => {
  it("reports a control unforced when its trigger is absent", () => {
    expect(isControlForced(restoreControl, {})).toBe(false);
  });

  it("reports a control unforced when the trigger holds another value", () => {
    expect(
      isControlForced(restoreControl, { [TEMPLATES_SAVE_PATH]: true }),
    ).toBe(false);
  });

  it("reports a control forced when the trigger matches", () => {
    expect(
      isControlForced(restoreControl, { [TEMPLATES_SAVE_PATH]: false }),
    ).toBe(true);
  });

  it("names the control responsible, so the drawer can say why", () => {
    expect(restoreControl.forcedBy?.path).toBe(TEMPLATES_SAVE_PATH);
    expect(restoreControl.forcedBy?.reason).toContain("templates.save");
  });

  it("reports an undeclared control as never forced", () => {
    // version-history's only control is `restore`, and it always declares
    // forcedBy — so an undeclared control has to come from another capability.
    const undeclared = capabilities
      .flatMap((c) => c.controls)
      .filter((c) => c.forcedBy === undefined);
    expect(undeclared.length).toBeGreaterThan(0);
    expect(
      isControlForced(undeclared[0], { [TEMPLATES_SAVE_PATH]: false }),
    ).toBe(false);
  });
});

/**
 * The declaration exists so the drawer can disable a control and explain it.
 * If it ever disagrees with what `build()` actually produces, the drawer would
 * explain something the config does not do — worse than no declaration at all.
 */
describe("every forcedBy declaration matches what build() actually does", () => {
  const declared = capabilities.flatMap((cap) =>
    cap.controls
      .filter((control) => control.forcedBy !== undefined)
      .map((control) => ({ cap, control })),
  );

  it("covers at least the version-history restore case", () => {
    expect(declared.map(({ control }) => control.path)).toContain(
      "versionHistory.restore",
    );
  });

  it.each(declared.map(({ cap, control }) => [cap.id, control.path] as const))(
    "%s / %s is forced in the built config exactly when declared",
    (capId, path) => {
      const cap = capabilities.find((c) => c.id === capId)!;
      const control = cap.controls.find((c) => c.path === path)!;
      const { path: triggerPath, when, to } = control.forcedBy!;

      // Trigger set: the built value must equal what the declaration promises,
      // even with this control explicitly set the other way.
      const forcedState = { [triggerPath]: when, [path]: !to };
      const forced = buildAllCapabilityConfig(forcedState);
      expect(readConfigPath(forced, path)).toEqual(to);

      // Trigger absent: the control's own value must win.
      const freeState = { [path]: !to };
      const free = buildAllCapabilityConfig(freeState);
      expect(readConfigPath(free, path)).not.toEqual(to);
    },
  );
});

describe("resolveControlState", () => {
  it("fills every registered control path with its own default when state is empty", () => {
    const expected: ControlState = {};
    for (const def of capabilities) {
      for (const control of def.controls) {
        expected[control.path] = controlDefault(control);
      }
    }
    expect(resolveControlState({})).toEqual(expected);

    // Spot-check concrete values from the real registry, so the assertion
    // above isn't only a comparison against the same helper it calls.
    expect(expected[TEMPLATES_SAVE_PATH]).toBe(true);
    expect(expected["savedBlocks.listDelayMs"]).toBe(0);
    expect(expected["templates.autoSave"]).toBe(false);
  });

  it("keeps an explicitly-set value over the control's default", () => {
    const resolved = resolveControlState({ [TEMPLATES_SAVE_PATH]: false });
    expect(resolved[TEMPLATES_SAVE_PATH]).toBe(false);
  });

  it("does not mutate its argument", () => {
    const state: ControlState = { [TEMPLATES_SAVE_PATH]: false };
    const resolved = resolveControlState(state);
    expect(state).toEqual({ [TEMPLATES_SAVE_PATH]: false });
    expect(resolved).not.toBe(state);
  });
});

/**
 * The coincidence named in the finding: a `forcedBy.when` that equals the
 * trigger control's own implicit default. `templates.save` is a `method`
 * control with no explicit `default`, so `controlDefault` resolves its
 * default to `true` — the same value this fixture's `forcedBy.when` holds.
 * A local fixture control stands in for the forced side, since the point
 * under test is `isControlForced`'s state precondition, not any shipped
 * capability's own behavior — the trigger side is real (`TEMPLATES_SAVE_PATH`)
 * so `resolveControlState` resolves it exactly as it would in production.
 */
describe("isControlForced against a trigger's own default", () => {
  const fixtureControl: BooleanControl = {
    kind: "boolean",
    path: "fixture.coincidence",
    label: "fixture",
    help: "",
    forcedBy: {
      path: TEMPLATES_SAVE_PATH,
      when: true,
      to: false,
      reason: "fixture: when equals the trigger's own implicit default.",
    },
  };

  it("reports not forced against raw, unresolved sparse state", () => {
    expect(isControlForced(fixtureControl, {})).toBe(false);
  });

  it("reports forced once defaults are resolved onto that same sparse state", () => {
    const resolved = resolveControlState({});
    expect(isControlForced(fixtureControl, resolved)).toBe(true);
  });
});

/** Read a dotted control path out of a built config object. */
function readConfigPath(config: object, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      config,
    );
}

/**
 * `buildAllCapabilityConfig` is the only caller that can resolve state the
 * way `isControlForced` needs it: `buildCapabilityConfig` fills one
 * capability's own control defaults, and a `build()` that reads ANOTHER
 * capability's path — `version-history` reads `templates.save` — would see
 * `undefined` for a key merely absent from storage. Resolution therefore has
 * to happen once, across the whole registry, before any `build()` runs.
 */
describe("buildAllCapabilityConfig hands build() whole-registry resolved state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves every registered control's default before any build() runs", () => {
    // Sets one capability's control and nothing else, so the state each
    // `build()` receives can only carry the others' defaults by resolution.
    const input: ControlState = { "savedBlocks.create": false };
    const spies = capabilities.map((cap) => ({
      id: cap.id,
      spy: vi.spyOn(cap, "build"),
    }));

    buildAllCapabilityConfig(input);

    const expected = resolveControlState(input);
    for (const { id, spy } of spies) {
      expect(spy, id).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0], id).toEqual(expected);
    }
  });

  it("gives a cross-capability read the trigger's default, not undefined", () => {
    // The concrete case the registry already contains: version-history's
    // `build` reads `templates.save`, which this state never sets.
    const spy = vi.spyOn(versionHistoryCapability, "build");
    buildAllCapabilityConfig({});

    const seen = spy.mock.calls[0][0];
    expect(TEMPLATES_SAVE_PATH in seen).toBe(true);
    expect(seen[TEMPLATES_SAVE_PATH]).toBe(true);
  });

  it("still lets an explicitly-set value through untouched", () => {
    const spy = vi.spyOn(versionHistoryCapability, "build");
    buildAllCapabilityConfig({ [TEMPLATES_SAVE_PATH]: false });
    expect(spy.mock.calls[0][0][TEMPLATES_SAVE_PATH]).toBe(false);
  });
});

/**
 * The two readings of one `forcedBy` declaration: the drawer disables a
 * control from `isControlForced`, and the editor is configured by `build()`.
 * The table above pins each side against the declaration; this one pins them
 * against EACH OTHER, across the trigger states that tell resolved state
 * apart from raw — absent, explicitly set to the trigger's own default, and
 * explicitly set to the forcing value.
 *
 * `it.each` runs over whatever the registry declares, so a future `forcedBy`
 * is covered without editing this file. That matters most for the shape the
 * current declaration does not have: a `when` equal to its trigger's own
 * default, where an unresolved `build()` and a resolved `isControlForced`
 * disagree outright.
 */
describe("isControlForced agrees with buildAllCapabilityConfig", () => {
  const declared = capabilities.flatMap((cap) =>
    cap.controls
      .filter((control) => control.forcedBy !== undefined)
      .map((control) => ({ capId: cap.id, control })),
  );

  const registered = new Map(
    capabilities.flatMap((cap) => cap.controls.map((c) => [c.path, c] as const)),
  );

  /** The three trigger states, per declaration. */
  const cases = declared.flatMap(({ capId, control }) => {
    const { path: triggerPath, when } = control.forcedBy!;
    const trigger = registered.get(triggerPath)!;
    return (
      [
        ["trigger absent", {}],
        [
          "trigger set to its own default",
          { [triggerPath]: controlDefault(trigger) },
        ],
        ["trigger set to the forcing value", { [triggerPath]: when }],
      ] as [string, ControlState][]
    ).map(
      ([label, triggerState]) =>
        [capId, control.path, label, triggerState] as const,
    );
  });

  it("has declarations to compare", () => {
    expect(declared.length).toBeGreaterThan(0);
    expect(cases).toHaveLength(declared.length * 3);
  });

  it.each(declared.map(({ control }) => [control.path] as const))(
    "%s names a trigger that is itself a registered control",
    (path) => {
      const control = registered.get(path)!;
      // An unregistered trigger has no default for `resolveControlState` to
      // fill, so it stays absent and the two sides compare `undefined`
      // against `when` forever — a declaration that can never fire.
      expect(registered.has(control.forcedBy!.path)).toBe(true);
    },
  );

  it("exercises both a forced and an unforced outcome", () => {
    // Without this, a table whose every row happened to resolve "unforced"
    // would still pass row by row while proving nothing about forcing.
    const outcomes = new Set(
      cases.map(([capId, path, , triggerState]) =>
        isControlForced(
          controlAt(capId, path),
          resolveControlState(stateFor(capId, path, triggerState)),
        ),
      ),
    );
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it.each(cases)("%s / %s — %s", (capId, path, _label, triggerState) => {
    const control = controlAt(capId, path);
    const { to } = control.forcedBy!;
    const state = stateFor(capId, path, triggerState);

    const declaresForced = isControlForced(control, resolveControlState(state));
    const configIsForced =
      readConfigPath(buildAllCapabilityConfig(state), path) === to;

    expect(configIsForced).toBe(declaresForced);
  });

  function controlAt(capId: string, path: string): Control {
    return capabilities
      .find((c) => c.id === capId)!
      .controls.find((c) => c.path === path)!;
  }

  /**
   * The trigger state plus this control set AWAY from what it would be forced
   * to, so "the built value equals `to`" can only be the forcing's doing.
   */
  function stateFor(
    capId: string,
    path: string,
    triggerState: ControlState,
  ): ControlState {
    return { ...triggerState, [path]: unforcedValue(controlAt(capId, path)) };
  }
});

/**
 * A value for `control` that its own `build()` will not turn into
 * `forcedBy.to`. Throws rather than guessing for a kind no declaration uses
 * yet, so a future `forcedBy` on an enum or a list has to extend this
 * deliberately instead of silently comparing `to` against `to`.
 */
function unforcedValue(control: Control): unknown {
  const to = control.forcedBy!.to;
  if (control.kind === "method" || control.kind === "boolean") {
    expect(typeof to).toBe("boolean");
    return !to;
  }
  throw new Error(
    `no unforced value defined for a ${control.kind} control (${control.path})`,
  );
}
