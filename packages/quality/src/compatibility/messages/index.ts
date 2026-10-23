import en from "./en";
import { formatMessagePair, type FormattedMessage } from "../../format-message";

export type CompatibilityMessageMap = typeof en;

const modules = import.meta.glob<{ default: CompatibilityMessageMap }>(
  "./*.ts",
  { eager: true },
);
const MESSAGES: Record<string, CompatibilityMessageMap> = {};
for (const path in modules) {
  MESSAGES[path.slice(2, -3)] = modules[path].default;
}

export const SUPPORTED_COMPATIBILITY_MESSAGE_LOCALES = Object.keys(MESSAGES);

export function getCompatibilityMessages(
  locale: string,
): CompatibilityMessageMap {
  const base = locale.split("-")[0]?.toLowerCase() ?? "en";
  return MESSAGES[base] ?? MESSAGES.en ?? en;
}

export function formatCompatibilityMessage(
  locale: string,
  ruleId: string,
  params: Record<string, string | number> = {},
): FormattedMessage {
  const map = getCompatibilityMessages(locale);
  const hand = (map.hand as Record<string, FormattedMessage>)[ruleId];
  if (hand) return formatMessagePair(hand, params);
  const slug = ruleId.slice("compat.".length);
  const entry = (
    map.features as Record<string, { feature: string; suggestion: string }>
  )[slug];
  if (!entry) throw new Error(`Missing compatibility message: ${ruleId}`);
  const kind =
    params.unsupported && params.partial
      ? "mixed"
      : params.unsupported
        ? "unsupported"
        : "partial";
  const feature = formatMessagePair(
    { message: entry.feature, suggestion: entry.suggestion },
    params,
  );
  return formatMessagePair(
    {
      message: map.templates[kind],
      suggestion: feature.suggestion,
    },
    { ...params, feature: feature.message },
  );
}
