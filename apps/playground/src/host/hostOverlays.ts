import type { TemplateSettingsConfig } from "@templatical/editor";

/**
 * E2e-only `?settingsFields=` overlay. Must not leak into scene snippets.
 * `none` → `fields: false`; a comma list is the allowlist; absent omits the key.
 */
export function overlayTemplateSettings(search: URLSearchParams): {
  templateSettings?: TemplateSettingsConfig;
} {
  const raw = search.get("settingsFields");
  if (raw === null) return {};
  if (raw === "none") return { templateSettings: { fields: false } };
  return {
    templateSettings: {
      fields: raw.split(",").map((entry) => entry.trim()),
    } as TemplateSettingsConfig,
  };
}
