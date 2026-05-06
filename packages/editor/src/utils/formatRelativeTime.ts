const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

export interface RelativeTimeLabels {
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
}

/**
 * Formats a date string as a relative time string (e.g. "5 minutes ago").
 * Uses the provided i18n labels with `{minutes}`, `{hours}`, `{days}` placeholders.
 *
 * Returns `null` when the date is older than `maxDays` (default: Infinity),
 * signaling the caller should use an absolute format instead.
 */
export function formatRelativeTime(
  dateString: string,
  labels: RelativeTimeLabels,
  format?: (
    template: string,
    values: Record<string, string | number>,
  ) => string,
  maxDays?: number,
): string | null {
  const date = new Date(dateString);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  const diff = Date.now() - time;
  // Tolerate up to a minute of clock skew (server slightly ahead of client).
  // Anything further in the future is suspicious — return null so the caller
  // falls back to an absolute date format rather than mislabeling it.
  if (diff < -MS_PER_MINUTE) return null;
  const minutes = Math.floor(diff / MS_PER_MINUTE);
  const hours = Math.floor(diff / MS_PER_HOUR);
  const days = Math.floor(diff / MS_PER_DAY);

  if (minutes < 1) return labels.justNow;

  if (minutes < 60) {
    return format
      ? format(labels.minutesAgo, { minutes })
      : labels.minutesAgo.replace("{minutes}", String(minutes));
  }

  if (hours < 24) {
    return format
      ? format(labels.hoursAgo, { hours })
      : labels.hoursAgo.replace("{hours}", String(hours));
  }

  if (maxDays !== undefined && days >= maxDays) {
    return null;
  }

  return format
    ? format(labels.daysAgo, { days })
    : labels.daysAgo.replace("{days}", String(days));
}
