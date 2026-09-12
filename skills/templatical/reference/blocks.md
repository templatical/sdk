# blocks — the block model

**Consulted by:** [build.md](build.md) · [edit.md](edit.md) ·
[import.md](import.md)
**Related:** [rules.md](rules.md) for the constraints on top of this shape

Three files carry the detail, and they are the contract rather than prose:

- **[block-guide.md](block-guide.md)** — per-block field reference, written for
  generation: what each block is for, which fields it needs, what good values
  look like.
- **[schema.json](schema.json)** — the JSON Schema `validate` enforces. Read it
  when the guide is ambiguous or a field is missing from it. It is generated
  from the same types the validator uses, so it cannot disagree with them.
- **[examples/](examples/)** — five complete, valid templates. Model output on
  these rather than inventing a shape.

`npx -y @templatical/template-tools@0.36.0 schema` prints the same schema for
callers outside this skill; the committed copy above is what to read in context.
