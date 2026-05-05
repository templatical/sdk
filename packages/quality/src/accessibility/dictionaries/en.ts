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
  /**
   * Action verbs that signal a linked image's alt describes the link
   * destination, not just the visual subject. Used by `img-linked-no-context`.
   * Stored lowercase; tokenized matching is case-insensitive.
   */
  linkedImageActionHints: [
    "buy",
    "shop",
    "view",
    "read",
    "learn",
    "open",
    "go",
    "see",
    "explore",
    "discover",
    "browse",
    "download",
    "get",
    "claim",
    "redeem",
    "watch",
  ],
};

export default en;
