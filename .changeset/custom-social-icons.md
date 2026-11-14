---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/editor": patch
"@templatical/quality": patch
"@templatical/template-tools": patch
"@templatical/ai-kit": patch
---

Fix the custom social icon regression (#1214): a social icon can be your own image, `platform: "custom"` with an `imageUrl`, in the same row as the built-in icons, so an imported custom icon no longer has to lose either its image or its place in the row.

`SocialIcon` is now `BuiltInSocialIcon | CustomSocialIcon`. A `CustomSocialIcon` is `{ id, platform: "custom", url, imageUrl, alt? }`: `imageUrl` is the icon image and `alt` the text a screen reader reads in its place. The renderer writes it as an `mj-social-element` with `src`, `alt` and `href`, at the block's icon size, with no network name, so none of MJML's network colors apply, with square corners, and with the class `tpl-social-custom`, which marks it as a custom icon for the MJML importer. The block's `iconStyle` and `iconTone` don't change a custom image: it is shown as it is, as wide as `iconSize` and in its own proportions. A custom icon with an empty `imageUrl` is left out of the email. Stored templates without a custom icon render exactly as before.

In the editor, an icon's platform list ends with **Custom icon**, which shows an image field, an alt text field and the link. The image field has the image block's Browse button and drag-and-drop upload, through the same `onRequestMedia` handler, so a host that handles images there needs no change. The canvas draws the image as the email does: as wide as the icon size, in its own proportions.

`@templatical/quality` adds two rules: `structure.social-icon-missing-image` (structure, error) for a custom icon with no image, and `a11y.social-icon-missing-alt` (accessibility, warning) for one with no alt text. The compatibility image checks also read a custom icon's `imageUrl`. In a localized template, a custom icon's `alt` is translatable (`TRANSLATABLE_FIELDS.social` is `["icons.*.alt"]`). The JSON schemas in `@templatical/template-tools` and `@templatical/ai-kit` describe the new icon.

The TypeScript changes to `SocialIcon`, `SocialPlatform`, `SOCIAL_ICON_GLYPHS` and `socialIconColors()` are listed in their own entry.
