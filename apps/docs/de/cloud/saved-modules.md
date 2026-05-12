---
title: Gespeicherte Module
description: Wiederverwendbare Template-Abschnitte, die im Team geteilt werden.
---

# Gespeicherte Module

Speichern Sie wiederverwendbare Template-Abschnitte – Header, Footer, Produktraster, CTAs – und fügen Sie sie in Templates ein. Module bleiben im gesamten Team synchron.

## So funktioniert es

1. **Speichern** – Wählen Sie im Editor einen oder mehrere Abschnitte aus und speichern Sie sie mit einem Namen als Modul
2. **Durchsuchen** – Das Modul-Panel zeigt alle gespeicherten Module mit Suche an
3. **Einfügen** – Klicken Sie auf ein Modul, um es an der Cursorposition in das aktuelle Template einzufügen
4. **Verwalten** – Benennen Sie Module im Panel um oder löschen Sie sie

## Module aktivieren

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  modules: true,
});
```

## Composable

```js
import { useSavedModules } from '@templatical/core/cloud';

const {
  modules,        // Ref<SavedModule[]>
  isLoading,      // Ref<boolean>

  loadModules,    // (search?) => Promise<void>
  createModule,   // (name, content) => Promise<SavedModule>
  updateModule,   // (id, data) => Promise<SavedModule>
  deleteModule,   // (id) => Promise<void>
} = useSavedModules({
  authManager,
  onError: (error) => { /* Fehler behandeln */ },
});
```
