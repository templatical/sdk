# Install and mount

**Read first:** [failure-modes.md](failure-modes.md) — before editing any of
their files
**Then:** [scaffold.md](scaffold.md) for the procedure to follow when writing
into their repository
**Consult:** [providers.md](providers.md) for the storage contracts ·
[version-awareness.md](version-awareness.md)
**Related:** [diagnose.md](diagnose.md) when a mount already exists and
misbehaves · [docs.md](docs.md) for anything not covered here

`@templatical/editor` is self-contained: Vue, TipTap and its other runtime
dependencies are all bundled inside it.

```bash
npm install @templatical/editor
```

`@templatical/renderer`, `@templatical/quality`, `@templatical/media-library`
and `pusher-js` are optional peers, each gated by a specific feature — install
only the ones actually used (see [failure-modes.md](failure-modes.md)).

## Vanilla

```html
<div id="editor" style="height: 100vh;"></div>

<script type="module">
  import { init } from "@templatical/editor";
  import "@templatical/editor/style.css";

  const editor = await init({ container: "#editor" });

  // Later, when removing the editor:
  editor.unmount();
</script>
```

## Framework

Same shape in any component-based framework: mount on the container ref,
unmount on cleanup. React shown; Vue, Svelte and Angular equivalents are in
[docs.md](docs.md) → `getting-started/installation`, under "Framework integration".

```tsx
import { useEffect, useRef } from "react";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import type { TemplaticalEditor } from "@templatical/editor";

export function EmailEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    (async () => {
      const ed = await init({ container: containerRef.current });
      if (!cancelled) editorRef.current = ed;
    })();
    return () => {
      cancelled = true;
      editorRef.current?.unmount();
    };
  }, []);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
```

## Cloud

`initCloud()` is the same mount with Cloud's storage, comments, saved blocks,
test email, rendering and AI wired in behind an auth endpoint the consumer
hosts — swap the import, add `auth`, nothing else about the mount changes:

```ts
import { initCloud } from "@templatical/editor";

const editor = await initCloud({
  container: "#editor",
  auth: { url: "/api/templatical/token" },
});
```

Issuing keys, plan entitlements and the Cloud account itself are Cloud's own
dashboard — this skill documents `initCloud()`'s shape and the provider
contracts it fills in, not signup. The auth endpoint the consumer's server
needs to implement is in [docs.md](docs.md) → `cloud/getting-started`.
