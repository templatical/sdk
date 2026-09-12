# resume — recover the active template after a context loss

**Related:** [working-files.md](working-files.md) for the directory's shape

When a turn begins with no memory of which file was being worked on, do not
guess and do not start a new one. Ask the CLI:

```
npx -y @templatical/template-tools@0.38.0 list --json
```

It enumerates `.templatical/*.json` straight off disk, so it is authoritative
even when your own context is not. Pick the file the user means — ask if more
than one could be it — and carry that name for the rest of the session.
