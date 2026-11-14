---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

A social icon can be your own image: `platform: "custom"` with an `imageUrl`, in the same row as the built-in icons.

`SocialIcon` is now `BuiltInSocialIcon | CustomSocialIcon`. A `CustomSocialIcon` is `{ id, platform: "custom", url, imageUrl, alt? }`: `imageUrl` is the icon image and `alt` the text a screen reader reads in its place. The renderer writes it as an `mj-social-element` with `src`, `alt` and `href`, at the block's icon size, with no network name, so none of MJML's network colors apply, and with square corners. The block's `iconStyle` and `iconTone` don't change a custom image: it is shown as it is, as a square at `iconSize`. A custom icon with an empty `imageUrl` is left out of the email. Stored templates without a custom icon render exactly as before.

In the editor, an icon's platform list ends with **Custom icon**, which shows an image field, an alt text field and the link. The image field has the image block's Browse button and drag-and-drop upload, through the same `onRequestMedia` handler, so a host that handles images there needs no change. The canvas draws the image at the icon size.

`@templatical/quality` adds two rules: `social-icon-missing-image` (structure, error) for a custom icon with no image, and `social-icon-missing-alt` (accessibility, warning) for one with no alt text. The compatibility image checks also read a custom icon's `imageUrl`. In a localized template, a custom icon's `alt` is translatable (`TRANSLATABLE_FIELDS.social` is `["icons.*.alt"]`). The JSON schemas in `@templatical/template-tools` and `@templatical/ai-kit` describe the new icon.

Breaking changes (TypeScript only; stored templates are unaffected):

- `SocialPlatform` gains `"custom"`, which has no glyph. A map keyed by every platform with a glyph should use the new `BuiltInSocialPlatform` (`Exclude<SocialPlatform, "custom">`) instead of `SocialPlatform`.
- `SOCIAL_ICON_GLYPHS` is keyed by `BuiltInSocialPlatform`, and `socialIconColors()` takes a `BuiltInSocialPlatform`. Check `icon.platform !== "custom"` before passing an icon's platform to either.
- `SocialIcon` is a union, so code that builds an icon object needs the `BuiltInSocialIcon` or `CustomSocialIcon` shape.
