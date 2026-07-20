import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Regression guard for the native-checkbox → ToggleSwitch migration.
 *
 * Every boolean control in the SDK is the custom sliding switch
 * (`components/ToggleSwitch.vue`). A stray `<input type="checkbox">` anywhere in
 * the editor source reintroduces the native/custom inconsistency the migration
 * removed, so scan the whole tree and fail if one reappears.
 *
 * If a native checkbox is ever genuinely required, prefer extending
 * ToggleSwitch to cover the case. Only if that's truly impossible, carve out
 * the specific file here with a documented reason.
 */

const SRC = join(import.meta.dirname, "..", "src");

function listVueFiles(): string[] {
  const entries = readdirSync(SRC, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".vue"))
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

const FILES = listVueFiles();

describe("no native checkboxes in editor source", () => {
  it("source tree was discovered (sanity check)", () => {
    // Guard against the walker silently returning [] (e.g. wrong SRC path).
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("every boolean control uses ToggleSwitch, not <input type=checkbox>", () => {
    const offenders = FILES.filter((relPath) =>
      /type=["']checkbox["']/.test(readFileSync(join(SRC, relPath), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
