import { ossSdkLocales } from "@/i18n";
import type { CapabilityDef } from "../types";

/**
 * The editor's own UI language.
 *
 * Options come from `getSupportedLocales()` (via `ossSdkLocales`), which the
 * SDK derives from an `import.meta.glob` over its locale directory — so
 * dropping in a locale file makes it selectable here with no list to update.
 * Wraps no provider. Typed `CapabilityDef<undefined>` rather than
 * `CapabilityDef<never>` — see `shadow-dom.ts`'s doc comment for why `never`
 * cannot join `AnyCapabilityDef[]`.
 */
export const i18nCapability: CapabilityDef<undefined> = {
  id: "i18n",
  group: "appearance",
  title: "Localization",
  blurb:
    "The editor's chrome translates into whichever locale you pass; unsupported locales fall back to English.",
  fixture: "product-launch",
  controls: [
    {
      kind: "enum",
      path: "locale",
      label: "locale",
      help: "Region codes are normalised, so en-US resolves to en. Cloud-only strings live in a separate chunk with a narrower locale set.",
      options: [...ossSdkLocales],
      default: "en",
    },
  ],
  build: (state) => ({ locale: state["locale"] as string }),
};
