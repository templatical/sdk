---
title: Saved Blocks
description: Templatical Cloud as one implementation of the saved-blocks storage contract.
---

# Saved Blocks

Saved blocks are an [open contract](/backend/saved-blocks). Templatical Cloud implements it, the same way your own backend would.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nothing to configure — this one is on by default. Cloud supplies the provider, and the library rail appears in the sidebar.

## The adapter

| Method | Cloud |
| --- | --- |
| `list` | Every saved block on the project, in the order Cloud returns them |
| `create` | Stores a block with its name and optional category |
| `update` | Renames or recategorises |
| `delete` | Removes it from the project |

**One library per project**, shared by everyone on it — a block one teammate saves is in another's browser on their next open. That is the part with no OSS equivalent: not the storage, but the fact that it is already shared.

All four are enabled. Cloud's library is gated on the `saved_modules` plan feature.

## Bringing your own

You can, and this is one of only two providers `initCloud()` accepts as a full swap — `testEmail` is the other. The key takes the same type as `init()`'s, plus a third shape unique to this entry point: keep Cloud's library and add your own event handlers.

```ts
await initCloud({ container, auth });                             // Cloud's library
await initCloud({ container, auth, savedBlocks: { onCreated } }); // Cloud's library, plus your events
await initCloud({ container, auth, savedBlocks: mine });          // your own, on Cloud
await initCloud({ container, auth, savedBlocks: false });         // off
```

Cloud tells them apart by `list`, never by whether the value is an object: something with a working `list` replaces Cloud's store outright, and anything else — `true`, `false`, an events-only object — keeps Cloud's own store and forwards whatever events it carries onto it.

It mixes safely because Cloud never independently uses the library: a saved block is cloned onto the canvas and read nowhere else, so there is no second store to disagree with.

A provider you supply is **not** plan-gated — the plan feature licenses Cloud's *storage*, not the editor's UI. An events-only object stays plan-gated, since Cloud's own store is still the one doing the work.

## Events

```ts
savedBlocks: {
  onCreated: (block) => {},
  onUpdated: (block) => {},
  onDeleted: (block) => {},
}
```

The same events as the [open contract](/backend/saved-blocks#events), fired whether the store behind them is Cloud's or your own.

## Headless use

The REST methods keep their original `module` wording — `listModules`, `createModule`, `updateModule`, `deleteModule`. See the [headless API](/cloud/headless-api#saved-blocks).
