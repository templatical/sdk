---
"@templatical/types": minor
"@templatical/quality": patch
"@templatical/ai-kit": patch
"@templatical/editor": patch
"@templatical/import-mjml": patch
"@templatical/import-html": patch
"@templatical/import-stripo": patch
---

Built-in merge-tag scanning, merge-tag span handling, and CSS rule parsing complete in linear time on malformed template input. Pixel value parsers reject long invalid whitespace suffixes without super-linear backtracking.
The types package exports `scanSyntaxMatches`, `scanCombinedSyntaxMatches`, and `SyntaxMatch`.
