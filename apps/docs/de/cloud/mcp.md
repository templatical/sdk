---
title: MCP-Integration
description: Binden Sie KI-Agenten an, um Templates programmatisch über das Model Context Protocol zu erstellen und zu verändern.
---

# MCP-Integration

Die Integration des Model Context Protocol (MCP) ermöglicht es KI-Agenten und Automatisierungswerkzeugen, programmatisch mit dem Editor zu interagieren. Agenten können Templates über ein standardisiertes Protokoll erstellen, lesen, verändern und verwalten.

## Anwendungsfälle

- **KI-Workflows** – Lassen Sie KI-Agenten Templates auf Basis externer Daten oder Trigger erzeugen
- **Automatisierung** – Erstellen Sie Templates programmatisch als Teil einer größeren Pipeline
- **Benutzerdefinierte Agenten** – Entwickeln Sie spezialisierte Agenten, die Ihre Markenrichtlinien verstehen und markenkonforme E-Mails produzieren

## So funktioniert es

Wenn MCP aktiviert ist, lauscht der Editor über WebSocket auf Operationen verbundener KI-Agenten. Agenten können Operationen wie die folgenden ausführen:

- Templates erstellen und verändern
- Blöcke hinzufügen, aktualisieren und entfernen
- Template-Inhalt und -Struktur auslesen
- Design-Änderungen anwenden

## Konfiguration

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  mcp: {
    enabled: true,
  },
});
```

## Architektur

Das MCP-System besteht aus:

1. **`useMcpListener`** – Lauscht auf eingehende Operationen im WebSocket-Kanal
2. **`handleOperation`** – Verarbeitet einzelne MCP-Operationen und wendet sie auf den Editor-Zustand an

Beide sind für benutzerdefinierte Integrationen über `@templatical/core/cloud` verfügbar.
