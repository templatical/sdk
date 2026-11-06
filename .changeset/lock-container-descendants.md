---
"@templatical/types": minor
"@templatical/core": minor
---

Breaking changes:

- `deleteBlock` and `moveBlock` refuse a section or wrapper while another session holds a lock on any block inside it. There is no override: wait for the lock to be released, or move the unlocked blocks out first.
- `updateBlock` on a section refuses a `type` change or a `children` rewrite that would remove or overwrite a block another session has locked. Wait for the lock to be released.
- `updateBlock` on a section refuses incoming `children` whose ids are locked by another session, already used outside that section, or repeated within the incoming children. Give new children unique ids that aren't in use elsewhere.
- A `moveBlock` or `deleteBlock` on a wrapper with a peer-locked descendant now fails with `lock_held` before its `expect` is checked, so a stale `expect` there returns `lock_held` instead of `precondition_failed`. Handle `lock_held` as well as `precondition_failed` when retrying.
- With a language selected, a section rewrite that would leave duplicate ids once existing children are restored is refused. Send a rewrite whose restored tree keeps every id unique.

Lock checks now reach descendants of wrappers as well as section columns. In the default language, a rewrite that moves a block out of its section is accepted.
