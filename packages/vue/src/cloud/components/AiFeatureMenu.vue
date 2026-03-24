<script setup lang="ts">
import { useI18n } from '../../composables';
import type { UseAiConfigReturn } from '@templatical/core/cloud';
import type { AiConfig } from '@templatical/types';
import { ImageUp, ShieldCheck, Sparkles } from 'lucide-vue-next';
import { computed, inject } from 'vue';

export type AiFeature = 'ai-chat' | 'design-reference' | 'scoring';

defineProps<{
    activeFeature: AiFeature | null;
}>();

const emit = defineEmits<{
    (e: 'select', feature: AiFeature): void;
}>();

const { t } = useI18n();

const aiConfig = inject<UseAiConfigReturn>('aiConfig')!;

const configKeyMap: Record<AiFeature, keyof AiConfig> = {
    'ai-chat': 'chat',
    'design-reference': 'designToTemplate',
    scoring: 'scoring',
};

const allFeatures: { key: AiFeature; icon: typeof Sparkles }[] = [
    { key: 'ai-chat', icon: Sparkles },
    { key: 'design-reference', icon: ImageUp },
    { key: 'scoring', icon: ShieldCheck },
];

const features = computed(() =>
    allFeatures.filter((f) => aiConfig.isFeatureEnabled(configKeyMap[f.key])),
);

function getTitle(key: AiFeature): string {
    if (key === 'ai-chat') return t.aiMenu.aiAssistant;
    if (key === 'design-reference') return t.aiMenu.designToTemplate;
    return t.aiMenu.templateScore;
}

function getDescription(key: AiFeature): string {
    if (key === 'ai-chat') return t.aiMenu.aiAssistantDesc;
    if (key === 'design-reference') return t.aiMenu.designToTemplateDesc;
    return t.aiMenu.templateScoreDesc;
}
</script>

<template>
    <div
        class="tpl-ai-feature-menu tpl:w-[280px] tpl:overflow-hidden tpl:rounded-[var(--tpl-radius)] tpl:py-1"
        style="
            background-color: var(--tpl-bg-elevated);
            border: 1px solid var(--tpl-border);
            box-shadow: var(--tpl-shadow-lg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        "
    >
        <button
            v-for="feature in features"
            :key="feature.key"
            class="tpl-ai-feature-menu-item tpl:flex tpl:w-full tpl:cursor-pointer tpl:items-start tpl:gap-3 tpl:border-none tpl:px-3 tpl:py-2.5 tpl:text-left tpl:transition-colors tpl:duration-100"
            :style="{
                backgroundColor:
                    activeFeature === feature.key
                        ? 'var(--tpl-primary-light)'
                        : 'transparent',
            }"
            @click="emit('select', feature.key)"
        >
            <div
                class="tpl:mt-0.5 tpl:flex tpl:size-7 tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)]"
                :style="{
                    backgroundColor:
                        activeFeature === feature.key
                            ? 'var(--tpl-primary)'
                            : 'var(--tpl-bg-active)',
                    color:
                        activeFeature === feature.key
                            ? 'white'
                            : 'var(--tpl-text-muted)',
                }"
            >
                <component :is="feature.icon" :size="15" :stroke-width="2" />
            </div>
            <div class="tpl:flex tpl:min-w-0 tpl:flex-col tpl:gap-0.5">
                <span
                    class="tpl:text-sm tpl:font-medium"
                    style="color: var(--tpl-text)"
                >
                    {{ getTitle(feature.key) }}
                </span>
                <span
                    class="tpl:text-xs tpl:leading-snug"
                    style="color: var(--tpl-text-muted)"
                >
                    {{ getDescription(feature.key) }}
                </span>
            </div>
        </button>
    </div>
</template>

<style scoped>
.tpl-ai-feature-menu-item:hover {
    background-color: var(--tpl-bg-hover) !important;
}
</style>
