/**
 * Who is using the editor right now — `init({ user })`.
 *
 * A **top-level config key, not part of any provider.** Comments are the first
 * feature to need it (the panel decides which comments may be edited or deleted
 * by comparing `id` against each author, and a new comment is attributed to
 * `name`), but collaboration presence will want exactly the same answer. Putting
 * it on the comments provider would guarantee a second, drifting copy the moment
 * the second feature landed.
 *
 * Features that need an identity **report themselves unavailable without one**
 * rather than falling back to an anonymous author. An unattributable comment is
 * worse than no comment feature — the same reasoning that makes an explicitly
 * empty `TestEmailProvider.allowedRecipients` disable the feature instead of
 * degrading to free text.
 *
 * Not a security boundary: this identifies the user to the editor's UI, in the
 * user's own browser. Whatever your provider writes must be attributed
 * server-side, from the session your backend already trusts.
 */
export interface EditorUser {
  /**
   * Stable identifier, compared against `Comment.author.id`. Whatever your
   * backend calls a user — a primary key, a UUID, an email.
   */
  id: string;
  /** Display name, shown on the comments this session writes. */
  name: string;
}
