/** Read the edited inner paragraph, rather than the MJML wrapper's alignment. */
export function exportedParagraphAlignment(
  mjml: string,
  text: string,
): string | null {
  const paragraph = [...mjml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)].find(
    (match) => match[2].includes(text),
  );
  if (!paragraph)
    throw new Error(`Exported paragraph containing "${text}" was not found.`);
  const style = paragraph[1].match(/\bstyle=(["'])(.*?)\1/i)?.[2] ?? "";
  return (
    style
      .match(/(?:^|;)\s*text-align\s*:\s*([^;]+)/i)?.[1]
      .trim()
      .toLowerCase() ?? null
  );
}
