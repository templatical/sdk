import en from "./en";

export type LinkMessageMap = typeof en;
export type LinkRuleMessageId = keyof LinkMessageMap;

const modules = import.meta.glob<{ default: LinkMessageMap }>("./*.ts", {
  eager: true,
});

const MESSAGES: Record<string, LinkMessageMap> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  MESSAGES[locale] = modules[path].default;
}

export const SUPPORTED_LINK_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getLinkMessages(locale: string): LinkMessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

export function formatLinkMessage(
  locale: string,
  ruleId: LinkRuleMessageId,
  params?: Record<string, string | number>,
): string {
  const map = getLinkMessages(locale);
  const template = map[ruleId] ?? en[ruleId];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}
