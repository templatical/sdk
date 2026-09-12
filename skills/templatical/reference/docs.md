# docs — answer a question from the reference

**Related:** [integrate.md](integrate.md) and [diagnose.md](diagnose.md) both
send you here for anything they do not cover

The SDK reference is **not bundled with this skill**. It is fetched, so it is
always current — a packed copy would be frozen at install time, and these docs
change faster than anyone reinstalls a skill.

## The two fetches

1. **The index.** `https://docs.templatical.com/llms.txt` — every page, grouped,
   one line each with its title, URL and a one-sentence description. Read it and
   pick the single page that answers the question.
2. **The page.** Append `.md` to that page's URL to get its raw markdown —
   `https://docs.templatical.com/getting-started/installation.md`. Fetch the
   rendered HTML only if the markdown route fails; HTML mangles this product's
   own merge-tag and logic-tag syntax in every example.

Fetch one page, not several. If the index offers no page that fits, say so
rather than fetching a near-match and answering from it.

## If you have no web-fetch tool

Use the shell, which this skill already requires for every command:

```
curl -s https://docs.templatical.com/llms.txt
```

If neither is available, give the user the URL and say what to look for. Do not
answer an SDK reference question from memory — version-specific details are
exactly what this route exists to get right.

## Version skew

`https://docs.templatical.com/llms-meta.json` carries the `sdkVersion` the docs
describe. When it differs from the `@templatical/editor` version in the user's
project, say so before giving instructions — a feature documented for a later
version will simply not be there.
