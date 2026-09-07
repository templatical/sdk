import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildAllCapabilityConfig } from "../src/config/capabilities";

/**
 * `App.vue` must keep behaving exactly as it does today until plan 6 deletes
 * it, and the capability registry grows a config key every time a capability
 * is ported. Those two facts collide in one object literal: a later key beats
 * an earlier one regardless of which is a spread, so a registry spread placed
 * last would let the mere act of registering a capability take over whichever
 * key this app resolves for itself.
 *
 * That is not hypothetical. Registering the shadow-dom capability overrode
 * `App.vue`'s own URL-param mount-mode resolution, which every `chromium-light`
 * e2e depends on — roughly half the suite — and it failed silently, because
 * the config was still perfectly valid and the editor still mounted.
 *
 * The rule that prevents it is positional, not per-key: the registry spread
 * comes first, so everything `App.vue` sets explicitly wins. This guard is
 * driven off the registry's real output, so a capability ported in plans
 * 5a-5d is covered without anyone editing this file.
 *
 * Source text rather than behaviour: the playground has no `@vue/test-utils`
 * and its `vitest.config.ts` carries no way to mount `App.vue`, whose
 * `init()` call is 40-odd keys deep inside an async function.
 */
const APP_SOURCE = readFileSync(
  join(import.meta.dirname, "../src/App.vue"),
  "utf8",
);

const SPREAD = "...buildAllCapabilityConfig(";

/**
 * Just the `init({ … })` argument, so a key name appearing in an import list
 * or another object cannot read as a competing assignment. `templates` is
 * imported at the top of the file and would otherwise match at index 871,
 * "before the spread", for entirely the wrong reason.
 */
function initCallSource(): string {
  const open = APP_SOURCE.indexOf("await init({");
  expect(open).toBeGreaterThan(-1);
  // The call's own closing brace sits at the same indentation as `await`.
  const close = APP_SOURCE.indexOf("\n    });", open);
  expect(close).toBeGreaterThan(open);
  return APP_SOURCE.slice(open, close);
}

const INIT_SOURCE = initCallSource();

/** Every top-level config key the registry contributes today. */
const registryKeys = Object.keys(buildAllCapabilityConfig({}));

describe("App.vue config precedence over the capability registry", () => {
  it("spreads the registry exactly once, inside init()", () => {
    expect(APP_SOURCE.split(SPREAD).length - 1).toBe(1);
    expect(INIT_SOURCE).toContain(SPREAD);
  });

  it("has something to guard — the registry contributes keys", () => {
    // Without this the whole suite would pass vacuously if the registry ever
    // returned nothing.
    expect(registryKeys.length).toBeGreaterThan(0);
  });

  it("puts its OTHER spread after the registry's too", () => {
    // `...currentSerializableConfig` carries `content`, `mergeTags`,
    // `logicTags`, `displayConditions` and `customBlocks` — keys that reach
    // `init()` through a spread rather than as named properties, so the
    // per-key table below cannot see them and returns early instead.
    //
    // The registry produces none of those three tag/condition keys today.
    // The moment a capability does, whether App.vue's own value wins depends
    // entirely on the order of these two spreads, and nothing else pins it.
    const spreadAt = INIT_SOURCE.indexOf(SPREAD);
    const serializableAt = INIT_SOURCE.indexOf("...currentSerializableConfig");
    expect(serializableAt).toBeGreaterThan(-1);
    expect(serializableAt).toBeGreaterThan(spreadAt);
  });

  it("names every key its second spread contributes, so the table can see them", () => {
    // Read off `buildSerializableConfig`'s own return literal rather than
    // hand-listed here: a key added there must not become invisible to this
    // file just because nobody remembered to copy it across.
    const fn = APP_SOURCE.slice(
      APP_SOURCE.indexOf("function buildSerializableConfig()"),
    );
    const body = fn.slice(0, fn.indexOf("\n}"));
    // `key:` and the shorthand `key,` both count — `displayConditions` is
    // passed shorthand, and a colon-only pattern silently drops it.
    const keys = [...body.matchAll(/^    (\w+)[:,]/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual([
      "content",
      "customBlocks",
      "displayConditions",
      "logicTags",
      "mergeTags",
    ]);
  });

  it.each(registryKeys)(
    "sets %s after the registry spread, or not at all",
    (key) => {
      const spreadAt = INIT_SOURCE.indexOf(SPREAD);
      expect(spreadAt).toBeGreaterThan(-1);

      // Matches the key only as a property of this literal — `key:` or the
      // shorthand `key,` at the literal's own indentation — so a mention in a
      // comment or a nested object does not read as a competing assignment.
      const assignment = new RegExp(`^      ${key}(:|,)`, "m");
      const match = assignment.exec(INIT_SOURCE);
      if (!match) return; // App.vue does not set it; nothing to order.

      expect(match.index).toBeGreaterThan(spreadAt);
    },
  );

  it("keeps shadowDom after the spread, the case that already broke", () => {
    // Named explicitly as well as covered by the table above: this is the one
    // collision that has actually shipped, and it took out half the e2e suite.
    const spreadAt = INIT_SOURCE.indexOf(SPREAD);
    const shadowAt = INIT_SOURCE.indexOf("\n      shadowDom,");
    expect(shadowAt).toBeGreaterThan(spreadAt);
  });

  it("resolves its own mount mode rather than reading the control", () => {
    // The shell owns `shadowDom.mode`; this app owns `resolveInitialShadowMode`.
    // Two readers, deliberately unsynced, until plan 6 removes this one.
    expect(APP_SOURCE).toContain("resolveInitialShadowMode()");
    expect(APP_SOURCE).not.toContain("SHADOW_DOM_PATH");
  });
});
