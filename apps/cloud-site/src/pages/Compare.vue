<script setup lang="ts">
import Icon from '@/components/shared/Icon.vue';
import PageHeader from '@/components/shared/PageHeader.vue';

interface Row {
    category: string;
    feature: string;
    oss: boolean | string;
    cloud: boolean | string;
}

const rows: Row[] = [
    { category: 'Core editor', feature: 'Drag-and-drop visual editor', oss: true, cloud: true },
    { category: 'Core editor', feature: '14 block types', oss: true, cloud: true },
    { category: 'Core editor', feature: 'Merge tags & display conditions', oss: true, cloud: true },
    { category: 'Core editor', feature: 'MJML → HTML renderer', oss: true, cloud: true },
    { category: 'Core editor', feature: 'Theming & branding tokens', oss: true, cloud: true },
    { category: 'Core editor', feature: 'Plugin system', oss: true, cloud: true },

    { category: 'AI', feature: 'Generate templates from a prompt', oss: false, cloud: true },
    { category: 'AI', feature: 'Rewrite copy & tone-shift', oss: false, cloud: true },
    { category: 'AI', feature: 'Design-to-template conversion', oss: false, cloud: true },

    { category: 'Collaboration', feature: 'Real-time co-editing with presence', oss: false, cloud: true },
    { category: 'Collaboration', feature: 'Per-block locking', oss: false, cloud: true },
    { category: 'Collaboration', feature: 'Inline comment threads', oss: false, cloud: true },

    { category: 'Assets & storage', feature: 'Media library with folders & search', oss: false, cloud: true },
    { category: 'Assets & storage', feature: 'Hosted template storage', oss: false, cloud: true },
    { category: 'Assets & storage', feature: 'Saved reusable modules', oss: false, cloud: true },

    { category: 'Quality', feature: 'Template scoring', oss: false, cloud: true },
    { category: 'Quality', feature: 'Version history / snapshots', oss: false, cloud: true },
    { category: 'Quality', feature: 'Test email sending', oss: false, cloud: true },

    { category: 'Platform', feature: 'Headless REST API', oss: false, cloud: true },
    { category: 'Platform', feature: 'Multi-tenant workspaces', oss: false, cloud: true },
    { category: 'Platform', feature: 'MCP integration for AI agents', oss: false, cloud: true },

    { category: 'Deployment', feature: 'Self-host', oss: true, cloud: 'Hosted' },
    { category: 'Deployment', feature: 'License', oss: 'Source-available', cloud: 'Commercial' },
    { category: 'Deployment', feature: 'Support', oss: 'Community', cloud: 'Priority' },
];

const categories = Array.from(new Set(rows.map((r) => r.category)));
</script>

<template>
    <PageHeader
        eyebrow="Compare"
        title="Open-source vs Cloud."
        lede="The OSS editor is complete and ready to self-host today. Cloud adds what teams ask for once the basics are covered."
    />

    <section class="mx-auto max-w-6xl px-6 pb-24">
        <div
            role="region"
            aria-label="Feature comparison"
            tabindex="0"
            class="overflow-x-auto rounded-lg border border-border bg-bg-elevated shadow-sm"
        >
            <table class="w-full min-w-[640px] text-left text-sm">
                <caption class="sr-only">
                    Feature comparison between open-source Templatical and
                    Templatical Cloud, grouped by category.
                </caption>
                <thead class="bg-bg-subtle text-xs uppercase tracking-wider text-text-dim">
                    <tr>
                        <th scope="col" class="sticky left-0 z-10 border-r border-border bg-bg-subtle px-6 py-4 font-semibold md:border-r-0">Feature</th>
                        <th scope="col" class="px-6 py-4 font-semibold">Open-source</th>
                        <th scope="col" class="px-6 py-4 font-semibold">
                            <span class="text-primary">Cloud</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="cat in categories" :key="cat">
                        <tr class="bg-bg-subtle">
                            <th
                                scope="colgroup"
                                colspan="3"
                                class="sticky left-0 border-r border-border bg-bg-subtle px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted md:border-r-0"
                            >
                                {{ cat }}
                            </th>
                        </tr>
                        <tr
                            v-for="row in rows.filter((r) => r.category === cat)"
                            :key="row.feature"
                            class="border-t border-border"
                        >
                            <th
                                scope="row"
                                class="sticky left-0 border-r border-border bg-bg-elevated px-6 py-3 text-left font-normal text-text md:border-r-0"
                            >
                                {{ row.feature }}
                            </th>
                            <td class="px-6 py-3">
                                <template v-if="row.oss === true">
                                    <span
                                        class="inline-flex size-6 items-center justify-center rounded-full bg-success/15 text-success"
                                        aria-hidden="true"
                                    >
                                        <Icon name="check" :size="14" />
                                    </span>
                                    <span class="sr-only">Included</span>
                                </template>
                                <template v-else-if="row.oss === false">
                                    <span
                                        class="inline-flex size-6 items-center justify-center rounded-full bg-bg-hover text-text-dim"
                                        aria-hidden="true"
                                    >
                                        <Icon name="minus" :size="14" />
                                    </span>
                                    <span class="sr-only">Not included</span>
                                </template>
                                <template v-else>
                                    <span class="text-text-muted">{{ row.oss }}</span>
                                </template>
                            </td>
                            <td class="px-6 py-3">
                                <template v-if="row.cloud === true">
                                    <span
                                        class="inline-flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary-hover"
                                        aria-hidden="true"
                                    >
                                        <Icon name="check" :size="14" />
                                    </span>
                                    <span class="sr-only">Included</span>
                                </template>
                                <template v-else-if="row.cloud === false">
                                    <span aria-hidden="true" class="text-text-dim">—</span>
                                    <span class="sr-only">Not included</span>
                                </template>
                                <template v-else>
                                    <span class="font-medium text-text">{{ row.cloud }}</span>
                                </template>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </section>
</template>
