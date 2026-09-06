---
title: Version History
description: Templatical Cloud as one implementation of the version-history contract.
---

# Version History

Version history is an [open contract](/backend/version-history). Templatical Cloud implements it, the same way your own backend would.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nothing to configure. Cloud supplies the provider, and the header's history control appears as soon as a template is created or loaded.

## The adapter

| Method | Cloud |
|---|---|
| `list` | Returns every version for the template, **with its content** — so scrubbing through history never waits |
| `get` | Fetches one version's content |
| `create` | Records a version on demand |
| `restore` | An atomic, audited server endpoint |

Both mutations are enabled: version storage is part of what the plan pays for, so there is no Cloud tier that can list history but not restore it.

## Automatic versions

Cloud's **templates** adapter records them as part of its own `save`, throttled to at most one per minute. That is the contract's rule for every implementation — [whoever owns the storage owns the retention policy](/backend/version-history#recording-versions). A save that only renames the template records nothing.

## Bringing your own

Not the storage. A version is keyed to a template id **Cloud issued**, and Cloud's `templates` adapter records an automatic version as part of every save, and that same id anchors collaboration, comments, AI rewrite, scoring and the server-side export — which is why `initCloud()` accepts a `templates` key for [its configuration and events](/cloud/templates#bringing-your-own), never a full provider. A consumer-supplied history would drive the UI while Cloud carried on writing versions into its own store: two stores, one of them invisible and billable.

`versionHistory` follows the same shape. `initCloud({ versionHistory })` takes `VersionHistoryOptions` — `onCreated`, `onRestored` — and nothing else: no boolean to turn it off, no full-provider form. A value carrying `list` / `get` / `create` / `restore` still has those methods ignored, named in a console warning, with only its events kept.

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  versionHistory: {
    onRestored: (template) => navigate(`/templates/${template.id}`),
  },
});
```

Bring your own storage with [`init()`](/backend/version-history), where the whole set — templates, version history, rendering — is yours.

## Events

```ts
versionHistory: {
  onCreated: (version) => {},
  onRestored: (template) => {},
}
```

The same events as the [open contract](/backend/version-history#events).

## Headless use

```js
import { createCloudVersionHistoryProvider } from '@templatical/core/cloud';
import { useVersionHistory } from '@templatical/core';

const history = useVersionHistory({
  provider: createCloudVersionHistoryProvider(authManager),
  getTemplateId: () => 'template-id',
});

await history.load();
await history.restore(history.versions.value[1].id);
```

The `ApiClient` methods underneath are `getVersions`, `getVersion`, `createVersion` and `restoreVersion` — see the [headless API](/cloud/headless-api).
