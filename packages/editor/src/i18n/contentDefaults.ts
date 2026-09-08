import type { BlockDefaults } from "@templatical/types";
import { getBaseLocale } from "./index";

/**
 * Default block text that **ships in the delivered email** — the video `alt`
 * attribute and the countdown's unit labels and expired message.
 *
 * These follow the template's own `settings.locale` (the "content language"
 * field in Template Settings), NOT the editor UI's `config.locale`. A
 * German-speaking author building an English campaign must not get German
 * countdown labels in it. Author-facing placeholder prompts — title, paragraph
 * and button text — are the opposite case and live in
 * `utils/localizedBlockDefaults.ts`.
 *
 * ## Why this is its own eagerly-bundled table
 *
 * The UI locale bundles are loaded one at a time by dynamic `import()`, so the
 * strings for a locale other than the active one are simply not in memory —
 * and `settings.locale` is independent of `config.locale`, so it routinely
 * *is* another locale. Reading a second bundle would mean an async load on a
 * synchronous code path (`createBlock`). Six short strings per locale is a few
 * hundred bytes; a table costs less than the plumbing would.
 *
 * Every value is copied from that locale's own `countdown.*` /
 * `blocks.video` strings, so nothing here is a fresh translation. Keep them in
 * step: `contentDefaultsParity` in `tests/i18n.test.ts` fails if a locale
 * bundle exists without an entry here.
 */
interface ContentDefaultStrings {
  video: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  expired: string;
}

const STRINGS: Record<string, ContentDefaultStrings> = {
  en: {
    video: "Video",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    expired: "This offer has expired",
  },
  de: {
    video: "Video",
    days: "Tage",
    hours: "Stunden",
    minutes: "Minuten",
    seconds: "Sekunden",
    expired: "Dieses Angebot ist abgelaufen",
  },
  es: {
    video: "Vídeo",
    days: "Días",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    expired: "Esta oferta ha expirado",
  },
  fr: {
    video: "Vidéo",
    days: "Jours",
    hours: "Heures",
    minutes: "Minutes",
    seconds: "Secondes",
    expired: "Cette offre a expiré",
  },
  nl: {
    video: "Video",
    days: "Dagen",
    hours: "Uren",
    minutes: "Minuten",
    seconds: "Seconden",
    expired: "Deze aanbieding is verlopen",
  },
  "pt-BR": {
    video: "Vídeo",
    days: "Dias",
    hours: "Horas",
    minutes: "Minutos",
    seconds: "Segundos",
    expired: "Esta oferta expirou",
  },
  ca: {
    video: "Vídeo",
    days: "Dies",
    hours: "Hores",
    minutes: "Minuts",
    seconds: "Segons",
    expired: "Aquesta oferta ha caducat",
  },
};

/** The locales this table covers. Asserted against the UI bundles in tests. */
export const CONTENT_DEFAULT_LOCALES: readonly string[] = Object.keys(STRINGS);

const CANONICAL = new Map(
  Object.keys(STRINGS).map((locale) => [locale.toLowerCase(), locale]),
);

/**
 * Resolve a template's content locale to a strings entry, English last.
 *
 * `settings.locale` is a free-text BCP-47 field the author types, so it arrives
 * far dirtier than `config.locale`: regions (`de-AT`), underscores (`de_DE`),
 * stray case and whitespace, or nothing at all. Exact match first, then the
 * base language, then English — the same ladder `loadTranslations` walks, but
 * over this table rather than the bundle globs.
 */
function resolveStrings(locale: string | undefined): ContentDefaultStrings {
  if (!locale) return STRINGS.en;
  const canonical = locale.trim().replace(/_/g, "-").toLowerCase();
  const exact = CANONICAL.get(canonical);
  if (exact) return STRINGS[exact];
  const base = CANONICAL.get(getBaseLocale(canonical));
  return base ? STRINGS[base] : STRINGS.en;
}

/**
 * The recipient-facing block defaults for a template's content locale.
 *
 * The English arm is byte-identical to `VIDEO_BLOCK_DEFAULTS.alt` and the
 * `COUNTDOWN_BLOCK_DEFAULTS` label fields, so a template with no locale — or an
 * unrecognised one — behaves exactly as it did before this existed.
 */
export function localizedContentDefaults(
  locale: string | undefined,
): BlockDefaults {
  const s = resolveStrings(locale);
  return {
    video: { alt: s.video },
    countdown: {
      labelDays: s.days,
      labelHours: s.hours,
      labelMinutes: s.minutes,
      labelSeconds: s.seconds,
      expiredMessage: s.expired,
    },
  };
}
