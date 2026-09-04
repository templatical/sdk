import { describe, expect, it } from "vitest";
import {
  controlDefault,
  isControlForced,
  type BooleanControl,
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
