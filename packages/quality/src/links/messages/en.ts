/**
 * English link-rule messages. The source of truth — other locales annotate
 * themselves `typeof en` so missing or extra keys fail typecheck.
 *
 * Templates use `{name}` placeholders, interpolated by `formatLinkMessage`.
 */
const en = {
  "link.javascript-protocol":
    'URL uses the "{protocol}:" protocol, which can execute arbitrary script and is stripped at render time for safety. Replace it with a real link or remove the URL.',
  "link.unsupported-protocol":
    'URL uses the "{protocol}" protocol, which most email clients do not support. Use http, https, mailto, tel, or sms.',
  "link.malformed-mailto":
    "mailto: link is malformed. Expected a single recipient address before any query string (e.g. mailto:hello@example.com).",
  "link.malformed-tel":
    "tel: link contains characters that are not digits, +, spaces, dashes, parentheses, or dots.",
  "link.localhost-or-staging":
    'URL host "{host}" matches a non-production pattern. Replace with the production URL before sending.',
};

export default en;
