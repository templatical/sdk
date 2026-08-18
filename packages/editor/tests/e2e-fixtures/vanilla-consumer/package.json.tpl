{
  "name": "tpl-editor-e2e-vanilla-consumer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@templatical/editor": "EDITOR_TARBALL_PLACEHOLDER",
    "@templatical/renderer": "RENDERER_TARBALL_PLACEHOLDER"
  },
  "devDependencies": {
    "vite": "^6.4.2"
  },
  "//overrides": "The dependencies above are exactly what a real consumer writes; @templatical/types arrives transitively through the renderer, which is the one package that leaves it external. The override only redirects that transitive resolution to the workspace build — npm would otherwise fetch the last published types, which predates any symbol the renderer started importing this release. The packages ship as one fixed version group, so a real install never pairs a new renderer with an older types.",
  "overrides": {
    "@templatical/types": "TYPES_TARBALL_PLACEHOLDER"
  }
}
