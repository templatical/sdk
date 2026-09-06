import type { TemplaticalEditorConfig } from "@templatical/editor";
import { customBlockDefinitions, displayConditions } from "@/templates";
import type { TemplateOption } from "@/templates";

/**
 * The `init()` keys the active fixture's own content requires, independent of
 * which capability is being demoed.
 *
 * `createProductLaunchTemplate()` — the fixture all four registered
 * capabilities point at today — embeds a `custom` block and three
 * `displayCondition`s. Without `customBlocks` the SDK has no definition to
 * render the custom block against, so `CustomBlock.vue` falls back to its
 * "Unknown block type" placeholder; without `displayConditions` the Display
 * Condition settings section never renders at all (`CommonBlockSettings.vue`'s
 * `hasDisplayConditions` gate), though the conditions keep evaluating either
 * way since that path reads `block.displayCondition` directly.
 *
 * Custom blocks and display conditions are not capabilities of their own yet —
 * plans 5a-5d port them later and will take ownership of these two keys then,
 * each gaining a control the way `savedBlocks`/`templates`/`versionHistory`/
 * `comments` already have. Until one lands, the shell supplies what its own
 * demo content requires, the same reasoning that puts `user` on every
 * capability's config in `CapabilityShell.vue` rather than only comments'.
 *
 * A plain function rather than a registered capability: neither key has a
 * control to flip, so there is nothing for a `CapabilityDef.build()` to key
 * off, and folding a no-control entry into the registry would misrepresent it
 * as a demoable feature.
 *
 * Extracted out of `CapabilityShell.vue`'s inline config builder so a unit
 * test can walk the same value the shell actually passes — the shell itself
 * is a `.vue` file, and this app has no `@vue/test-utils` to mount one with.
 */
export function fixtureCapabilityConfig(
  fixture: TemplateOption,
): Pick<TemplaticalEditorConfig, "customBlocks" | "displayConditions"> {
  return {
    // Mirrors `App.vue`'s `buildSerializableConfig()`: a template's own
    // custom blocks win when it declares them, else the full playground
    // catalog covers whichever fixture the drawer's picker swaps in.
    customBlocks: fixture.customBlocks ?? customBlockDefinitions,
    displayConditions,
  };
}
