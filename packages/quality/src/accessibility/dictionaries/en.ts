/**
 * English vague-text dictionaries. Treated as the source of truth — other
 * locales annotate themselves `typeof en` so missing/extra phrases fail
 * typecheck.
 *
 * Phrases are matched case-insensitively against trimmed text content.
 */
const en = {
  vagueLinkText: [
    "click here",
    "here",
    "read more",
    "more",
    "learn more",
    "see more",
    "this",
    "this link",
    "link",
    "click",
  ],
  vagueButtonLabels: [
    "click here",
    "click",
    "submit",
    "go",
    "ok",
    "okay",
    "yes",
    "no",
  ],
};

export default en;
