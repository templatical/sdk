## What it does

Multiple people, same template, zero step-on-toes.

- **Live cursors and presence** — See who’s editing, what they’re looking at, and where their caret is.
- **Per-block locking** — When someone’s editing the hero, it locks for them. Everyone else sees the lock indicator and stays productive elsewhere.
- **Broadcast sync** — Every change flows through a Pusher-protocol WebSocket, applied by a deterministic reducer. No document conflicts, no merge dialogs.

## Under the hood

The OSS editor’s state machine is collaboration-ready by design: every change is an explicit command with a reducer. Cloud wires those commands through a presence channel so every connected client converges to the same state.

## Good fits

- Marketing + design pairs working a template together
- Senior editors reviewing while juniors compose
- Review calls where everyone needs the same live view
