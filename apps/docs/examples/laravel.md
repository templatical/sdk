---
title: Laravel + Inertia
description: Integrating Templatical into a Laravel application with Inertia.js and Vue 3.
---

# Laravel + Inertia

A complete setup for Laravel applications using Inertia.js with Vue 3 — covering the editor, persistence, and template management.

## Setup

```bash
npm install @templatical/vue @templatical/renderer
```

## Database

Create a migration for storing templates:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->json('content'); // Stores the TemplateContent JSON
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('templates');
    }
};
```

And the model:

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class Template extends Model
{
    protected function casts(): array
    {
        return [
            'content' => 'array',
        ];
    }
}
```

## Vue page component

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';
import { router } from '@inertiajs/vue3';

const props = defineProps<{
  template: {
    id: number;
    content: TemplateContent;
  };
}>();

const container = ref<HTMLElement>();
let editor: TemplaticalEditor | null = null;

onMounted(() => {
  if (!container.value) return;

  editor = init({
    container: container.value,
    content: props.template.content,
    onSave(content) {
      router.put(`/templates/${props.template.id}`, { content }, {
        preserveState: true,
        preserveScroll: true,
      });
    },
  });
});

onUnmounted(() => {
  editor?.unmount();
  editor = null;
});
</script>

<template>
  <div ref="container" style="height: 100vh" />
</template>
```

## Controllers

Show the editor:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Template;
use Inertia\Inertia;
use Inertia\Response;

final class ShowTemplateEditorController
{
    public function __invoke(Template $template): Response
    {
        return Inertia::render('Templates/Editor', [
            'template' => [
                'id' => $template->id,
                'content' => $template->content,
            ],
        ]);
    }
}
```

Save template content:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Template;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class UpdateTemplateController
{
    public function __invoke(Request $request, Template $template): RedirectResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'array'],
            'content.blocks' => ['required', 'array'],
            'content.settings' => ['required', 'array'],
        ]);

        $template->update($validated);

        return back();
    }
}
```

## Routes

```php
use App\Http\Controllers\ShowTemplateEditorController;
use App\Http\Controllers\UpdateTemplateController;

Route::get('templates/{template}/editor', ShowTemplateEditorController::class)
    ->name('templates.editor');

Route::put('templates/{template}', UpdateTemplateController::class)
    ->name('templates.update');
```

## Server-side rendering

Use the renderer to generate MJML, then compile to HTML for sending emails. For example, in a queued job or Artisan command that shells out to a Node script:

```ts
// render-template.ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';
import { readFileSync } from 'fs';

const content = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const mjml = renderToMjml(content);
const { html } = mjml2html(mjml);
process.stdout.write(html);
```

Or expose a rendering endpoint in a small Node.js service that your Laravel app calls at send time. See the [Node.js Renderer](/examples/node-renderer) example for a complete Express setup.
