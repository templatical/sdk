import type { InjectionKey, Ref } from "vue";
import type { UsePlanConfigReturn } from "@templatical/core/cloud";
import type { MediaTranslations } from "./i18n";

/**
 * The active plan's config, for the media limits every surface in this package
 * reads: accepted MIME types, `max_file_size`, the storage gauge.
 *
 * **Provided by whichever component roots the tree** — `MediaLibraryModal` from
 * its `planConfig` prop, `standalone/MediaLibrary.vue` from its own — and
 * consumed by `useMediaCategories`, which five descendants call. It is a
 * provide rather than prop-drilling *only* because of that depth; the values
 * themselves cross the package boundary as props.
 *
 * That distinction is the whole point of this key existing. Vue matches injection
 * keys by identity, so a bare-string `inject("planConfig")` never resolves the
 * `Symbol` a host provided — it yields `undefined` silently, and the browser is
 * inert with nothing to debug. Props make the cross-package boundary typed; a
 * single exported key makes the intra-package hop impossible to spell two
 * different ways.
 */
export const PLAN_CONFIG_KEY: InjectionKey<UsePlanConfigReturn> = Symbol(
  "templaticalMediaPlanConfig",
);

/**
 * Mount target for modal/overlay teleports inside `MediaLibraryModal` and
 * its nested sub-modals (replace, edit, import URL). Set via the
 * `popoverTarget` prop on `MediaLibraryModal` and provided here so the
 * sub-modals can teleport to the same element.
 *
 * When the ref resolves to `null` (or no provider is in scope, e.g. the
 * standalone visual SDK from `./standalone/visual.ts`), modals fall back
 * to `document.body` — preserving the original teleport behavior.
 *
 * Host integration: editors that mount `MediaLibraryModal` inside a
 * shadow-aware tree should pass their popover root element (e.g.
 * `core.popoverRoot.value`) through the prop so media-library modals land
 * inside the editor's shadow boundary rather than escaping to body.
 */
export const POPOVER_TARGET_KEY: InjectionKey<Ref<HTMLElement | null>> = Symbol(
  "templaticalMediaPopoverTarget",
);

/**
 * The active locale's strings, for the twelve components in this package that
 * call `useI18n()`.
 *
 * **Provided by whichever component roots the tree** — `MediaLibraryModal` from
 * the translations it loads for its `locale` prop, `standalone/MediaLibrary.vue`
 * from its own `translations` prop.
 *
 * A `Symbol` for the same reason {@link PLAN_CONFIG_KEY} is one, and this key
 * exists because that reason was learned the hard way: translations used to be
 * injected under the bare string `"translations"`, which never resolves the
 * `Symbol` `@templatical/editor` provides under the same name. A modal mounted
 * inside the editor got `undefined` and every `t.mediaLibrary.*` read threw.
 * Strings cross the package boundary as a `locale` prop; this key carries them
 * the rest of the way.
 */
export const TRANSLATIONS_KEY: InjectionKey<Ref<MediaTranslations | null>> =
  Symbol("templaticalMediaTranslations");

/**
 * Resolved UI theme (`"light"` / `"dark"`) for the overlay chrome, stamped onto
 * `data-tpl-theme` by this package's modals.
 *
 * Set from `MediaLibraryModal`'s `uiTheme` prop. The three sub-modals need it
 * too and teleport away from the modal's own DOM, so it travels by provide
 * rather than by prop-drilling through the markup.
 *
 * A `Symbol` for the reason `PLAN_CONFIG_KEY` is one, and the third key added
 * after learning it: these modals injected the bare string `"tplUiTheme"`, which
 * never resolves the identically-named `Symbol` `@templatical/editor` provides.
 * `data-tpl-theme` was therefore always `undefined` and the media library stayed
 * light inside a dark editor.
 *
 * Absent in the standalone SDK, which has no light/dark concept — the modals
 * inject with a `null` default and simply stamp nothing.
 */
export const UI_THEME_KEY: InjectionKey<Readonly<Ref<string | undefined>>> =
  Symbol("templaticalMediaUiTheme");
