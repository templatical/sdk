import { Parser, Tokenizer } from "htmlparser2";

const ALLOWED_TAGS = new Set([
  "p",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "br",
  "span",
]);

/** Check restored rich text, after the exact placeholder check and unmasking. */
export function isSafeTranslationHtml(html: string): boolean {
  let safe = true;
  const checkTag = (start: number, end: number) => {
    if (!ALLOWED_TAGS.has(html.slice(start, end).toLowerCase())) safe = false;
  };
  const ignore = () => {};
  // Check explicit tags before the parser repairs or discards closing tags.
  const tokenizer = new Tokenizer(
    { decodeEntities: false },
    {
      onopentagname: checkTag,
      onclosetag: checkTag,
      onattribdata: ignore,
      onattribentity: ignore,
      onattribend: ignore,
      onattribname: ignore,
      oncdata: ignore,
      oncomment: ignore,
      ondeclaration: ignore,
      onend: ignore,
      onopentagend: ignore,
      onprocessinginstruction: ignore,
      onselfclosingtag: ignore,
      ontext: ignore,
      ontextentity: ignore,
    },
  );
  tokenizer.write(html);
  tokenizer.end();
  if (!safe) return false;
  const parser = new Parser({
    onopentag(_name, attributes) {
      for (const [attribute, value] of Object.entries(attributes)) {
        if (
          attribute.startsWith("on") ||
          ((attribute === "href" || attribute === "src") &&
            value.trim().toLowerCase().startsWith("javascript:"))
        )
          safe = false;
      }
    },
  });
  parser.end(html);
  return safe;
}
