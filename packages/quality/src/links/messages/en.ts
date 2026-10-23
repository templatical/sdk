const en = {
  "link.javascript-protocol": {
    message:
      'URL uses the "{protocol}:" protocol, which can execute arbitrary script and is stripped at render time for safety.',
    suggestion: "Replace it with a real link or remove the URL.",
  },
  "link.unsupported-protocol": {
    message:
      'URL uses the "{protocol}" protocol, which most email clients do not support.',
    suggestion: "Use http, https, mailto, tel, or sms.",
  },
  "link.malformed-mailto": {
    message: "mailto: link is malformed.",
    suggestion:
      "Put a single recipient address before any query string (e.g. mailto:hello@example.com).",
  },
  "link.malformed-tel": {
    message:
      "tel: link contains characters that are not digits, +, spaces, dashes, parentheses, or dots.",
    suggestion:
      "Use only digits, +, spaces, dashes, parentheses, or dots in the phone number.",
  },
  "link.localhost-or-staging": {
    message: 'URL host "{host}" matches a non-production pattern.',
    suggestion: "Replace with the production URL before sending.",
  },
  "link.relative-url": {
    message:
      'URL "{url}" is relative. A sent email has no page address to resolve it against, so the link breaks.',
    suggestion: "Use an absolute URL (https://…).",
  },
};

export default en;
