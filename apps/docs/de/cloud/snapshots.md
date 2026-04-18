---
title: Snapshots
description: Versionsverlauf mit Vergleich und Wiederherstellung.
---

# Snapshots

Snapshots bieten einen automatischen Versionsverlauf für Ihre Templates. Jede Speicherung erzeugt einen Snapshot, sodass Sie Versionen Seite an Seite vergleichen und jeden vorherigen Zustand wiederherstellen können.

## So funktioniert es

1. **Automatisches Speichern** – Snapshots werden automatisch erzeugt, wenn ein Template gespeichert wird
2. **Verlauf durchsuchen** – Öffnen Sie das Snapshot-Panel, um alle vorherigen Versionen mit Zeitstempeln zu sehen
3. **Vergleichen** – Sehen Sie, was sich zwischen Versionen geändert hat
4. **Wiederherstellen** – Mit einem Klick zu einer beliebigen früheren Version zurückkehren

## Composable

```js
import { useSnapshotHistory } from '@templatical/core/cloud';

const {
  snapshots,      // Ref<TemplateSnapshot[]>
  isLoading,      // Ref<boolean>
  isRestoring,    // Ref<boolean>

  loadSnapshots,     // () => Promise<void>
  restoreSnapshot,   // (snapshotId) => Promise<Template>
} = useSnapshotHistory({
  authManager,
  templateId: 'template-id',
  onRestore: (template) => {
    // Template wiederhergestellt — Editor aktualisieren
  },
  onError: (error) => { /* Fehler behandeln */ },
});
```
