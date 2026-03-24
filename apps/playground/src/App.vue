<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { init, unmount } from '@templatical/vue';
import type { TemplaticalEditor, TemplaticalEditorConfig } from '@templatical/vue';
import type { TemplateContent, MergeTag, CustomBlockDefinition } from '@templatical/types';
import { createDefaultTemplateContent } from '@templatical/types';
import { convertBeeFreeTemplate } from '@templatical/import-beefree';
import type { BeeFreeTemplate } from '@templatical/import-beefree';
import { templates, customBlockDefinitions } from '@/templates';
import type { TemplateOption } from '@/templates';
import CodeEditor from '@/CodeEditor.vue';
import LogoIcon from '@/LogoIcon.vue';

type Screen = 'chooser' | 'editor';
const screen = ref<Screen>('chooser');
const showBeefreeImport = ref(false);
const beefreeJson = ref('');
const beefreeError = ref('');

const editorContainer = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalEditor | null>(null);
const showJson = ref(false);
const jsonContent = ref('');
const exportMenuOpen = ref(false);
const showConfig = ref(false);
const configOptionsJson = ref('');
const configContentJson = ref('');
const configThemeJson = ref('');
const configError = ref('');
const configTab = ref<'options' | 'content' | 'theme'>('options');
const mergeTagPickerOpen = ref(false);
let mergeTagResolve: ((tag: MergeTag | null) => void) | null = null;

const mergeTagList = ref<MergeTag[]>([
    { label: 'First Name', value: '{{first_name}}' },
    { label: 'Last Name', value: '{{last_name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Company', value: '{{company}}' },
    { label: 'Account ID', value: '{{account_id}}' },
    { label: 'Plan Name', value: '{{plan_name}}' },
    { label: 'Unsubscribe URL', value: '{{unsubscribe_url}}' },
    { label: 'Preferences URL', value: '{{preferences_url}}' },
    { label: 'Current Date', value: '{{current_date}}' },
]);

const mergeTags = {
    syntax: 'liquid' as const,
    tags: mergeTagList.value,
};

function requestMergeTag(): Promise<MergeTag | null> {
    return new Promise((resolve) => {
        mergeTagResolve = resolve;
        mergeTagPickerOpen.value = true;
    });
}

function selectMergeTag(tag: MergeTag): void {
    mergeTagPickerOpen.value = false;
    mergeTagResolve?.(tag);
    mergeTagResolve = null;
}

function cancelMergeTagPicker(): void {
    mergeTagPickerOpen.value = false;
    mergeTagResolve?.(null);
    mergeTagResolve = null;
}

const displayConditions = {
    conditions: [
        {
            label: 'VIP Partners',
            before: '{% if vip_partner %}',
            after: '{% endif %}',
            group: 'Audience',
            description: 'Show only to VIP partner accounts',
        },
        {
            label: 'Free Users',
            before: '{% if plan == "free" %}',
            after: '{% endif %}',
            group: 'Audience',
            description: 'Show only to free plan users',
        },
        {
            label: 'Enterprise',
            before: '{% if plan == "enterprise" %}',
            after: '{% endif %}',
            group: 'Audience',
            description: 'Show only to enterprise accounts',
        },
    ],
    allowCustom: true,
};

let selectedContent: TemplateContent | null = null;
let selectedCustomBlocks: CustomBlockDefinition[] | undefined;
let pendingEditorInit = false;

function chooseTemplate(content: TemplateContent, template?: TemplateOption): void {
    selectedContent = content;
    selectedCustomBlocks = template?.customBlocks;
    currentSerializableConfig = buildSerializableConfig();
    pendingEditorInit = true;
    screen.value = 'editor';
}

function onScreenEnter(): void {
    if (pendingEditorInit) {
        pendingEditorInit = false;
        nextTick(() => initEditor());
    }
}

function importBeefreeFromJson(raw: string): void {
    beefreeError.value = '';

    try {
        const json = JSON.parse(raw) as BeeFreeTemplate;
        const { content } = convertBeeFreeTemplate(json);
        showBeefreeImport.value = false;
        beefreeJson.value = '';
        chooseTemplate(content);
    } catch (e) {
        beefreeError.value = e instanceof Error ? e.message : 'Invalid JSON';
    }
}

function confirmBeefreeImport(): void {
    const raw = beefreeJson.value.trim();
    if (!raw) {
        beefreeError.value = 'Paste your BeeFree JSON or upload a file.';
        return;
    }

    importBeefreeFromJson(raw);
}

function handleBeefreeFileUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const text = await file.text();
        importBeefreeFromJson(text);
    };
    input.click();
}

function backToChooser(): void {
    unmount();
    editor.value = null;
    screen.value = 'chooser';
}

const defaultTheme = {
    bg: 'oklch(99.5% 0.002 60)',
    bgElevated: 'oklch(98% 0.004 60)',
    bgHover: 'oklch(96% 0.006 60)',
    bgActive: 'oklch(93.5% 0.008 60)',
    border: 'oklch(92% 0.006 60)',
    borderLight: 'oklch(86% 0.01 60)',
    text: 'oklch(18% 0.01 60)',
    textMuted: 'oklch(50% 0.015 60)',
    textDim: 'oklch(68% 0.012 60)',
    primary: 'oklch(70% 0.16 55)',
    primaryHover: 'oklch(63% 0.17 55)',
    primaryLight: 'oklch(95% 0.04 55)',
    secondary: 'oklch(60% 0.118 184.71)',
    secondaryHover: 'oklch(53.2% 0.105 186.39)',
    secondaryLight: 'oklch(93.8% 0.03 186.82)',
    success: 'oklch(62.8% 0.194 155.1)',
    successLight: 'oklch(93.6% 0.043 163.51)',
    warning: 'oklch(76.9% 0.168 70.08)',
    warningLight: 'oklch(95% 0.038 73.59)',
    danger: 'oklch(63.7% 0.237 25.33)',
    dangerLight: 'oklch(93.6% 0.032 17.72)',
    canvasBg: 'oklch(97.5% 0.003 60)',
};

let currentTheme: Record<string, string> = { ...defaultTheme };

function buildSerializableConfig() {
    return {
        content: selectedContent ?? createDefaultTemplateContent(),
        mergeTags,
        displayConditions,
        customBlocks: selectedCustomBlocks !== undefined ? selectedCustomBlocks : customBlockDefinitions,
    };
}

let currentSerializableConfig = buildSerializableConfig();

function initEditor(): void {
    if (!editorContainer.value) return;

    editor.value = init({
        container: editorContainer.value,
        ...currentSerializableConfig,
        theme: currentTheme,
        onRequestMergeTag: requestMergeTag,
    });
}

function openConfig(): void {
    if (editor.value) {
        currentSerializableConfig.content = editor.value.getContent();
    }
    const { content, ...options } = currentSerializableConfig;
    configOptionsJson.value = JSON.stringify(options, null, 2);
    configContentJson.value = JSON.stringify(content, null, 2);
    configThemeJson.value = JSON.stringify(currentTheme, null, 2);
    configError.value = '';
    configTab.value = 'options';
    showConfig.value = true;
}

function applyConfig(): void {
    configError.value = '';
    try {
        const options = JSON.parse(configOptionsJson.value);
        const content = JSON.parse(configContentJson.value);
        const theme = JSON.parse(configThemeJson.value);
        currentSerializableConfig = { ...options, content };
        selectedContent = content;
        selectedCustomBlocks = options.customBlocks;
        currentTheme = theme;
        if (options.mergeTags?.tags) {
            mergeTagList.value = options.mergeTags.tags;
        }
        showConfig.value = false;
        initEditor();
    } catch (e) {
        configError.value = e instanceof Error ? e.message : 'Invalid JSON';
    }
}

function toggleJson(): void {
    if (!editor.value) return;
    jsonContent.value = JSON.stringify(editor.value.getContent(), null, 2);
    showJson.value = true;
}

const copied = ref(false);

function copyJson(): void {
    navigator.clipboard.writeText(jsonContent.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
}

function downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function handleExportJson(): void {
    if (!editor.value) return;
    const json = JSON.stringify(editor.value.getContent(), null, 2);
    downloadFile(json, 'email-template.json', 'application/json');
}

function handleExportMjml(): void {
    if (!editor.value) return;
    if (!editor.value.toMjml) return;
    const mjml = editor.value.toMjml();
    downloadFile(mjml, 'email-template.mjml', 'text/plain');
}

onMounted(() => {
    // Editor is initialized when user picks a template
});

onUnmounted(() => {
    unmount();
});
</script>

<template>
    <div class="box-border flex flex-col h-screen font-sans bg-white text-gray-900">
        <Transition name="pg-screen" mode="out-in" @enter="onScreenEnter">
        <!-- Template Chooser Screen -->
        <div v-if="screen === 'chooser'" key="chooser" class="flex flex-col items-center justify-center min-h-screen bg-white font-sans py-12">
                <div class="flex flex-col items-center max-w-[860px] px-6">
                    <LogoIcon class="mb-5" />
                    <h1 class="m-0 mb-2 text-[22px] font-semibold text-gray-900 tracking-[-0.02em]">Templatical Playground</h1>
                    <p class="m-0 mb-9 text-[15px] text-gray-500">Choose a starting point for your email template</p>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] w-full">
                        <button
                            v-for="(tpl, i) in templates"
                            :key="tpl.name"
                            :aria-label="`Choose ${tpl.name} template`"
                            class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left font-sans overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle"
                            :style="{ animationDelay: `${i * 40}ms` }"
                            @click="chooseTemplate(tpl.create(), tpl)"
                        >
                            <div class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200">
                                <!-- Product launch wireframe -->
                                <div v-if="tpl.preview === 'product'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 40%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 70%; margin: 0 auto"></div>
                                    <div class="h-5 w-[40%] rounded bg-primary opacity-30 my-1" style="margin: 4px auto"></div>
                                    <div class="h-8 w-full rounded bg-gray-200 opacity-60 my-0.5"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 50%; margin: 0 auto"></div>
                                </div>
                                <!-- Newsletter wireframe -->
                                <div v-else-if="tpl.preview === 'newsletter'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 50%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 30%; margin: 0 auto; opacity: 0.4"></div>
                                    <div class="h-8 w-full rounded bg-gray-200 opacity-60 my-0.5"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 90%"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 70%"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 80%"></div>
                                </div>
                                <!-- Welcome wireframe -->
                                <div v-else-if="tpl.preview === 'welcome'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 35%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 60%; margin: 0 auto"></div>
                                    <div style="display: flex; gap: 6px; align-items: center">
                                        <div class="size-2.5 rounded-full bg-primary opacity-30 shrink-0"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 70%; flex-shrink: 0"></div>
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center">
                                        <div class="size-2.5 rounded-full bg-primary opacity-30 shrink-0"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 65%; flex-shrink: 0"></div>
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center">
                                        <div class="size-2.5 rounded-full bg-primary opacity-30 shrink-0"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 60%; flex-shrink: 0"></div>
                                    </div>
                                </div>
                                <!-- Order confirmation wireframe -->
                                <div v-else-if="tpl.preview === 'order'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 40%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 55%; margin: 0 auto; opacity: 0.5"></div>
                                    <div style="display: flex; gap: 4px">
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 40%"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 20%"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 25%"></div>
                                    </div>
                                    <div style="display: flex; gap: 4px">
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 40%; opacity: 0.5"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 20%; opacity: 0.5"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 25%; opacity: 0.5"></div>
                                    </div>
                                    <div class="h-5 w-[40%] rounded bg-primary opacity-30 my-1" style="margin: 4px auto; background: #059669"></div>
                                </div>
                                <!-- Event invitation wireframe -->
                                <div v-else-if="tpl.preview === 'event'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 45%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 65%; margin: 0 auto"></div>
                                    <div class="h-8 w-full rounded bg-gray-200 opacity-60 my-0.5" style="opacity: 0.4"></div>
                                    <div style="display: flex; gap: 4px; justify-content: center">
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 28%"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 28%"></div>
                                        <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 28%"></div>
                                    </div>
                                    <div class="h-5 w-[40%] rounded bg-primary opacity-30 my-1" style="margin: 4px auto; background: #7c3aed"></div>
                                </div>
                                <!-- Sale wireframe -->
                                <div v-else-if="tpl.preview === 'sale'" class="flex flex-col gap-1.5 w-[60%]">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 50%; margin: 0 auto; background: #fbbf24; opacity: 0.6"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 70%; margin: 0 auto"></div>
                                    <div style="display: flex; gap: 4px; margin-top: 2px;">
                                        <div style="flex: 1; height: 28px; border-radius: 3px; background: #e5e7eb; opacity: 0.8;"></div>
                                        <div style="flex: 1; height: 28px; border-radius: 3px; background: #e5e7eb; opacity: 0.8;"></div>
                                        <div style="flex: 1; height: 28px; border-radius: 3px; background: #e5e7eb; opacity: 0.8;"></div>
                                    </div>
                                    <div class="h-5 w-[40%] rounded bg-primary opacity-30 my-1" style="margin: 4px auto; background: #fbbf24; opacity: 0.5"></div>
                                </div>
                                <!-- Password reset wireframe -->
                                <div v-else-if="tpl.preview === 'reset'" class="flex flex-col gap-1.5 w-[60%]" style="align-items: center">
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 35%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 50%; margin: 0 auto"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 70%; margin: 0 auto; opacity: 0.5"></div>
                                    <div class="h-5 w-[40%] rounded bg-primary opacity-30 my-1" style="margin: 6px auto; width: 45%"></div>
                                    <div class="h-1.5 rounded-[3px] bg-gray-200" style="width: 60%; margin: 0 auto; opacity: 0.3"></div>
                                </div>
                            </div>
                            <span class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900">{{ tpl.name }}</span>
                            <span class="block px-[14px] pb-[14px] text-xs text-gray-500 leading-[1.4]">{{ tpl.description }}</span>
                        </button>

                        <button aria-label="Start from scratch with empty canvas" class="pg-card-stagger chooser-card flex flex-col items-start p-0 border border-gray-200 rounded-xl bg-white cursor-pointer transition-[border-color,box-shadow] duration-200 ease-in-out text-left font-sans overflow-hidden hover:border-primary hover:shadow-primary-ring-subtle" :style="{ animationDelay: `${templates.length * 40}ms` }" @click="chooseTemplate(createDefaultTemplateContent())">
                            <div class="w-full h-[140px] flex items-center justify-center bg-gray-50 border-b border-gray-200 text-gray-500">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </div>
                            <span class="block pt-3 px-[14px] pb-0.5 text-sm font-semibold text-gray-900">Start from Scratch</span>
                            <span class="block px-[14px] pb-[14px] text-xs text-gray-500 leading-[1.4]">Empty canvas with default settings</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-3 mt-6 text-sm text-gray-500">
                        <span>Have an existing BeeFree template?</span>
                        <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
                            @click="showBeefreeImport = true"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path
                                    d="M8 2.5v8M5 7.5L8 4.5l3 3M3 10v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                            Import from BeeFree
                        </button>
                    </div>
                </div>

                <div class="fixed bottom-6 flex items-center gap-2 text-[13px] [&_a]:text-gray-500 [&_a]:no-underline [&_a]:transition-colors [&_a]:duration-150 [&_a:hover]:text-gray-900">
                    <a href="https://docs.templatical.com" target="_blank" rel="noopener">Docs</a>
                    <span class="text-gray-200">&middot;</span>
                    <a href="https://github.com/templatical/editor" target="_blank" rel="noopener">GitHub</a>
                    <span class="text-gray-200">&middot;</span>
                    <a href="#cloud">Cloud Playground</a>
                </div>
            </div>

        <!-- Editor Screen -->
        <div v-else key="editor" class="flex flex-col h-full">
            <header class="flex items-center justify-between h-12 px-4 border-b border-gray-200 bg-white shrink-0 z-[100]">
                <div class="flex items-center gap-2">
                    <button class="pg-toolbar-btn no-underline" title="Back to templates" @click="backToChooser">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Templates
                    </button>
                    <button class="pg-toolbar-btn" @click="openConfig">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M6.5 1.75a.75.75 0 0 1 1.5 0V4a.75.75 0 0 1-1.5 0V1.75zM6.5 12a.75.75 0 0 1 1.5 0v2.25a.75.75 0 0 1-1.5 0V12zM1.75 6.5a.75.75 0 0 0 0 1.5H4a.75.75 0 0 0 0-1.5H1.75zM12 6.5a.75.75 0 0 0 0 1.5h2.25a.75.75 0 0 0 0-1.5H12z" fill="currentColor"/>
                            <circle cx="7.25" cy="7.25" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                        </svg>
                        Config
                    </button>
                </div>

                <div class="flex items-center gap-1">
                    <!-- View JSON -->
                    <button class="pg-toolbar-btn" @click="toggleJson">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M5.5 3L2 8l3.5 5M10.5 3L14 8l-3.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        JSON
                    </button>

                    <!-- Export dropdown -->
                    <div class="relative" @keydown.escape="exportMenuOpen = false">
                        <button
                            class="pg-toolbar-btn"
                            aria-haspopup="true"
                            :aria-expanded="exportMenuOpen"
                            @click="exportMenuOpen = !exportMenuOpen"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M3 10v2.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10M8 2.5v8M5 7.5L8 10.5l3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            Export
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <div v-if="exportMenuOpen" role="menu" class="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden z-50" @mouseleave="exportMenuOpen = false">
                            <button role="menuitem" class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 font-sans bg-transparent border-none cursor-pointer transition-colors duration-100 hover:bg-gray-50 hover:text-gray-900" @click="handleExportJson(); exportMenuOpen = false">
                                Download JSON
                            </button>
                            <button role="menuitem" class="flex items-center w-full px-3 py-2 text-[13px] text-gray-500 font-sans bg-transparent border-none cursor-pointer transition-colors duration-100 hover:bg-gray-50 hover:text-gray-900" @click="handleExportMjml(); exportMenuOpen = false">
                                Download MJML
                            </button>
                        </div>
                    </div>

                    <div class="w-px h-5 bg-gray-200 mx-1" />

                    <a href="https://docs.templatical.com" target="_blank" rel="noopener" class="pg-toolbar-btn no-underline">Docs</a>
                    <a href="https://github.com/templatical/editor" target="_blank" rel="noopener" class="pg-toolbar-btn px-2 no-underline" aria-label="GitHub repository">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M8 .2A8 8 0 0 0 5.47 15.79c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 8 .2z"/>
                        </svg>
                    </a>
                    <a href="#cloud" class="inline-flex items-center h-8 px-2.5 border border-primary rounded-md bg-primary text-white text-[13px] font-medium font-sans cursor-pointer transition-colors duration-150 no-underline whitespace-nowrap hover:bg-primary-hover hover:border-primary-hover hover:text-white">
                        Cloud
                    </a>
                </div>
            </header>

            <div class="flex flex-1 min-h-0">
                <div ref="editorContainer" class="flex-1 min-w-0" />
            </div>
        </div>
        </Transition>

        <!-- JSON Viewer Modal -->
        <Teleport to="body">
            <Transition name="pg-modal">
            <div v-if="showJson" class="pg-modal-backdrop" @click.self="showJson = false" @keydown.escape="showJson = false">
                <div role="dialog" aria-modal="true" aria-labelledby="json-modal-title" class="pg-modal-dialog w-[720px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                        <span id="json-modal-title" class="text-sm font-semibold text-gray-900">Template JSON</span>
                        <div class="flex items-center gap-2">
                            <button class="h-[30px] px-3 border border-gray-200 rounded-md bg-white text-gray-500 text-xs font-medium font-sans cursor-pointer transition-colors duration-150 hover:bg-gray-50 hover:text-gray-900" @click="copyJson">
                                {{ copied ? 'Copied!' : 'Copy' }}
                            </button>
                            <button aria-label="Close" class="pg-modal-close" @click="showJson = false">&times;</button>
                        </div>
                    </div>
                    <div class="flex-1 overflow-auto [&_pre]:m-0 [&_pre]:p-5 [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:font-mono [&_pre]:text-gray-500">
                        <pre><code>{{ jsonContent }}</code></pre>
                    </div>
                </div>
            </div>
            </Transition>
        </Teleport>

        <!-- Config Modal -->
        <Teleport to="body">
            <Transition name="pg-modal">
            <div v-if="showConfig" class="pg-modal-backdrop" @click.self="showConfig = false" @keydown.escape="showConfig = false">
                <div role="dialog" aria-modal="true" aria-label="Editor Configuration" class="pg-modal-dialog w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
                        <div class="flex items-center gap-1">
                            <button
                                class="h-8 px-3 text-[13px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                                :class="configTab === 'options' ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'"
                                @click="configTab = 'options'"
                            >
                                Options
                            </button>
                            <button
                                class="h-8 px-3 text-[13px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                                :class="configTab === 'content' ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'"
                                @click="configTab = 'content'"
                            >
                                Content
                            </button>
                            <button
                                class="h-8 px-3 text-[13px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                                :class="configTab === 'theme' ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'"
                                @click="configTab = 'theme'"
                            >
                                Theme
                            </button>
                        </div>
                        <button aria-label="Close" class="pg-modal-close" @click="showConfig = false">&times;</button>
                    </div>
                    <div class="flex-1 overflow-auto p-5">
                        <CodeEditor
                            v-show="configTab === 'options'"
                            v-model="configOptionsJson"
                        />
                        <CodeEditor
                            v-show="configTab === 'content'"
                            v-model="configContentJson"
                        />
                        <CodeEditor
                            v-show="configTab === 'theme'"
                            v-model="configThemeJson"
                        />
                        <p v-if="configError" class="mt-2 mb-0 text-[13px] text-red-500">{{ configError }}</p>
                    </div>
                    <div class="flex items-center justify-between px-5 py-4 border-t border-gray-200 shrink-0">
                        <p class="m-0 text-xs text-gray-400">{{ { options: 'mergeTags, displayConditions, customBlocks', content: 'Template block structure', theme: 'Colors and visual overrides (OKLch)' }[configTab] }}</p>
                        <div class="flex items-center gap-2">
                            <button
                                class="h-9 px-4 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
                                @click="showConfig = false"
                            >
                                Cancel
                            </button>
                            <button
                                class="pg-cta h-9 px-4 text-[13px] rounded-md"
                                @click="applyConfig"
                            >
                                Apply & Reload
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </Transition>
        </Teleport>

        <!-- BeeFree Import Modal -->
        <Teleport to="body">
            <Transition name="pg-modal">
            <div v-if="showBeefreeImport" class="pg-modal-backdrop" @click.self="showBeefreeImport = false" @keydown.escape="showBeefreeImport = false; beefreeError = ''">
                <div role="dialog" aria-modal="true" aria-labelledby="beefree-modal-title" class="pg-modal-dialog w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col bg-white rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                        <div>
                            <span id="beefree-modal-title" class="text-sm font-semibold text-gray-900">Import BeeFree Template</span>
                            <p class="m-0 mt-1 text-xs text-gray-500">Paste the JSON export from your BeeFree editor below.</p>
                        </div>
                        <button aria-label="Close" class="pg-modal-close" @click="showBeefreeImport = false; beefreeError = ''">&times;</button>
                    </div>
                    <div class="flex-1 overflow-auto p-5">
                        <button
                            class="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 cursor-pointer transition-[border-color,color] duration-150 bg-transparent hover:border-primary hover:text-gray-900"
                            @click="handleBeefreeFileUpload"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span class="text-sm font-medium">Choose .json file</span>
                        </button>

                        <div class="flex items-center gap-4 my-4 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200">
                            <span>or paste JSON</span>
                        </div>

                        <textarea
                            v-model="beefreeJson"
                            class="pg-input h-[200px] p-4 text-xs leading-relaxed font-mono bg-gray-50 resize-y placeholder:text-gray-500"
                            placeholder='{"page": {"body": {...}, "rows": [...]}}'
                        ></textarea>
                        <p v-if="beefreeError" class="mt-2 mb-0 text-[13px] text-red-500">{{ beefreeError }}</p>
                    </div>
                    <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0">
                        <button
                            class="h-9 px-4 text-[13px] font-medium border border-gray-200 rounded-md bg-white text-gray-500 cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
                            @click="showBeefreeImport = false; beefreeError = ''"
                        >
                            Cancel
                        </button>
                        <button
                            class="pg-cta h-9 px-4 text-[13px] rounded-md"
                            @click="confirmBeefreeImport"
                        >
                            Import & Open
                        </button>
                    </div>
                </div>
            </div>
            </Transition>
        </Teleport>

        <!-- Merge Tag Picker Modal -->
        <Teleport to="body">
            <Transition name="pg-modal">
            <div v-if="mergeTagPickerOpen" class="pg-modal-backdrop" @click.self="cancelMergeTagPicker" @keydown.escape="cancelMergeTagPicker">
                <div role="dialog" aria-modal="true" aria-labelledby="mergetag-modal-title" class="pg-modal-dialog w-[380px] max-h-[480px] flex flex-col bg-white rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.15)] overflow-hidden">
                    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                        <span id="mergetag-modal-title" class="text-sm font-semibold text-gray-900">Insert Merge Tag</span>
                        <button aria-label="Close" class="pg-modal-close" @click="cancelMergeTagPicker">&times;</button>
                    </div>
                    <div class="overflow-y-auto p-2">
                        <button
                            v-for="tag in mergeTagList"
                            :key="tag.value"
                            class="group flex items-center justify-between w-full px-3 py-2.5 border-none bg-transparent rounded-lg cursor-pointer transition-[background] duration-[120ms] text-left font-sans hover:bg-gray-50"
                            @click="selectMergeTag(tag)"
                        >
                            <span class="text-[13px] font-medium text-gray-900">{{ tag.label }}</span>
                            <code class="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-gray-200">{{ tag.value }}</code>
                        </button>
                    </div>
                </div>
            </div>
            </Transition>
        </Teleport>
    </div>
</template>

