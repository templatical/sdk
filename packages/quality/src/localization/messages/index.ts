import en from "./en";
import { formatMessagePair } from "../../format-message";

export type LocalizationMessageMap = typeof en;
export type LocalizationRuleMessageId = keyof LocalizationMessageMap;

const modules = import.meta.glob<{ default: LocalizationMessageMap }>(
  "./*.ts",
  { eager: true },
);
const MESSAGES: Record<string, LocalizationMessageMap> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  MESSAGES[locale] = modules[path].default;
}

export const SUPPORTED_LOCALIZATION_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getLocalizationMessages(
  locale: string,
): LocalizationMessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

export function formatLocalizationMessage(
  locale: string,
  ruleId: LocalizationRuleMessageId,
  params?: Record<string, string | number>,
): { message: string; suggestion: string } {
  const map = getLocalizationMessages(locale);
  return formatMessagePair(map[ruleId] ?? en[ruleId], params);
}
