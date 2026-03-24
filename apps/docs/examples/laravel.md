---
title: Laravel + Inertia
description: Integrating Templatical into a Laravel application with Inertia.js and Vue 3.
---

# Laravel + Inertia

A common setup for Laravel applications using Inertia.js with Vue 3.

## Setup

```bash
npm install @templatical/vue @templatical/renderer
composer require templatical/renderer
```

## Vue Page Component

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { init, unmount } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';
import { useHttp } from '@inertiajs/vue3';

const props = defineProps<{
  template: {
    id: number;
    content: TemplateContent;
  };
}>();

const container = ref<HTMLElement>();
const editor = ref<TemplaticalEditor>();
const http = useHttp();

onMounted(() => {
  if (!container.value) return;

  editor.value = init({
    container: container.value,
    content: props.template.content,
    onSave(content) {
      http.put(`/templates/${props.template.id}`, { content });
    },
  });
});

onUnmounted(() => {
  unmount();
});
</script>

<template>
  <div ref="container" style="height: 100vh" />
</template>
```

## Laravel Controller

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Template;
use Illuminate\Http\Request;
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

## Server-Side Rendering with PHP

Use the PHP renderer to generate HTML on the server for sending emails:

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Templatical\Renderer\TemplateRenderer;
use Spatie\Mjml\Mjml;

final class EmailRenderService
{
    public function __construct(
        private TemplateRenderer $renderer,
    ) {}

    public function render(array $templateContent): string
    {
        $mjml = $this->renderer->render($templateContent);

        return Mjml::new()->toHtml($mjml);
    }
}
```

## Sending Emails

```php
<?php

use App\Services\EmailRenderService;
use Illuminate\Support\Facades\Mail;

$html = app(EmailRenderService::class)->render($template->content);

Mail::html($html, function ($message) {
    $message->to('user@example.com')
        ->subject('Your Newsletter');
});
```

## Route Setup

```php
use App\Http\Controllers\ShowTemplateEditorController;

Route::get('templates/{template}/editor', ShowTemplateEditorController::class)
    ->name('templates.editor');
```
