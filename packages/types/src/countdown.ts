import type { CountdownBlock } from "./blocks";

/**
 * Host image source for countdown blocks. Return the URL of an image that the
 * host or a third-party service keeps current for the block's target date.
 * The SDK does not generate countdown images.
 */
export interface CountdownProvider {
  imageUrl(block: CountdownBlock): string;
}

// These labels are the existing `blocks.countdown` names in the editor locale
// bundles. The formatted target follows "to" in English and a colon elsewhere.
const COUNTDOWN_LABELS = {
  en: "Countdown",
  de: "Countdown",
  es: "Cuenta atrás",
  fr: "Compte à rebours",
  nl: "Aftelklok",
  "pt-BR": "Contagem Regressiva",
  ca: "Compta enrere",
  ja: "カウントダウン",
  da: "Nedtælling",
} as const;

/** Locales covered by the countdown alt text table. */
export const COUNTDOWN_ALT_LOCALES: readonly string[] =
  Object.keys(COUNTDOWN_LABELS);

const canonical = new Map(
  COUNTDOWN_ALT_LOCALES.map((locale) => [locale.toLowerCase(), locale]),
);

function supportedLocale(
  locale: string | undefined,
): keyof typeof COUNTDOWN_LABELS {
  const normalized = locale?.trim().replace(/_/g, "-").toLowerCase() ?? "";
  const exact = canonical.get(normalized);
  if (exact) return exact as keyof typeof COUNTDOWN_LABELS;
  const base = canonical.get(normalized.split("-")[0]);
  return (base ?? "en") as keyof typeof COUNTDOWN_LABELS;
}

/**
 * Recipient-facing description of the countdown target in the template's
 * content locale. An invalid target or timezone produces the neutral label.
 */
export function countdownAltText(
  block: CountdownBlock,
  locale: string | undefined,
): string {
  const resolved = supportedLocale(locale);
  const label = COUNTDOWN_LABELS[resolved];
  if (typeof block.targetDate !== "string") return label;
  const date = new Date(block.targetDate);
  if (!Number.isFinite(date.getTime())) return label;

  try {
    const formatted = new Intl.DateTimeFormat(resolved, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: block.timezone,
    }).format(date);
    const lead = resolved === "en" ? `${label} to` : `${label}:`;
    return `${lead} ${formatted} (${block.timezone})`;
  } catch {
    return label;
  }
}
