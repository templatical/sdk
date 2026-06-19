/**
 * Filters and reorders a candidate list of block-palette items against a
 * consumer-supplied `paletteBlocks` allowlist.
 *
 * Each `paletteBlocks` entry is a block-type key that must match a candidate's
 * `type`: a bare built-in type (e.g. `"image"`) or a prefixed custom type
 * (e.g. `"custom:qrcode"`). The result's `items` contains exactly the
 * candidates named in `paletteBlocks`, in that order. Entries with no matching
 * candidate (a typo, an unregistered custom block, or a plan-gated built-in
 * like `countdown` outside Cloud) are collected into `unknown` so the caller
 * can warn and skip. A type listed more than once is rendered once.
 *
 * When `paletteBlocks` is `undefined` or empty the candidates are returned
 * unchanged (the default full palette). An empty allowlist is treated as "not
 * configured" rather than "hide everything", since a zero-block palette is
 * almost always a mistake.
 */
export function resolvePaletteBlocks<T extends { type: string }>(
  candidates: T[],
  paletteBlocks: string[] | undefined,
): { items: T[]; unknown: string[] } {
  if (!paletteBlocks || paletteBlocks.length === 0) {
    return { items: candidates, unknown: [] };
  }

  const byType = new Map(candidates.map((c) => [c.type, c]));
  const items: T[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const entry of paletteBlocks) {
    if (seen.has(entry)) continue;
    seen.add(entry);

    const candidate = byType.get(entry);
    if (candidate) {
      items.push(candidate);
    } else {
      unknown.push(entry);
    }
  }

  return { items, unknown };
}
