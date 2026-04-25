export interface Feature {
    slug: string;
    title: string;
    tagline: string;
    summary: string;
    icon: string;
    badge?: string;
}

export const features: Feature[] = [
    {
        slug: 'ai',
        title: 'AI Assistant',
        tagline: 'Generate, rewrite, and redesign with a prompt.',
        summary:
            'Turn a one-line brief into a finished email. Rewrite copy in the tone your brand demands. Drop in a reference screenshot and get a ready-to-edit template.',
        icon: 'sparkles',
    },
    {
        slug: 'mcp',
        title: 'MCP Integration',
        tagline: 'AI agents with hands on the template.',
        summary:
            'Connect Claude, Cursor, or any MCP-compatible agent directly to your templates. Programmatic edits, natural-language workflows — your email editor becomes an agent-ready surface.',
        icon: 'plug',
    },
    {
        slug: 'collaboration',
        title: 'Real-time Collaboration',
        tagline: 'Multiple editors, zero conflicts.',
        summary:
            'Live cursors, per-block locking, and presence awareness. Marketing, copy, and design work the same canvas without stepping on each other.',
        icon: 'users',
    },
    {
        slug: 'comments',
        title: 'Inline Comments',
        tagline: 'Review threads anchored to blocks.',
        summary:
            'Leave feedback exactly where it belongs. Resolve, reply, and loop in stakeholders without a second tool.',
        icon: 'message-square',
    },
    {
        slug: 'media-library',
        title: 'Media Library',
        tagline: 'Central asset store with folders and search.',
        summary:
            'Upload once, reuse everywhere. Folder tree, drag-and-drop, cropping, and versioned replacement — hosted and CDN-backed.',
        icon: 'image',
    },
    {
        slug: 'template-scoring',
        title: 'Template Scoring',
        tagline: 'Automated quality checks before you send.',
        summary:
            'Deliverability, accessibility, and brand-consistency scoring with actionable fixes. Catch mistakes before the send button.',
        icon: 'gauge',
    },
    {
        slug: 'saved-modules',
        title: 'Saved Modules',
        tagline: 'Your design system, ready to drop in.',
        summary:
            'Save a hero, footer, or entire section and reuse it across every template in the workspace. One source of truth for your team.',
        icon: 'package',
    },
    {
        slug: 'test-emails',
        title: 'Test Emails',
        tagline: 'Send a preview straight from the editor.',
        summary:
            'One-click test sends with merge-tag data. No copy-paste into your ESP, no context switching.',
        icon: 'send',
    },
    {
        slug: 'snapshots',
        title: 'Version History',
        tagline: 'Every change, rewindable.',
        summary:
            'Side-by-side diff, one-click restore, and named snapshots. Confidence to experiment without fear.',
        icon: 'history',
    },
    {
        slug: 'multi-tenant',
        title: 'Multi-Tenant',
        tagline: 'Isolated workspaces for every customer.',
        summary:
            'Per-tenant API keys, data isolation, and project scoping. Drop the editor into your own SaaS and keep customers fully separate.',
        icon: 'layers',
    },
    {
        slug: 'headless-api',
        title: 'Headless API',
        tagline: 'Full CRUD for templates, media, and rendering.',
        summary:
            'Every feature is a REST endpoint. Build dashboards, automations, and integrations around the editor without reinventing the backend.',
        icon: 'code',
    },
];

export function findFeature(slug: string): Feature | undefined {
    return features.find((f) => f.slug === slug);
}
