import en from "./en";

export type MessageMap = typeof en;
export type RuleMessageId = keyof MessageMap;

/**
 * Auto-discovered locale registry. Drop a `messages/<lang>.ts` file and
 * it's bundled automatically — same pattern as the editor's i18n.
 *
 * Eager glob: synchronous, all locales bundled into the package. Tiny
 * (a few hundred bytes per locale) so the cost is negligible compared
 * to the lazy-loading overhead.
 */
const modules = import.meta.glob<{ default: MessageMap }>("./*.ts", {
  eager: true,
});

const MESSAGES: Record<string, MessageMap> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  MESSAGES[locale] = modules[path].default;
}

export const SUPPORTED_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getMessages(locale: string): MessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

/**
 * Resolve a localized message for a rule. `params` interpolate `{name}`
 * placeholders. Falls back to English when the locale doesn't ship the
 * key (shouldn't happen — the parity test enforces it).
 */
export function formatMessage(
  locale: string,
  ruleId: RuleMessageId,
  params?: Record<string, string | number>,
): string {
  const map = getMessages(locale);
  const template = map[ruleId] ?? en[ruleId];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}
