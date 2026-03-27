import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Templatical',
    description: 'Open-source drag-and-drop email editor for modern apps',
    head: [
        ['link', { rel: 'icon', href: '/favicon.ico' }],
        [
            'meta',
            {
                property: 'og:title',
                content: 'Templatical — Open-Source Email Editor',
            },
        ],
        [
            'meta',
            {
                property: 'og:description',
                content:
                    'Production-ready drag-and-drop email editor. 13 block types, merge tags, custom blocks, dark mode, and client-side export.',
            },
        ],
    ],
    themeConfig: {
        logo: '/logo.svg',
        siteTitle: 'Templatical',

        nav: [
            { text: 'Guide', link: '/getting-started/installation' },
            { text: 'API', link: '/api/editor' },
            { text: 'Examples', link: '/examples/vanilla-js' },
            { text: 'Cloud', link: '/cloud/' },
            { text: 'Playground', link: 'https://play.templatical.com' },
        ],

        sidebar: {
            '/cloud/': [
                {
                    text: 'Cloud',
                    items: [
                        { text: 'Overview', link: '/cloud/' },
                        {
                            text: 'Getting Started',
                            link: '/cloud/getting-started',
                        },
                        {
                            text: 'Authentication',
                            link: '/cloud/authentication',
                        },
                    ],
                },
                {
                    text: 'Features',
                    items: [
                        { text: 'AI Assistant', link: '/cloud/ai' },
                        {
                            text: 'Collaboration',
                            link: '/cloud/collaboration',
                        },
                        { text: 'Comments', link: '/cloud/comments' },
                        {
                            text: 'Media Library',
                            link: '/cloud/media-library',
                        },
                        {
                            text: 'Template Scoring',
                            link: '/cloud/template-scoring',
                        },
                        {
                            text: 'Saved Modules',
                            link: '/cloud/saved-modules',
                        },
                        {
                            text: 'Test Emails',
                            link: '/cloud/test-emails',
                        },
                        { text: 'Snapshots', link: '/cloud/snapshots' },
                    ],
                },
                {
                    text: 'Advanced',
                    items: [
                        {
                            text: 'MCP Integration',
                            link: '/cloud/mcp',
                        },
                        {
                            text: 'Multi-Tenant',
                            link: '/cloud/multi-tenant',
                        },
                        {
                            text: 'Headless API',
                            link: '/cloud/headless-api',
                        },
                    ],
                },
            ],
            '/': [
                {
                    text: 'Getting Started',
                    items: [
                        {
                            text: 'Installation',
                            link: '/getting-started/installation',
                        },
                        {
                            text: 'Quick Start',
                            link: '/getting-started/quick-start',
                        },
                        {
                            text: 'Your First Template',
                            link: '/getting-started/your-first-template',
                        },
                        { text: 'Export', link: '/getting-started/export' },
                    ],
                },
                {
                    text: 'Guide',
                    items: [
                        { text: 'Blocks', link: '/guide/blocks' },
                        {
                            text: 'Sections & Columns',
                            link: '/guide/sections-and-columns',
                        },
                        { text: 'Styling', link: '/guide/styling' },
                        { text: 'Merge Tags', link: '/guide/merge-tags' },
                        {
                            text: 'Display Conditions',
                            link: '/guide/display-conditions',
                        },
                        {
                            text: 'Custom Blocks',
                            link: '/guide/custom-blocks',
                        },
                        { text: 'Theming', link: '/guide/theming' },
                        { text: 'Internationalization', link: '/guide/i18n' },
                        { text: 'Images', link: '/guide/images' },
                        {
                            text: 'Export Options',
                            link: '/guide/export-options',
                        },
                        {
                            text: 'Migration from BeeFree',
                            link: '/guide/migration-from-beefree',
                        },
                    ],
                },
                {
                    text: 'API Reference',
                    items: [
                        { text: 'Editor', link: '/api/editor' },
                        { text: 'Types', link: '/api/types' },
                        {
                            text: 'Renderer (TypeScript)',
                            link: '/api/renderer-typescript',
                        },
                        {
                            text: 'Renderer (PHP)',
                            link: '/api/renderer-php',
                        },
                        { text: 'Events', link: '/api/events' },
                    ],
                },
                {
                    text: 'Examples',
                    items: [
                        {
                            text: 'Vanilla JavaScript',
                            link: '/examples/vanilla-js',
                        },
                        { text: 'Vue 3', link: '/examples/vue' },
                        { text: 'React', link: '/examples/react' },
                        {
                            text: 'Laravel + Inertia',
                            link: '/examples/laravel',
                        },
                        {
                            text: 'Node.js Renderer',
                            link: '/examples/node-renderer',
                        },
                    ],
                },
            ],
        },

        socialLinks: [
            {
                icon: 'github',
                link: 'https://github.com/templatical/editor',
            },
        ],

        editLink: {
            pattern:
                'https://github.com/templatical/editor/edit/main/apps/docs/:path',
            text: 'Edit this page on GitHub',
        },

        search: {
            provider: 'local',
        },

        footer: {
            message:
                'Released under the <a href="https://github.com/templatical/editor/blob/main/LICENSE">FSL-1.1-MIT License</a>.',
            copyright: 'Copyright © 2024-present Templatical',
        },
    },
});
