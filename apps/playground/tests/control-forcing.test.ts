import { describe, expect, it } from "vitest";
import { isControlForced } from "../src/config/types";
import {
  buildAllCapabilityConfig,
  capabilities,
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
