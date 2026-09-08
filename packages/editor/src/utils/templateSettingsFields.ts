import type {
  TemplateSettings,
  TemplateSettingsConfig,
} from "@templatical/types";

/** A member of `TemplateSettings` — the vocabulary `templateSettings.fields` speaks. */
export type TemplateSettingsField = keyof TemplateSettings;

/** The cards `TemplateSettings.vue` groups those fields into. */
export type TemplateSettingsCard =
  "layout" | "appearance" | "language" | "preheader";

/**
 * Which card each setting is rendered in.
 *
 * Typed as a full `Record<TemplateSettingsField, …>` on purpose: a ninth
 * `TemplateSettings` member fails `vue-tsc` here until someone decides which
 * card it belongs in, so a setting cannot ship with no way to hide it. Field
 * names — not card names — are the public vocabulary, because they are already
 * a published type while the cards are a layout decision.
 */
export const TEMPLATE_SETTINGS_FIELD_CARDS: Record<
  TemplateSettingsField,
  TemplateSettingsCard
> = {
  width: "layout",
  backgroundColor: "appearance",
  textColor: "appearance",
  linkColor: "appearance",
  linkUnderline: "appearance",
  fontFamily: "appearance",
  locale: "language",
  preheaderText: "preheader",
};

export const ALL_TEMPLATE_SETTINGS_FIELDS = Object.keys(
  TEMPLATE_SETTINGS_FIELD_CARDS,
) as TemplateSettingsField[];

export interface ResolvedTemplateSettingsFields {
  /** The settings the panel may render. */
  fields: ReadonlySet<TemplateSettingsField>;
  /** Entries that are not `TemplateSettings` members, for a one-time warning. */
  unknown: string[];
}

function isTemplateSettingsField(
  value: string,
): value is TemplateSettingsField {
  return Object.prototype.hasOwnProperty.call(
    TEMPLATE_SETTINGS_FIELD_CARDS,
    value,
  );
}

/**
 * Resolve `config.templateSettings` into the set of settings the panel may
 * render.
 *
 * The config only ever narrows, so every absent form — no key, no `fields`,
 * `fields: true` — resolves to all of them. An empty array resolves to none,
 * read as a stated decision rather than as "unset" (the `allowedRecipients: []`
 * convention), which is also what makes `fields: false` and `fields: []` agree.
 */
export function resolveTemplateSettingsFields(
  config?: TemplateSettingsConfig,
): ResolvedTemplateSettingsFields {
  const requested = config?.fields;

  if (requested === undefined || requested === true) {
    return { fields: new Set(ALL_TEMPLATE_SETTINGS_FIELDS), unknown: [] };
  }
  if (requested === false) {
    return { fields: new Set(), unknown: [] };
  }

  const fields = new Set<TemplateSettingsField>();
  const unknown: string[] = [];
  for (const entry of requested) {
    // A JS consumer can pass anything; TS callers get a compile error.
    if (isTemplateSettingsField(entry as string)) {
      fields.add(entry);
    } else {
      unknown.push(String(entry));
    }
  }
  return { fields, unknown };
}
