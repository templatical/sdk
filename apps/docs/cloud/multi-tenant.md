---
title: Multi-Tenant Architecture
description: Project and tenant isolation with API keys.
---

# Multi-Tenant Architecture

Templatical Cloud is built for multi-tenant SaaS applications. Each of your customers gets their own isolated set of templates, media, modules, and settings — all managed through a single integration.

## Concepts

| Concept | Description |
|---------|-------------|
| **Project** | Your application. One project per Templatical Cloud account. |
| **Tenant** | One of your customers/organizations. Each tenant has isolated data. |
| **API Key** | Credentials scoped to a project. Used to generate tenant-specific tokens. |

## How It Works

1. You create a project in the Templatical Cloud dashboard
2. Each of your users/organizations maps to a tenant
3. When a user opens the editor, your token endpoint issues a JWT scoped to their tenant
4. The SDK automatically routes all API calls to the correct tenant

```
Your App → Token Endpoint → Templatical Cloud API → Tenant-Scoped JWT
                                                          ↓
                                              Editor loads with tenant data
```

## Token Scoping

The tenant is determined at token generation time. Your server-side token endpoint should map the authenticated user to their tenant:

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

## Data Isolation

Each tenant has completely isolated:

- **Templates** — CRUD operations only affect the tenant's own templates
- **Media** — Uploaded images are scoped to the tenant
- **Saved Modules** — Module library is per-tenant
- **Snapshots** — Version history is per-template, per-tenant
- **Comments** — Comment threads are per-template, per-tenant
- **AI History** — Conversation history is per-template, per-tenant

## API Routes

All Cloud API routes include project and tenant identifiers:

```
/api/v1/projects/{project}/tenants/{tenant}/templates
/api/v1/projects/{project}/tenants/{tenant}/media/browse
/api/v1/projects/{project}/tenants/{tenant}/saved-modules
```

The SDK resolves these automatically from the auth token — you never need to construct URLs manually.
