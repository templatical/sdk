---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/editor": patch
"@templatical/template-tools": patch
---

Custom-block Liquid renders now have budgets: `createCustomBlockLiquid` sets `memoryLimit` to `CUSTOM_BLOCK_LIQUID_MEMORY_LIMIT` (`1e7`) and `renderLimit` to `CUSTOM_BLOCK_LIQUID_RENDER_LIMIT` (2000 ms), both exported from `@templatical/types`, so a template such as a loop over `(1..1000000000)` fails with a Liquid limit error in the editor, `renderToMjml` and `custom-block validate` instead of exhausting memory. Data-source preview recipes render with the same limits.

`template-tools custom-block validate` rejects a repeatable `minItems` or `maxItems` above 100 (`field.items-limit`), and specimen lists never hold more than 100 items. A `dataSourcePreview` response larger than 1 MiB of decoded data is cancelled and the fetch fails.

`templatical live reload` and `live stop` act only after the server on the pidfile's port answers `GET /identity` with this directory and the pidfile's pid, and `live stop` exits it with `POST /shutdown` and sends no signal: when that request fails, it exits 2 naming the pid and keeps the pidfile. A live server started by an earlier version has no `/identity`, so the new `live reload` and `live stop` refuse its pidfile: stop that server with Ctrl-C (or the earlier version's `live stop`) before upgrading, then run `live` again. A pidfile with a non-positive pid or an out-of-range port is ignored, and `live` refuses to start over a pidfile whose process is running but doesn't answer as this workspace's server, naming the pidfile to delete if that process isn't a live server. A live preview page that stops reading receives only the latest pending update, and `openBrowser` opens only `http:` and `https:` URLs, through `rundll32.exe` on Windows rather than `cmd`.
