---
"@templatical/types": patch
---

Breaking changes:

- `SocialPlatform` gains `"custom"`, which has no glyph. A map keyed by every platform with a glyph should use the new `BuiltInSocialPlatform` (`Exclude<SocialPlatform, "custom">`) instead of `SocialPlatform`.
- `SOCIAL_ICON_GLYPHS` is keyed by `BuiltInSocialPlatform`, and `socialIconColors()` takes a `BuiltInSocialPlatform`. Check `icon.platform !== "custom"` before passing an icon's platform to either.
- `SocialIcon` is now `BuiltInSocialIcon | CustomSocialIcon`, so code that builds an icon object needs one of those two shapes. A `CustomSocialIcon` is `{ id, platform: "custom", url, imageUrl, alt? }`.

These are TypeScript-only: stored templates are unaffected, and every existing icon is a valid `BuiltInSocialIcon`.
