# Custom blocks

**Read first:** [rules.md](rules.md) for what a template may contain ·
[live-setup.md](live-setup.md) for starting the preview
**Uses:** [scaffold.md](scaffold.md) for writing into their repository ·
[annotations.md](annotations.md) for notes left in the browser
**Related:** [providers.md](providers.md) for saved blocks

A custom block is a block *type* the consumer registers in code —
`init({ customBlocks: [definition] })` — with `fields` the end user fills in
and a Liquid `template` that renders them to email HTML. This mode writes one,
previews it in the real editor, and puts it in their codebase. It never emits
a custom block into a template; [rules.md](rules.md) still forbids that.

## 1. Triage

Ask what changes each time the block is used, and whether it belongs on
every email:

- **On every email, the same each time** — a footer with the company address,
  a legal line, view-in-browser: that is platform chrome, not a block. It is
  `init({ layout })`, per the shell rule in [rules.md](rules.md); hand back
  the layout document and point at [integrate.md](integrate.md). Stop.
- **The same each time, but placed in some emails only** — a promo banner
  reused across campaigns: that is a **saved block**, not a custom block: no
  code, no schema. The user builds it once and saves it with the bookmark
  action on the block in the editor; the library is stored by the
  `savedBlocks` provider —
  `init({ savedBlocks: createLocalStorageSavedBlocksProvider() })` (exported by
  `@templatical/editor`) for browser storage, or their own store. Set that up
  per [providers.md](providers.md) and stop.
- **Different each time** — end users fill in fields (a testimonial's quote
  and author), or the content comes from the consumer's backend (a product
  card filled from their catalogue API): that is a custom block. Go on.

## 2. Create or edit

- **Create**: go to §3.
- **Edit** ("change my testimonial block"): find the module in their repo
  (search for `customBlocks` and the block's `type`). Read it and resolve what
  the definition is built from — an imported `.liquid` file, field arrays
  spread from shared constants, computed values. Write the working file from
  the resolved definition (§3). An existing `dataSource` stays code: when its
  `onFetch` is a plain fetch by field value, derive a `dataSourcePreview`
  recipe from it; otherwise preview with sample values and say so.

## 3. The working file

Write `.templatical/custom-blocks/<type>.json`. It is the definition minus
`dataSource` (a function, written in §6), validated against
[custom-block-schema.json](custom-block-schema.json):

- `type` — a lowercase slug; the palette references it as `custom:<type>`.
- `fields` — one per thing that varies: `text`, `textarea`, `image`, `color`,
  `number` (`min`/`max`/`step`), `select` (`options`), `boolean`, `repeatable`
  (`fields`, `minItems`/`maxItems`). Give each a sensible `default`; the
  palette inserts with defaults.
- `template` — Liquid; each field `key` is a variable, a repeatable is
  iterated with `{% for item in <key> %}`.
- `stylesheet` — CSS emitted once into `<mj-head>`; for media queries and
  hover states only.

**Template rules** — the validator enforces most, follow all:

- Lay out with `<table role="presentation">`, never flex, grid or positioned
  `<div>`s; Outlook draws none of them.
- Inline styles. Nothing external, no `<style>` in the template — use
  `stylesheet`.
- The template is one string: no `{% include %}`, `{% render %}` or
  `{% layout %}`, since there is no other template file to load. The same
  holds for a recipe's `url` and `body`.
- Every `<img>` has `alt` (bound to a field, or `""` if decorative) and a
  `width` attribute.
- Wrap every optional field in `{% if <key> != blank %}` so an empty value
  renders nothing rather than an empty image or a stray label. A bare
  `{% if <key> %}` is not enough: Liquid treats an empty string as true, and a
  field the user cleared is an empty string.
- Prefix every stylesheet class `tplc-<type>-`; the SDK doesn't scope them.

### Backend data

If the content comes from their backend, ask for the endpoint, the method,
how it authenticates, and what the response looks like. Use the endpoint's
final URL — the preview doesn't follow redirects (a 3xx is reported as an
error naming its `Location`). For the credential, ask for the **name** of an
environment variable that holds it — never ask for the secret itself, and
never paste or write the token anywhere. Then add a recipe:

    "dataSourcePreview": {
      "label": "Fetch product",
      "request": {
        "url": "https://api.example.com/products/{{ productId }}",
        "headers": { "Authorization": "Bearer ${env:SHOP_API_TOKEN}" }
      },
      "map": { "name": "name", "price": "price.formatted", "imageUrl": "images[0].url" }
    }

Field values go in `url` and `body` only; `${env:NAME}` goes in header values
only — it is the one way a credential reaches the recipe. A `body` needs
`"method": "POST"`, and in a JSON body write each value as `{{ key | json }}`,
which adds the quotes and escapes them; a bare `"{{ key }}"` breaks on the
first quote a user types. Mapped values and
errors are redacted if they echo the secret. Check the recipe once before
opening the preview (`--values` must be a JSON object):

    npx -y @templatical/template-tools@0.50.0 custom-block fetch .templatical/custom-blocks/<type>.json --values '{"productId":"123"}' --json

`unmapped` lists `map` entries the response didn't contain — fix the paths
before going on. If the variable isn't set, ask the user to export it in the
shell that will run the preview.

If their source opens a picker in their own app, the recipe covers the
fetch-by-id half; the preview uses a fixed id, and §6 leaves a marked hook for
their picker.

## 4. Validate

    npx -y @templatical/template-tools@0.50.0 custom-block validate .templatical/custom-blocks/<type>.json --json

Fix every `error`. Treat `warning`s as defects unless there's a reason —
say the reason. Never start or reload the preview on an invalid definition. A
field only the recipe reads (the id it fetches by) counts as used.

To check the rendered output without the browser, render one state to a file:

    npx -y @templatical/template-tools@0.50.0 custom-block render .templatical/custom-blocks/<type>.json --state defaults --format mjml -o .templatical/custom-blocks/<type>.mjml

## 5. Live preview

Start it per [live-setup.md](live-setup.md), with the block instead of a
template:

    npx -y @templatical/template-tools@0.50.0 live --custom-block .templatical/custom-blocks/<type>.json --json

Add `--host .templatical/<template>.json` to show it inside one of their
templates. The canvas is a specimen sheet: the block with its defaults, with
every optional field empty, with long text, with repeatables at their limits,
with booleans flipped. Point the user at whichever state looks wrong.

With a recipe, add `--fetch --values '{"productId":"123"}'` (the values that
worked with `custom-block fetch`) to put a state filled from the real
endpoint at the top. It calls their API on start and on every `live reload`;
ask first if a call costs money or changes anything on their side. The
`fetch` entry in each reload's output says whether it worked.

The loop for every change: edit the working file → `custom-block validate` →
`live reload`. Notes the user leaves (Alt-click) arrive on `GET /content`, as
in [annotations.md](annotations.md). `divergent` there only means the user
typed into a specimen instance — read those values (they may be the defaults
the user wants) and reload without asking. The bridge never writes the
`--host` template, so a hand-edit to a host block in the browser is lost on
reload: when `divergent` shows host-block changes, tell the user that before
reloading (and copy the edit into the host file if they want it kept).

If `live` reports `alreadyRunning`, the server is already serving this block.
A server running for a different file or in template mode refuses to start
with an error naming it: run `live stop`, then start again. Stop the preview
with `live stop` when the user is done.

## 6. Handoff

With the user's go-ahead, put it in their codebase following
[scaffold.md](scaffold.md)'s detect → propose → write → verify steps:

- **New block**: a module exporting a typed constant —
  `export const testimonial: CustomBlockDefinition = { … }` (import the type
  from `@templatical/editor`) — added to their `init({ customBlocks })`.
  Generate `dataSource.onFetch` from the recipe: same URL, same mapping, the
  credential read the way their app already reads secrets (the env-var name is
  a hint, not their runtime config).
- **Existing block**: write back only the properties that changed, in place —
  never regenerate the module; their formatting, comments and imports stay. If
  a change lands in shared code (a constant other blocks use, an imported
  template file), say so before writing.
- **Renaming or removing a field key, or changing a field's type, breaks
  saved content**: templates already saved carry values under the old key.
  Say so before writing and offer to keep the old key.
- **Rendering outside the editor.** `editor.toMjml()` and a `render`
  provider's calls get every custom block's HTML and stylesheet from the
  editor; the payload carries both, so `renderToMjml(payload.content)` needs
  no options. A server rendering a *saved* template on its own (a scheduled
  send, an API export) gets neither: saved JSON holds field values, not HTML,
  so without `renderCustomBlock` the block is silently left out, and without
  `getCustomBlockStylesheet` its media queries are. Ask whether they render on
  a server; if so, keep the definition in a module the server can import too
  and wire both options where they call `renderToMjml`:

      import { Liquid } from "liquidjs";
      import { renderToMjml } from "@templatical/renderer";
      import { testimonial } from "./custom-blocks/testimonial";

      const definitions = new Map([[testimonial.type, testimonial]]);
      const liquid = new Liquid();
      const mjml = await renderToMjml(content, {
        renderCustomBlock: async (block) => {
          const definition = definitions.get(block.customType);
          return definition
            ? liquid.parseAndRender(definition.template, block.fieldValues)
            : "";
        },
        getCustomBlockStylesheet: (type) => definitions.get(type)?.stylesheet,
      });

  The server renders the saved field values; `dataSource.onFetch` runs only
  in the editor.
- **A check in their CI.** `checkCustomBlock` from
  `@templatical/template-tools` takes the module's exported object directly,
  `dataSource` included. Offer a test that asserts each shipped definition
  comes back `valid`, so a later edit to the template or fields can't
  regress silently.

If there's no repository, hand over the module and the `init()` snippet.

Client support findings from `custom-block validate` use `compat.*` IDs, sourced from [caniemail](https://www.caniemail.com/). Its strict error set is `compat.css-display-flex`, `compat.css-display-grid`, `compat.css-position`, `compat.html-svg`, `compat.html-script`, `compat.css-at-import`, and `compat.html-link`. `compat.html-style` is off here because `safety.style-tag` already covers a template `<style>`; the authoring checks `safety.unscoped-class`, `safety.empty-img-src`, `safety.img-alt`, and `safety.img-width` remain. Other compatibility findings are warning or info. Each issue includes a fix suggestion and reference.
