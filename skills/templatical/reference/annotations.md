# annotations — notes left in the browser

**Part of:** [live.md](live.md)'s update loop — not a separate session

`GET /content` returns `annotations[]` alongside `{ divergent, content }`. Each
is a note the user attached to a block in the browser rather than typing in
chat: `{ id, blockId, text, createdAt }`, with `blockId: null` for a note about
the template as a whole.

Treat each one as a request scoped to its block, and act on it together with
whatever the user asked for in the same turn. `live reload` clears them, so they
are never acted on twice.

**A note is picked up on your next turn, not the moment it is written.** Nothing
can wake an agent from a web page, and a user who expects otherwise reads the
delay as a bug — say so once, when live mode starts.
