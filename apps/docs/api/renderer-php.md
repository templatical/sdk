---
title: PHP Renderer
description: API reference for templatical/renderer — PHP package for server-side template rendering.
---

# PHP Renderer

`templatical/renderer` is a PHP package that renders Templatical template JSON to MJML. It uses plain PHP arrays with no Laravel or framework dependencies.

```bash
composer require templatical/renderer
```

## Basic Usage

```php
use Templatical\Renderer\TemplateRenderer;

$template = json_decode(file_get_contents('template.json'), true);
$renderer = new TemplateRenderer();

$mjml = $renderer->render($template);
```

The renderer outputs MJML markup. To convert to HTML, pipe the MJML through an MJML compiler like [mjml-php](https://github.com/spatie/mjml-php) or the [MJML CLI](https://mjml.io/documentation/#command-line-interface).

## With MJML-to-HTML Compilation

Using `spatie/mjml-php`:

```php
use Templatical\Renderer\TemplateRenderer;
use Spatie\Mjml\Mjml;

$template = json_decode($json, true);
$renderer = new TemplateRenderer();

$mjml = $renderer->render($template);
$html = Mjml::new()->toHtml($mjml);
```

## Render Options

```php
$renderer = new TemplateRenderer(
    customFonts: [
        ['name' => 'Inter', 'url' => 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'],
    ],
    defaultFallbackFont: 'Arial, sans-serif',
    allowHtmlBlocks: true,
);
```

| Option | Default | Description |
|--------|---------|-------------|
| `customFonts` | `[]` | Custom font definitions |
| `defaultFallbackFont` | `'Arial, sans-serif'` | Fallback font stack |
| `allowHtmlBlocks` | `true` | Set to `false` to strip HTML blocks |

## Input Format

The renderer expects the same JSON structure as the TypeScript renderer — a `TemplateContent` object with `blocks` and `settings`:

```json
{
  "blocks": [
    {
      "id": "abc123",
      "type": "text",
      "content": "<p>Hello World</p>",
      "fontSize": 16,
      "color": "#333333",
      "textAlign": "left",
      "fontWeight": "normal",
      "styles": {
        "padding": { "top": 10, "right": 20, "bottom": 10, "left": 20 },
        "margin": { "top": 0, "right": 0, "bottom": 0, "left": 0 }
      }
    }
  ],
  "settings": {
    "width": 600,
    "backgroundColor": "#ffffff",
    "fontFamily": "Arial, sans-serif"
  }
}
```

## Requirements

- PHP 8.2+
- No framework dependencies
