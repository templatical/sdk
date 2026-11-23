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

function supportedLocale(locale: string | undefined): {
  labelLocale: keyof typeof COUNTDOWN_LABELS;
  formatLocale: string;
} {
  const requested = locale?.trim().replace(/_/g, "-") ?? "";
  let validated: string;
  try {
    validated = Intl.getCanonicalLocales(requested)[0] ?? "en";
  } catch {
    return { labelLocale: "en", formatLocale: "en" };
  }

  const normalized = validated.toLowerCase();
  const exact = canonical.get(normalized);
  const base = canonical.get(normalized.split("-")[0]);
  const labelLocale = (exact ?? base ?? "en") as keyof typeof COUNTDOWN_LABELS;
  return { labelLocale, formatLocale: exact || base ? validated : "en" };
}

// `targetDate` is wall-clock time read in `timezone` (`YYYY-MM-DDTHH:mm`, the
// value an `<input type="datetime-local">` holds). `new Date()` on such a value
// reads it in the browser's zone, not the block's, so every reader goes
// through `countdownTargetTime`. A value carrying `Z` or an offset is already
// an instant and is read as one.
const WALL_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;
const DAY_MS = 86_400_000;
const ZONED = /T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

function zoneParts(time: number, timezone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(time);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return ["year", "month", "day", "hour", "minute", "second"].map(get);
}

// Milliseconds the zone is ahead of UTC at `time`.
function zoneOffset(time: number, timezone: string): number {
  const [year, month, day, hour, minute, second] = zoneParts(time, timezone);
  const wholeSecond = time - (((time % 1000) + 1000) % 1000);
  return Date.UTC(year, month - 1, day, hour, minute, second) - wholeSecond;
}

/**
 * The instant a countdown runs to, in epoch milliseconds. A wall-clock
 * `targetDate` is read in `timezone`; a value with `Z` or an offset is that
 * instant. Returns `null` for an empty or unreadable date, or a wall-clock
 * date with an unknown timezone. A wall time skipped by a DST change
 * (`02:30` on the night Berlin springs forward) moves forward by the gap, and
 * one that occurs twice resolves to the later occurrence.
 */
export function countdownTargetTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): number | null {
  if (typeof block.targetDate !== "string") return null;
  const value = block.targetDate.trim();

  if (ZONED.test(value)) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : null;
  }

  const match = WALL_TIME.exec(value);
  if (!match || typeof block.timezone !== "string") return null;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }

  try {
    // Try the offsets a day either side of the wall time: no zone changes
    // offset twice in two days. A candidate is valid when the zone shows the
    // wall time at that instant. Two valid candidates mean the wall time
    // occurs twice, so take the later; none means it falls in a gap, and the
    // pre-change offset moves it forward by the gap. A single guessed offset
    // gets both cases backwards in zones west of UTC.
    const before = wall - zoneOffset(wall - DAY_MS, block.timezone);
    const after = wall - zoneOffset(wall + DAY_MS, block.timezone);
    const valid = [before, after].filter(
      (time) => time + zoneOffset(time, block.timezone) === wall,
    );
    return valid.length > 0 ? Math.max(...valid) : before;
  } catch {
    return null;
  }
}

/**
 * `targetDate` as wall-clock `YYYY-MM-DDTHH:mm` in `timezone`, the value an
 * `<input type="datetime-local">` accepts. A value with `Z` or an offset is
 * converted into the block's timezone. Returns `""` when it can't be read.
 */
export function countdownWallTime(
  block: Pick<CountdownBlock, "targetDate" | "timezone">,
): string {
  const time = countdownTargetTime(block);
  if (time === null) return "";
  const value = block.targetDate.trim();
  if (!ZONED.test(value)) return value.slice(0, 16);

  try {
    const [year, month, day, hour, minute] = zoneParts(time, block.timezone);
    const pad = (n: number, width = 2) => String(n).padStart(width, "0");
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  } catch {
    return "";
  }
}

/**
 * Recipient-facing description of the countdown target in the template's
 * content locale. An invalid target or timezone produces the neutral label.
 */
export function countdownAltText(
  block: CountdownBlock,
  locale: string | undefined,
): string {
  const { labelLocale, formatLocale } = supportedLocale(locale);
  const label = COUNTDOWN_LABELS[labelLocale];
  const time = countdownTargetTime(block);
  if (time === null) return label;
  const date = new Date(time);

  try {
    const formatted = new Intl.DateTimeFormat(formatLocale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: block.timezone,
    }).format(date);
    const lead = labelLocale === "en" ? `${label} to` : `${label}:`;
    return `${lead} ${formatted} (${block.timezone})`;
  } catch {
    return label;
  }
}
