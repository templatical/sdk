# @templatical/ai-kit

## 0.57.2

### Patch Changes

- Updated dependencies [27eb4be]
  - @templatical/types@0.57.2

## 0.57.1

### Patch Changes

- 818714d: The shipped eval set's domain-mismatch case checks link text with `>[^<>]*(?:www\.|://)` instead of `>(?:[^<]*)(?:www\.|://)`. It matches the same text, and checking a turn whose output holds a long run of `>` no longer takes quadratic time.
- Updated dependencies [36bc74f]
- Updated dependencies [c05e2a8]
  - @templatical/types@0.57.1

## 0.57.0

### Minor Changes

- cfaff50: Breaking changes:

  - Editing sessions refuse a locale layer (in `addBlock`, `setContent` or `updateBlockLocale`) that sets a block's `type` or changes its `customType`, including when `setDefaultLocale` promotes the layer and `removeLocale` removes the old default in the same batch. A block's type and custom schema are the same in every language: to use another type, `deleteBlock` the block and `addBlock` one of the new type, then translate its fields in that block's layer.
  - A locale layer's `set.children` may keep a `custom`, `slot`, or `wrapper` block only when the base content already has a block with the same `id` and `type`, and a `custom` block also keeps its `customType`; it cannot introduce one. To localize such a block, put it in the base content first with the same `id`, `type` and `customType` (outside the session, or with `addBlock` when its type isn't in `forbiddenBlockTypes`), then change its translatable fields in the layer.
  - A block in a locale layer's `set.children` keeps the type of the block with the same `id` in the content; a German child can't turn a base paragraph into a title. For a title in one language only, put a title with an `id` the base content doesn't use in that locale's `set.children`.
  - A template whose `settings.locales` isn't a list of strings is refused. Send `settings.locales` as an array of locale tags, or omit it.
  - A malformed locale layer is refused as invalid: a block or settings layer that isn't an object, or one whose `set` or `text` isn't an object. Send `{ set?: {…}, text?: {…} }` objects, or omit the layer.
  - When the content already holds a layer breaking these rules, a batch that leaves that layer in place is refused, even if it doesn't touch that block. Delete the block that holds the layer, or replace the affected content with `setContent`. A malformed layer is refused even then, and a running session can't repair it: fix or remove the layer outside the session, then call `createEditingSession` again with the repaired content.

  These rules apply to locale layers only. `setContent` can still change an existing block's base type under the same `id`, for example from paragraph to title.

- a2f3ed8: Breaking changes:

  - `addBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Add wrappers at the top level with `parent: null`.
  - `moveBlock` no longer accepts a wrapper with a `{ sectionId, column }` parent. Move wrappers to the top level with `parent: null`.
  - A malformed `moveBlock.expect.parent` is refused as `invalid_operation` at the shape check instead of failing as `precondition_failed`. Send `null`, `{ sectionId, column }` or `{ wrapperId }`.
  - `addBlock`, `moveBlock` and `updateBlock` refuse a section with `section.wrapper` inside a layout wrapper. Keep the section at the top level or remove its own wrapper before placing it inside one. `validateLayout` rejects the same nesting.

  Operations can address wrapper children with `{ wrapperId }` while existing section-column addresses keep their wire shape. The engine, inverses, collaboration diffs, AI feedback and CLI apply wrapper-child edits with placement, lock and hidden-slot checks.

### Patch Changes

- e614847: An editing session checks locale layers in time proportional to the template size. Each locale is resolved only for the blocks that carry its layer, so a template with thousands of locales no longer makes every batch resolve the whole template once per locale.
- c17eaf5: `translateFields` sends the model short field aliases

  The model now sees each field as `f1`, `f2`, … instead of its long id, which shortens its answer. The returned `TranslationResult` still carries the real field ids in request order; the `TranslationRequest` and `TranslationResult` contract and the HTTP wire are unchanged.

- Updated dependencies [ad58b8e]
- Updated dependencies [0bdfeac]
- Updated dependencies [0511bb6]
- Updated dependencies [a2f3ed8]
  - @templatical/types@0.57.0

## 0.56.1

### Patch Changes

- @templatical/types@0.56.1

## 0.56.0

### Minor Changes

- 5744da5: `displayConditions.onRequest` lets a host open its own condition builder. The callback receives a copy of the block and, when one is set, the current condition including opaque `data`. `null` cancels. `conditions` is optional. With `onRequest` set, `conditions` and `allowCustom` are ignored. `DisplayCondition.data` round-trips through the template.
- f9de817: A section wrapper or a layout wrapper can span the recipient's window. Set `fullWidth: true` on `section.wrapper` or on a layout `wrapper` block and the renderer emits MJML's `full-width="full-width"` on that `mj-wrapper`: the band's background color and background image run edge to edge, and the section or the wrapper's children stay at `settings.width`. Omit `fullWidth`, or set it `false`, and the band stays the email width, exactly as before. A corner radius is not rendered while full width is on; the stored radius remains and comes back when full width is off.

  In the editor, **Full-width background** in a section's Background panel sets this. With no wrapper yet, turning it on moves the section's own background color and image onto a new wrapper and clears them on the section. While the switch is on, that panel's color and image edit the band, and **Content background** sets the section fill. Turning it off clears the flag; a wrapper that holds only that band is removed and its color and image return to the section, unless the section already has a content fill, which keeps the wrapper so neither color is discarded. The Wrapper panel shows the same switch and the same band color and image. A layout wrapper block has the same switch on its Background panel. On the canvas, and in preview, the band reaches the edges of the pane while the content stays at the email width.

  This is the band people migrating from Topol have been asking for (sdk#1105). Importers set `fullWidth` when the source states that band.

- 2466654: Breaking changes:

  - `ColumnLayout` gains `"4"`, `"1-3"`, `"3-1"` and `"1-2-1"`. Code that switches over every layout value, or validates `section.columns` against the previous five, must handle these four values. There is no replacement value: a section may now have four columns.

  Section columns accept four more layouts: `"4"` (four equal columns, 25% each), `"1-3"` (25/75), `"3-1"` (75/25), and `"1-2-1"` (25/50/25). A four-column section stacks to one column on mobile, the same as the two- and three-column layouts. `stackOnMobile: false` keeps any of these layouts side by side.

### Patch Changes

- Updated dependencies [5744da5]
- Updated dependencies [f9de817]
- Updated dependencies [2466654]
- Updated dependencies [be84dd0]
  - @templatical/types@0.56.0

## 0.55.0

### Minor Changes

- 200ab00: Two optional block fields. Leaving either out renders exactly as before.

  - **Button `fontWeight`:** `"regular"` (400), `"medium"` (500) or `"bold"` (700), rendered as `mj-button font-weight`. Without it the label stays bold. The editor's button settings offer Regular, Medium and Bold (choosing Bold clears the field), with labels in all eight locales.
  - **Image `fluidOnMobile`:** `true` always emits MJML `fluid-on-mobile="true"` and `false` never does. Without it an image still goes full width on a phone only when it fills its column on desktop; video thumbnails are unchanged. The editor's image settings offer Automatic, Always and Never, with labels in all eight locales.

  The JSON schema, the `template-tools` validator and the agent skill's block guide include both fields.

- e784e63: `SocialPlatform` includes `xing`. Social icon blocks can use a XING icon, drawn from the same glyph as the other platforms, in the editor and in every rendered style and tone.

  BeeFree, MJML, Stripo, Unlayer, Topol and Chamaileon imports map a Xing icon onto `xing`. A BeeFree icon is recognized from its id, name, alt, title or a `xing.com` link, instead of being kept as an image.

### Patch Changes

- 9151730: Built-in merge-tag scanning, merge-tag span handling, and CSS rule parsing complete in linear time on malformed template input. Pixel value parsers reject long invalid whitespace suffixes without super-linear backtracking.
  The types package exports `scanSyntaxMatches`, `scanCombinedSyntaxMatches`, and `SyntaxMatch`.
- Updated dependencies [200ab00]
- Updated dependencies [9151730]
- Updated dependencies [e784e63]
  - @templatical/types@0.55.0

## 0.54.2

### Patch Changes

- Updated dependencies [a72fbd8]
  - @templatical/types@0.54.2

## 0.54.1

### Patch Changes

- @templatical/types@0.54.1

## 0.54.0

### Patch Changes

- @templatical/types@0.54.0

## 0.53.0

### Minor Changes

- cef9348: Translation over your own backend

  Breaking changes:

  - TypeScript producers must set the now required `AiRequestBase.locale` and `AiRewriteRequest.locale` to the active language, or `null` in the default view, and `CollaborationRemoteChange.locale` to the first locale operation's language in a batch, excluding `setDefaultLocale`, or `null` when there is none. Code that builds these objects must set them even without localization enabled.

  Otherwise existing templates need no migration. Keep every `@templatical/*` package on the same version.

  - `createHttpTranslationProvider` and the `translate` wire route (`POST /templates/{template}/translate`), with `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance`.
  - `translateFields` requires every requested field id once with its placeholders intact, makes one repair attempt for failed fields and returns the fields that pass.
  - AI requests and prompts carry the active language as `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

  See [Translation](https://docs.templatical.com/backend/translation).

### Patch Changes

- Updated dependencies [cef9348]
  - @templatical/types@0.53.0

## 0.52.1

### Patch Changes

- Updated dependencies [2da7d6a]
  - @templatical/types@0.52.1

## 0.52.0

### Patch Changes

- Updated dependencies [9881028]
- Updated dependencies [72d142d]
  - @templatical/types@0.52.0

## 0.51.1

### Patch Changes

- @templatical/types@0.51.1

## 0.51.0

### Minor Changes

- 2162c87: First-party model adapters

  - `@templatical/ai-kit/adapters/anthropic`, `/adapters/openai` and `/adapters/vercel` export `createAnthropicAdapter`, `createOpenAiAdapter` (Chat Completions) and `createVercelAdapter`, each an `AiModelAdapter`. You pass the client (`new Anthropic()`, `new OpenAI()`, `new AzureOpenAI()`) or the AI SDK model. `@anthropic-ai/sdk`, `openai` and `ai` are optional peers.
  - All three take image Blobs, PDF Blobs and image URLs. A 429 rejects with `ThrottledError`, a refusal with `ai_provider_error`, and a tool call cut off at the token limit with `ai_output_invalid`. The Anthropic adapter caches the system prompt by default (`cache: false` turns it off).
  - `AiModelPart` gains `{ type: "state", state }`, and the assistant `AiModelMessage` gains `state`: an adapter's own record of a step, such as the model's thinking, which `runEditingTurn` hands back on the next step.
  - `AiUsage` gains `cacheReadInputTokens` and `cacheWriteInputTokens`. `inputTokens` counts only the uncached input.

### Patch Changes

- @templatical/types@0.51.0

## 0.50.0

### Minor Changes

- 61518b7: New package `@templatical/ai-kit`, MIT and with no LLM SDK dependency: the editor's AI over your own backend.

  - **Client:** `createHttpAiProvider`, an `AiProvider` over a documented REST and SSE wire. A chat message with attachments goes as multipart, with one `attachment` part per file.
  - **Server kit:** `readAiRequest`, the prompts, the `apply_operations` tool (`applyOperationsTool`), `runEditingTurn`, `aiEventStream` for any Fetch API server, error responses, and the output checks `checkRewrite` and `checkAltText`.
  - **Test kit:** `runAiProviderConformance` and `runAiWireConformance`; `createMockAiProvider` with recorded streams (`AI_RECORDINGS`); and an eval set of edit, fix and alt-text cases, run with `runAiEvalSet`, `evalTurnWith` and `evalAltTextWith`. The eval fixtures ship in `eval/`.

### Patch Changes

- Updated dependencies [61518b7]
- Updated dependencies [3af9072]
  - @templatical/types@0.50.0
