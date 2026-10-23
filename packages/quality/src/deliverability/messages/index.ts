import en from "./en";
import { formatMessagePair } from "../../format-message";

export type DeliverabilityMessageMap = typeof en;
export type DeliverabilityRuleMessageId = keyof DeliverabilityMessageMap;

const modules = import.meta.glob<{ default: DeliverabilityMessageMap }>(
  "./*.ts",
  { eager: true },
);
const MESSAGES: Record<string, DeliverabilityMessageMap> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  MESSAGES[locale] = modules[path].default;
}

export const SUPPORTED_DELIVERABILITY_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getDeliverabilityMessages(
  locale: string,
): DeliverabilityMessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

export function formatDeliverabilityMessage(
  locale: string,
  ruleId: DeliverabilityRuleMessageId,
  params?: Record<string, string | number>,
): { message: string; suggestion: string } {
  const map = getDeliverabilityMessages(locale);
  const template = map[ruleId] ?? en[ruleId];
  return formatMessagePair(template, params);
}
