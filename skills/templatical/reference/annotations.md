# annotations — notes left in the browser

**Part of:** [live.md](live.md)'s update loop — not a separate session

`GET /content` returns `annotations[]` alongside `{ divergent, content }`. Each
note is `{ id, blockId, parentBlockId, blockType, label, text, createdAt }`.
`blockId: null` is a note about the whole template. `parentBlockId` is the
block that contains the target, or `null` when the target is top-level.
`label` is the block's text at the moment the note was saved.

Nothing wakes you when a note is saved. The user asks, in chat, when they want
the queue applied.

## Applying the notes

When the user asks you to apply the notes ("apply my notes", "do these notes",
"make the changes I marked", including a request that also asks for something
else):

1. The browser copy is the base. When `divergent` is true, do not ask whether
   to replace their edits.
2. Before any edit, look at notes with a non-null `parentBlockId`. Where the
   text does not say whether it means that block or the parent, ask one
   question listing every such note, then wait. Do not edit the unambiguous
   notes first.
3. A note whose `blockId` is non-null and absent from `content` is skipped.
   Name it in the reply.
4. Apply the rest in one pass. Prefer an `edit` operation. Validate before a
   full rewrite, the same rule as any other live write.
5. On success, reload with the consume flag. That clears skipped notes too:
   ```
   npx -y @templatical/template-tools@0.44.2 live reload --consume-annotations --json
   ```
6. If the write or the reload fails, run a plain `live reload` (no flag) only
   when a reload is still required, and tell the user the notes are still there.
   Do not pass `--consume-annotations` after a failed write.

A successful reply says what changed and which notes were skipped.

## Reading the notes

When the user asks what the notes say, list them. Do not edit. Do not consume.

## Any other live request

Do the request. The divergence question in [live.md](live.md) stays. Reload
without `--consume-annotations`. When `annotations.length` is greater than 0,
add one sentence: `N notes are still waiting in the browser.` When the queue is
empty, say nothing about notes.
