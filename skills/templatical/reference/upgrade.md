# Upgrading to a newer release

**Read first:** [version-awareness.md](version-awareness.md)
**Consult:** [providers.md](providers.md) when an entry changes a provider
contract · [docs.md](docs.md) for the target release's reference ·
[validate.md](validate.md) for reading the self-check
**Related:** [diagnose.md](diagnose.md) when the app misbehaves after the
upgrade and no changelog entry explains it

Every `@templatical/*` package releases in one fixed group, so an upgrade moves
all of them to the same version. Before 1.0, `minor` is the breaking channel: a
`minor` entry can remove an export, rename an option or change a default.
Breaking changes are applied from the changelog's own notes, entry by entry,
never from memory.

When the user only asks what an upgrade would involve ("can we take it?",
"what breaks?"), stop after step 4 and report the triage. Edit nothing.

## 1. Installed version

Read the resolved version of every `@templatical/*` dependency from the
lockfile, not the range in `package.json`. When they differ, the oldest is the
installed version, and aligning them is part of the upgrade.

## 2. Target version

The version the user names, or `sdkVersion` from
`https://docs.templatical.com/llms-meta.json` when they ask for the latest.

Compare that `sdkVersion` with the version this skill pins in
[cli.md](cli.md). A pin older than `sdkVersion` means this copy of the skill
predates the latest release: offer `npx skills update templatical` before
anything else. If the user declines, carry on and say in the report that the
self-check ran at an older version than the target. A target the user names
that is older than the pin needs nothing: say the self-check ran at the pin.

## 3. Changelog entries in range

`https://docs.templatical.com/changelog.json` lists every release, newest
first. It runs to several hundred kilobytes, more than a summarizing fetch
tool returns whole, so print only the range with Node (the skill already
requires Node 20+), after the installed version up to and including the
target, oldest first:

```
node -e 'const [from, to] = process.argv.slice(1).map((v) => v.split(".").map(Number));
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
fetch("https://docs.templatical.com/changelog.json").then((r) => r.json()).then(({ versions }) => {
  for (const { version, date, changes } of versions.toReversed()) {
    const v = version.split(".").map(Number);
    if (cmp(v, from) <= 0 || cmp(v, to) > 0) continue;
    for (const c of changes) console.log(`## ${version} (${date}) ${c.level}: ${c.title}\n${c.packages.join(", ")}\n\n${c.body}\n`);
  }
});' <installed> <target>
```

| Field | Holds |
|---|---|
| `versions[].version` | The release |
| `versions[].date` | Its release date, `YYYY-MM-DD` |
| `versions[].changes[].level` | `major`, `minor` or `patch` |
| `versions[].changes[].title` | The entry's first line |
| `versions[].changes[].body` | The rest of the entry, Markdown |
| `versions[].changes[].packages` | The packages whose changelog carries the entry |

## 4. Triage

Read every entry in range. The order below decides what to read first; it
never filters an entry out.

1. Entries whose body says `Breaking`, `Removed exports`, removed, renamed,
   now required or no longer. The marker's wording varies from release to
   release, and some breaking entries carry none.
2. The remaining `minor` entries. A category that becomes default-on changes
   what an existing config does without any marker: a `lint` config that turns
   off every category it knew about keeps linting with the new one.
3. The `patch` entries.

For each entry, search the consumer's code for every export, `init()` option,
type, event, CSS class and translation key it names. The entry applies when
its names appear there, or when it changes a default the consumer relies on.
Don't skip an entry because its `packages` are missing from their
`package.json`: the editor installs `@templatical/quality` as an optional
dependency and hands it `init({ lint })`, so an entry filed under quality alone
can change the editor's behaviour. Every other entry is not applicable. List
it as such in the report.

## 5. Proposal

Before editing anything, list:

- one install command, in the consumer's own package manager, that moves every
  `@templatical/*` dependency to the exact target version;
- for each applicable entry, its version and title, the file and line it
  touches, and the replacement its note names, quoted;
- the entries the note alone doesn't resolve, with what is unclear.

Apply entries oldest first. When a later entry changes something an earlier one
introduced, the code ends at the target's API: read the target's source at
`https://raw.githubusercontent.com/templatical/sdk/v<target>/<path>`, or its
docs through [docs.md](docs.md). Never read `main`, which can hold unreleased
source.

Then wait for a go-ahead. An upgrade edits an existing codebase, so the rule in
[scaffold.md](scaffold.md) applies: nothing changes unannounced.

## 6. Stored templates

Fields join the template model with a runtime fallback, so templates saved by
an older release keep loading in the editor and rendering the same. The schema
can still require a field that such a template predates, and `validate` then
exits `1` with `must have required property '<field>'` on an email that
renders fine.

For each such error, find the entry that made the field required. When its note
names the value the runtime uses for content stored before the field existed,
add that value and validate again. Use the fallback value, not a factory default
for new templates, which can differ: the fallback keeps the email as it
rendered. Change only the templates the user handed you. Rewriting their stored
templates in bulk needs their go-ahead.

Any other structural error is not covered by this playbook. Report the template
and its `errors[]`, and change nothing. An error-severity lint issue is a
finding about the content, not the upgrade: report it with its `suggestion`, as
[validate.md](validate.md) does.

## 7. Self-check

1. **Their typecheck and their build**, through their own scripts. A type error
   that names a symbol from an applied entry means its replacement is
   incomplete.
2. **A stored template through the target's validator:**
   ```
   npx -y @templatical/template-tools@0.51.1 validate <file> --json
   ```
   Use a template the app actually stores: an export from their database, a
   fixture or seed file, or `editor.getContent()` saved to a file. Act on the
   exit code as [cli.md](cli.md) defines it.
3. **Their dev server**, with its console and network read for errors, as in
   [scaffold.md](scaffold.md).

## 8. Report

For each entry in range: applied, not applicable, or needs the user. Name what
you could not verify, such as a template you had no copy of. Don't touch git:
the changes are the user's to review and commit.
