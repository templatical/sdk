---
"@templatical/quality": minor
---

New `link.relative-url` rule (warning). It flags a link whose URL starts with `/`, `./`, `../` or `?`, or is protocol-relative (`//host`). A sent email has no page address to resolve such a URL against, so the link breaks in the inbox. Only these path-shaped prefixes count, so a URL that opens with a merge tag (`{{ unsubscribe_url }}`) is never flagged. Lower it, raise it or turn it off through `links.rules`.
