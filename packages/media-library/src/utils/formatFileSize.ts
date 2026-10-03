const UNITS = ["B", "KB", "MB", "GB"];

/** `10485760` → `"10 MB"`, `1572864` → `"1.5 MB"`: whole units drop the `.0`. */
export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
}
