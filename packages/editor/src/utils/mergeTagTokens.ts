import {
  decodeHtmlEntities,
  replaceMergeTagSpans,
  scanSyntaxMatches,
  type SyntaxPreset,
} from "@templatical/types";

/**
 * The sorted merge-tag tokens `localization.merge-tags-differ` compares.
 * Mirrors `tokens` in `@templatical/quality`'s localization rules, which the
 * editor only loads lazily: HTML span tokens stay opaque and raw matches
 * decode once; plain text stays literal. mergeTagTokens.test.ts keeps the two
 * in agreement.
 */
export function mergeTagTokens(
  value: string,
  syntax: SyntaxPreset,
  format: "html" | "text",
): string[] {
  const spanTokens: string[] = [];
  let marker = "\u0000MT";
  while (value.includes(marker)) marker += "_";
  const remaining =
    format === "html"
      ? replaceMergeTagSpans(value, (token) => {
          const index = spanTokens.push(token) - 1;
          return `${marker}${index}\u0000`;
        })
      : value;
  const placeholders = Array.from(
    remaining.matchAll(new RegExp(`${marker}\\d+\u0000`, "g")),
    (match) => ({ start: match.index, end: match.index + match[0].length }),
  );
  const matches: { start: number; end: number; value: string }[] = [];
  const logic = scanSyntaxMatches(remaining, syntax, "logic");
  const acceptedLogic: { start: number; end: number }[] = [];
  let logicIndex = 0;
  for (const kind of ["logic", "value"] as const) {
    let placeholderIndex = 0;
    for (const match of kind === "logic"
      ? logic
      : scanSyntaxMatches(remaining, syntax, "value")) {
      const start = match.index;
      const end = start + match.value.length;
      while (placeholders[placeholderIndex]?.end <= start) placeholderIndex++;
      const placeholder = placeholders[placeholderIndex];
      if (placeholder && start < placeholder.end && end > placeholder.start)
        continue;
      if (kind === "value") {
        while (acceptedLogic[logicIndex]?.end <= start) logicIndex++;
        const other = acceptedLogic[logicIndex];
        if (other && start < other.end && end > other.start) continue;
      }
      if (kind === "logic") acceptedLogic.push({ start, end });
      matches.push({
        start,
        end,
        value:
          format === "html" ? decodeHtmlEntities(match.value) : match.value,
      });
    }
  }
  return [...spanTokens, ...matches.map((match) => match.value)].sort();
}

/** Whether a translation's merge-tag multiset differs from its default's. */
export function mergeTagsDiffer(
  base: string,
  translated: string,
  syntax: SyntaxPreset,
  format: "html" | "text",
): boolean {
  return (
    JSON.stringify(mergeTagTokens(base, syntax, format)) !==
    JSON.stringify(mergeTagTokens(translated, syntax, format))
  );
}
