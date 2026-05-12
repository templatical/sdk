---
title: Multi-Tenant-Architektur
description: Projekt- und Mandanten-Isolation mit API-Schlüsseln.
---

# Multi-Tenant-Architektur

Templatical Cloud ist für Multi-Tenant-SaaS-Anwendungen gebaut. Jeder Ihrer Kunden erhält eine eigene, isolierte Menge an Templates, Medien, Modulen und Einstellungen – alles über eine einzige Integration verwaltet.

## Konzepte

| Konzept | Beschreibung |
|---------|-------------|
| **Projekt** | Ihre Anwendung. Ein Projekt pro Templatical-Cloud-Konto. |
| **Mandant** | Einer Ihrer Kunden/Ihrer Organisationen. Jeder Mandant hat isolierte Daten. |
| **API-Schlüssel** | Zugangsdaten, die auf ein Projekt beschränkt sind. Werden verwendet, um mandantenspezifische Tokens zu erzeugen. |

## So funktioniert es

1. Sie legen im Templatical-Cloud-Dashboard ein Projekt an
2. Jeder Ihrer Nutzer/Organisationen wird auf einen Mandanten abgebildet
3. Wenn ein Nutzer den Editor öffnet, stellt Ihr Token-Endpunkt ein JWT aus, das auf seinen Mandanten beschränkt ist
4. Das SDK leitet alle API-Aufrufe automatisch an den korrekten Mandanten weiter

```
Ihre App → Token-Endpunkt → Templatical-Cloud-API → Mandantengebundenes JWT
                                                          ↓
                                              Editor lädt mit Mandantendaten
```

## Token-Scoping

Der Mandant wird zum Zeitpunkt der Token-Erzeugung festgelegt. Ihr serverseitiger Token-Endpunkt sollte den authentifizierten Nutzer auf seinen Mandanten abbilden:

```php
Route::post('/api/templatical/token', function (Request $request) {
    $response = Http::post('https://templatical.com/api/v1/auth/token', [
        'client_id' => config('templatical.client_id'),
        'client_secret' => config('templatical.client_secret'),
        'tenant' => $request->user()->organization->templatical_tenant_slug,
    ]);

    return $response->json();
});
```

## Datenisolation

Jeder Mandant verfügt über vollständig isolierte:

- **Templates** – CRUD-Operationen betreffen nur die Templates des jeweiligen Mandanten
- **Medien** – Hochgeladene Bilder sind auf den Mandanten beschränkt
- **Gespeicherte Module** – Die Modul-Bibliothek ist pro Mandant
- **Snapshots** – Der Versionsverlauf ist pro Template und pro Mandant
- **Kommentare** – Kommentar-Threads sind pro Template und pro Mandant
- **KI-Verlauf** – Der Gesprächsverlauf ist pro Template und pro Mandant

## API-Routen

Alle Cloud-API-Routen enthalten Projekt- und Mandanten-Kennungen:

```
/api/v1/projects/{project}/tenants/{tenant}/templates
/api/v1/projects/{project}/tenants/{tenant}/media/browse
/api/v1/projects/{project}/tenants/{tenant}/saved-modules
```

Das SDK löst diese automatisch aus dem Auth-Token auf – Sie müssen niemals manuell URLs konstruieren.
