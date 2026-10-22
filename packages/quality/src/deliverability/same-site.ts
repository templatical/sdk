/**
 * Explicit suffixes keep same-site comparisons conservative. A missed flag is
 * preferable to a false phishing warning; no public-suffix dependency is needed.
 */
export const MULTI_PART_SUFFIXES =
  "ac.jp ac.uk co.at co.id co.il co.in co.jp co.kr co.nz co.uk co.za com.ar com.au com.br com.cn com.co com.hk com.mx com.my com.ph com.pl com.sg com.tr com.tw com.ua edu.au go.jp gov.au gov.uk ltd.uk me.uk ne.jp net.au net.br net.cn net.in net.nz or.at or.jp or.kr org.au org.br org.cn org.in org.nz org.uk plc.uk".split(
    " ",
  );

const suffixes = new Set(MULTI_PART_SUFFIXES);

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !/[{}]/.test(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function normalizedHost(url: URL): string {
  return url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

function registrableDomain(host: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) {
    return host;
  }
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return labels.slice(-(suffixes.has(lastTwo) ? 3 : 2)).join(".");
}

export function isSameSite(left: string, right: string): boolean {
  const leftUrl = parseHttpUrl(`http://${left}`);
  const rightUrl = parseHttpUrl(`http://${right}`);
  if (!leftUrl || !rightUrl) return false;
  return (
    registrableDomain(normalizedHost(leftUrl)) ===
    registrableDomain(normalizedHost(rightUrl))
  );
}
