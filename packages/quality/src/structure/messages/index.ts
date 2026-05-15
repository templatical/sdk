import en from "./en";

export type StructureMessageMap = typeof en;
export type StructureRuleMessageId = keyof StructureMessageMap;

const modules = import.meta.glob<{ default: StructureMessageMap }>("./*.ts", {
  eager: true,
});

const MESSAGES: Record<string, StructureMessageMap> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  MESSAGES[locale] = modules[path].default;
}

export const SUPPORTED_STRUCTURE_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getStructureMessages(locale: string): StructureMessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

export function formatStructureMessage(
  locale: string,
  ruleId: StructureRuleMessageId,
  params?: Record<string, string | number>,
): string {
  const map = getStructureMessages(locale);
  const template = map[ruleId] ?? en[ruleId];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}
