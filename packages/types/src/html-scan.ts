/**
 * Minimal, allocation-free primitives for reading an HTML open tag out of a
 * markup string. They exist because merge-tag markup is rewritten from a raw
 * string in two packages — `@templatical/types` (label / sample resolution for
 * the previews) and `@templatical/renderer` (converting spans back to tokens on
 * export) — and both need the same two answers: where does this open tag end,
 * and what is the value of one of its attributes.
 *
 * Both are hand-written character scans rather than regexes. A regex over an
 * attribute string with no closing quote backtracks across the whole input,
 * which is the ReDoS class the span scanners were rewritten to avoid; a scan
 * that only moves forward cannot.
 */

const QUOTES = new Set(['"', "'"]);

/**
 * Index of the `>` that closes the open tag whose name ends at `from`, or `-1`
 * when the tag never closes.
 *
 * Quote-aware: a `>` inside a quoted attribute value does not end the tag.
 * That matters because a consumer may configure a merge-tag syntax whose tag
 * values contain `<` / `>` — Smarty-style `<% $email %>` — and HTML attribute
 * serialization escapes only `&`, `"` and U+00A0, so those characters reach the
 * markup literally. A plain `indexOf(">")` stops mid-attribute there and every
 * caller downstream sees a truncated attribute string.
 *
 * An unterminated quote yields `-1` rather than a guessed tag end: callers
 * treat that as "not markup I can rewrite" and emit the input untouched, which
 * is the safe answer for malformed HTML.
 */
export function findOpenTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i++) {
    const char = html[i];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (QUOTES.has(char)) {
      quote = char;
      continue;
    }
    if (char === ">") return i;
  }
  return -1;
}

function isAttrNameChar(char: string): boolean {
  return (
    char !== " " &&
    char !== "\t" &&
    char !== "\n" &&
    char !== "\r" &&
    char !== "\f" &&
    char !== "=" &&
    char !== ">" &&
    char !== "/"
  );
}

function isWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

// HTML 4.01 named references, legacy aliases and the previously supported apos.
const NAMED_ENTITIES: Record<string, string> = {
  AMP: "&",
  COPY: "\u00a9",
  GT: ">",
  LT: "<",
  QUOT: '"',
  REG: "\u00ae",
  AElig: "\u00c6",
  Aacute: "\u00c1",
  Acirc: "\u00c2",
  Agrave: "\u00c0",
  Alpha: "\u0391",
  Aring: "\u00c5",
  Atilde: "\u00c3",
  Auml: "\u00c4",
  Beta: "\u0392",
  Ccedil: "\u00c7",
  Chi: "\u03a7",
  Dagger: "\u2021",
  Delta: "\u0394",
  ETH: "\u00d0",
  Eacute: "\u00c9",
  Ecirc: "\u00ca",
  Egrave: "\u00c8",
  Epsilon: "\u0395",
  Eta: "\u0397",
  Euml: "\u00cb",
  Gamma: "\u0393",
  Iacute: "\u00cd",
  Icirc: "\u00ce",
  Igrave: "\u00cc",
  Iota: "\u0399",
  Iuml: "\u00cf",
  Kappa: "\u039a",
  Lambda: "\u039b",
  Mu: "\u039c",
  Ntilde: "\u00d1",
  Nu: "\u039d",
  OElig: "\u0152",
  Oacute: "\u00d3",
  Ocirc: "\u00d4",
  Ograve: "\u00d2",
  Omega: "\u03a9",
  Omicron: "\u039f",
  Oslash: "\u00d8",
  Otilde: "\u00d5",
  Ouml: "\u00d6",
  Phi: "\u03a6",
  Pi: "\u03a0",
  Prime: "\u2033",
  Psi: "\u03a8",
  Rho: "\u03a1",
  Scaron: "\u0160",
  Sigma: "\u03a3",
  THORN: "\u00de",
  Tau: "\u03a4",
  Theta: "\u0398",
  Uacute: "\u00da",
  Ucirc: "\u00db",
  Ugrave: "\u00d9",
  Upsilon: "\u03a5",
  Uuml: "\u00dc",
  Xi: "\u039e",
  Yacute: "\u00dd",
  Yuml: "\u0178",
  Zeta: "\u0396",
  aacute: "\u00e1",
  acirc: "\u00e2",
  acute: "\u00b4",
  aelig: "\u00e6",
  agrave: "\u00e0",
  alefsym: "\u2135",
  alpha: "\u03b1",
  amp: "&",
  and: "\u2227",
  ang: "\u2220",
  apos: "'",
  aring: "\u00e5",
  asymp: "\u2248",
  atilde: "\u00e3",
  auml: "\u00e4",
  bdquo: "\u201e",
  beta: "\u03b2",
  brvbar: "\u00a6",
  bull: "\u2022",
  cap: "\u2229",
  ccedil: "\u00e7",
  cedil: "\u00b8",
  cent: "\u00a2",
  chi: "\u03c7",
  circ: "\u02c6",
  clubs: "\u2663",
  cong: "\u2245",
  copy: "\u00a9",
  crarr: "\u21b5",
  cup: "\u222a",
  curren: "\u00a4",
  dArr: "\u21d3",
  dagger: "\u2020",
  darr: "\u2193",
  deg: "\u00b0",
  delta: "\u03b4",
  diams: "\u2666",
  divide: "\u00f7",
  eacute: "\u00e9",
  ecirc: "\u00ea",
  egrave: "\u00e8",
  empty: "\u2205",
  emsp: "\u2003",
  ensp: "\u2002",
  epsilon: "\u03b5",
  equiv: "\u2261",
  eta: "\u03b7",
  eth: "\u00f0",
  euml: "\u00eb",
  euro: "\u20ac",
  exist: "\u2203",
  fnof: "\u0192",
  forall: "\u2200",
  frac12: "\u00bd",
  frac14: "\u00bc",
  frac34: "\u00be",
  frasl: "\u2044",
  gamma: "\u03b3",
  ge: "\u2265",
  gt: ">",
  hArr: "\u21d4",
  harr: "\u2194",
  hearts: "\u2665",
  hellip: "\u2026",
  iacute: "\u00ed",
  icirc: "\u00ee",
  iexcl: "\u00a1",
  igrave: "\u00ec",
  image: "\u2111",
  infin: "\u221e",
  int: "\u222b",
  iota: "\u03b9",
  iquest: "\u00bf",
  isin: "\u2208",
  iuml: "\u00ef",
  kappa: "\u03ba",
  lArr: "\u21d0",
  lambda: "\u03bb",
  lang: "\u2329",
  laquo: "\u00ab",
  larr: "\u2190",
  lceil: "\u2308",
  ldquo: "\u201c",
  le: "\u2264",
  lfloor: "\u230a",
  lowast: "\u2217",
  loz: "\u25ca",
  lrm: "\u200e",
  lsaquo: "\u2039",
  lsquo: "\u2018",
  lt: "<",
  macr: "\u00af",
  mdash: "\u2014",
  micro: "\u00b5",
  middot: "\u00b7",
  minus: "\u2212",
  mu: "\u03bc",
  nabla: "\u2207",
  nbsp: "\u00a0",
  ndash: "\u2013",
  ne: "\u2260",
  ni: "\u220b",
  not: "\u00ac",
  notin: "\u2209",
  nsub: "\u2284",
  ntilde: "\u00f1",
  nu: "\u03bd",
  oacute: "\u00f3",
  ocirc: "\u00f4",
  oelig: "\u0153",
  ograve: "\u00f2",
  oline: "\u203e",
  omega: "\u03c9",
  omicron: "\u03bf",
  oplus: "\u2295",
  or: "\u2228",
  ordf: "\u00aa",
  ordm: "\u00ba",
  oslash: "\u00f8",
  otilde: "\u00f5",
  otimes: "\u2297",
  ouml: "\u00f6",
  para: "\u00b6",
  part: "\u2202",
  permil: "\u2030",
  perp: "\u22a5",
  phi: "\u03c6",
  pi: "\u03c0",
  piv: "\u03d6",
  plusmn: "\u00b1",
  pound: "\u00a3",
  prime: "\u2032",
  prod: "\u220f",
  prop: "\u221d",
  psi: "\u03c8",
  quot: '"',
  rArr: "\u21d2",
  radic: "\u221a",
  rang: "\u232a",
  raquo: "\u00bb",
  rarr: "\u2192",
  rceil: "\u2309",
  rdquo: "\u201d",
  real: "\u211c",
  reg: "\u00ae",
  rfloor: "\u230b",
  rho: "\u03c1",
  rlm: "\u200f",
  rsaquo: "\u203a",
  rsquo: "\u2019",
  sbquo: "\u201a",
  scaron: "\u0161",
  sdot: "\u22c5",
  sect: "\u00a7",
  shy: "\u00ad",
  sigma: "\u03c3",
  sigmaf: "\u03c2",
  sim: "\u223c",
  spades: "\u2660",
  sub: "\u2282",
  sube: "\u2286",
  sum: "\u2211",
  sup: "\u2283",
  sup1: "\u00b9",
  sup2: "\u00b2",
  sup3: "\u00b3",
  supe: "\u2287",
  szlig: "\u00df",
  tau: "\u03c4",
  there4: "\u2234",
  theta: "\u03b8",
  thetasym: "\u03d1",
  thinsp: "\u2009",
  thorn: "\u00fe",
  tilde: "\u02dc",
  times: "\u00d7",
  trade: "\u2122",
  uArr: "\u21d1",
  uacute: "\u00fa",
  uarr: "\u2191",
  ucirc: "\u00fb",
  ugrave: "\u00f9",
  uml: "\u00a8",
  upsih: "\u03d2",
  upsilon: "\u03c5",
  uuml: "\u00fc",
  weierp: "\u2118",
  xi: "\u03be",
  yacute: "\u00fd",
  yen: "\u00a5",
  yuml: "\u00ff",
  zeta: "\u03b6",
  zwj: "\u200d",
  zwnj: "\u200c",
};

/**
 * Decode the character references an HTML serializer writes into an attribute
 * value, so callers get the characters the author wrote.
 *
 * Supports HTML 4.01 named references, apos, legacy aliases and numeric references.
 * An unknown or malformed reference is left as literal text, which is what
 * a browser does. Single-pass — `&amp;lt;` decodes to the text `&lt;`
 * and stops, never to `<`, so an escaped entity inside a consumer's tag value
 * survives as itself.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, ref: string) => {
      if (ref[0] === "#") {
        const code =
          ref[1] === "x" || ref[1] === "X"
            ? Number.parseInt(ref.slice(2), 16)
            : Number.parseInt(ref.slice(1), 10);
        // Surrogates and out-of-range code points would throw; leave them be.
        if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return match;
        if (code >= 0xd800 && code <= 0xdfff) return match;
        return String.fromCodePoint(code);
      }
      return Object.hasOwn(NAMED_ENTITIES, ref) ? NAMED_ENTITIES[ref] : match;
    },
  );
}

/**
 * The value of the `name` attribute within an open tag's attribute string (the
 * text between the tag name and its closing `>`), or `null` when the attribute
 * is absent or its quoted value is never closed.
 *
 * Handles double-quoted, single-quoted and unquoted values, and matches the
 * attribute name case-insensitively, as HTML does. The value is
 * entity-decoded, because that is what the attribute means: the editor
 * serializes a tag value of `<% $email %>` as
 * `data-merge-tag="&lt;% $email %&gt;"`, and every caller compares the result
 * against a configured merge-tag token written in raw characters.
 */
export function getTagAttrValue(attrs: string, name: string): string | null {
  const target = name.toLowerCase();
  let i = 0;

  while (i < attrs.length) {
    while (i < attrs.length && (isWhitespace(attrs[i]) || attrs[i] === "/")) {
      i++;
    }
    if (i >= attrs.length) break;

    const nameStart = i;
    while (i < attrs.length && isAttrNameChar(attrs[i])) i++;
    const attrName = attrs.substring(nameStart, i).toLowerCase();
    if (attrName === "") {
      // Not a name character and not whitespace — e.g. a stray `=`. Step over
      // it so the scan always advances.
      i++;
      continue;
    }

    while (i < attrs.length && isWhitespace(attrs[i])) i++;
    if (attrs[i] !== "=") {
      // A boolean attribute (`hidden`); the cursor already sits on the next
      // attribute name, so don't consume anything here.
      continue;
    }
    i++; // past `=`
    while (i < attrs.length && isWhitespace(attrs[i])) i++;

    const quote = attrs[i];
    if (QUOTES.has(quote)) {
      const valueStart = i + 1;
      const valueEnd = attrs.indexOf(quote, valueStart);
      if (valueEnd === -1) return null; // unterminated value — nothing readable follows
      if (attrName === target)
        return decodeHtmlEntities(attrs.substring(valueStart, valueEnd));
      i = valueEnd + 1;
      continue;
    }

    const valueStart = i;
    while (i < attrs.length && !isWhitespace(attrs[i]) && attrs[i] !== ">") i++;
    if (attrName === target)
      return decodeHtmlEntities(attrs.substring(valueStart, i));
  }

  return null;
}
