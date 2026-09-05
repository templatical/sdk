import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { capabilities } from "../src/config/capabilities";
import type { Control } from "../src/config/types";

/**
 * Structural guards over `ControlsPane.vue`.
 *
 * Two of the three properties below are invisible to a browser test.
 * Playwright's `fill()` dispatches `input` *and* `change`, so no e2e can tell
 * the two bindings apart — verified by mutation: swapping `@change` for
 * `@input` leaves the whole drawer spec green. And a control kind nobody has
 * registered yet cannot be driven at all. Source text is what is left.
 *
 * The pane is not mountable here: the playground has no `@vue/test-utils` and
 * its `vitest.config.ts` carries no Vue plugin, deliberately, so
 * `@templatical/*` resolves to built `dist`.
 */

const source = readFileSync(
  join(import.meta.dirname, "../src/shell/ControlsPane.vue"),
  "utf8",
);

describe("ControlsPane number input", () => {
  it("binds change, not input", () => {
    expect(source).toContain('@change="onNumberChange(control, $event)"');
    expect(source).not.toContain('@input="onNumberChange(control, $event)"');
  });

  it("states why, so the binding is not 'tidied' back to input", () => {
    expect(source).toContain("Bound to `change`, never `input`");
  });

  it("refuses an emptied field rather than writing zero over the value", () => {
    expect(source).toContain(
      'if (target.validity?.badInput || target.value === "") return;',
    );
  });
});

describe("ControlsPane control-kind coverage", () => {
  it("names every kind in a compile-time exhaustiveness map", () => {
    const map = source.match(
      /const _kindsHandled: Record<Control\["kind"\], true> = \{([^}]*)\}/,
    );
    expect(map).not.toBeNull();

    const named = [...map![1].matchAll(/(\w+):\s*true/g)]
      .map((m) => m[1])
      .sort();
    expect(named).toEqual(["boolean", "enum", "list", "method", "number"]);
  });

  it("gives each kind its own branch rather than a catch-all", () => {
    for (const kind of ["method", "boolean", "enum", "number", "list"]) {
      expect(source).toContain(`'${kind}'`);
    }
    // The final `v-else` is the unsupported-kind row, never an input: a sixth
    // kind must announce itself, not silently render as the last branch.
    expect(source).toContain('v-else-if="control.kind === \'list\'"');
    expect(source).toContain('data-testid="capability-control-unsupported"');
  });

  it("covers every kind the registry actually uses today", () => {
    const used = new Set(
      capabilities.flatMap((capability) =>
        capability.controls.map((control: Control) => control.kind),
      ),
    );
    // Guards the reverse direction: a capability cannot register a kind the
    // pane has no branch for.
    for (const kind of used) {
      expect(source).toContain(`control.kind === '${kind}'`);
    }
    expect([...used].sort()).toEqual(["boolean", "method", "number"]);
  });
});

describe("ControlsPane forced controls", () => {
  it("displays the value a forced control is forced to", () => {
    expect(source).toContain(
      "if (isControlForced(control, resolved.value)) return control.forcedBy?.to;",
    );
  });

  it("binds help and reason to the input via aria-describedby", () => {
    expect(source).toContain(':aria-describedby="describedBy(control)"');
    expect(source).toContain(
      "if (isForced(control)) ids.push(`capability-control-reason-${control.path}`);",
    );
  });
});
