<script setup lang="ts">
import { ref, onUnmounted, nextTick, onMounted } from 'vue';
import { initCloud } from '@templatical/vue';
import type { TemplaticalCloudEditor, TemplaticalCloudEditorConfig } from '@templatical/vue';
import type { MergeTag } from '@templatical/types';
import { customBlockDefinitions } from '@/templates';
import LogoIcon from '@/LogoIcon.vue';

const STORAGE_KEY = 'templatical-cloud-playground';

type Screen = 'start' | 'editor';

const screen = ref<Screen>('start');
const templateUuid = ref('');
const loadError = ref('');
const isLoading = ref(false);
const currentTemplateId = ref<string | null>(null);

const editorContainer = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalCloudEditor | null>(null);

// Auth config fields — persisted to localStorage
const authSaved = ref(false);
const authMode = ref<'quick' | 'custom'>('quick');

// Quick Start fields
const clientId = ref('');
const clientSecret = ref('');
const tenant = ref('');

// Auth Proxy fields
const authUrl = ref('');
const authMethod = ref<'GET' | 'POST'>('GET');
const authCredentials = ref<'omit' | 'include' | 'same-origin'>('omit');
const authHeaders = ref('');
const authBody = ref('');

function loadSettings(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.authMode) authMode.value = saved.authMode;
        if (saved.clientId) clientId.value = saved.clientId;
        if (saved.clientSecret) clientSecret.value = saved.clientSecret;
        if (saved.tenant) tenant.value = saved.tenant;
        if (saved.authUrl) authUrl.value = saved.authUrl;
        if (saved.authMethod) authMethod.value = saved.authMethod;
        if (saved.authCredentials) authCredentials.value = saved.authCredentials;
        if (saved.authHeaders) authHeaders.value = saved.authHeaders;
        if (saved.authBody) authBody.value = saved.authBody;
        if (saved.templateUuid) templateUuid.value = saved.templateUuid;
    } catch {
        // ignore corrupt localStorage
    }
}

function saveSettings(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            authMode: authMode.value,
            clientId: clientId.value,
            clientSecret: clientSecret.value,
            tenant: tenant.value,
            authUrl: authUrl.value,
            authMethod: authMethod.value,
            authCredentials: authCredentials.value,
            authHeaders: authHeaders.value,
            authBody: authBody.value,
            templateUuid: templateUuid.value,
        }));
    } catch {
        // ignore storage errors
    }
}

function buildAuthConfig(): TemplaticalCloudEditorConfig['auth'] {
    const baseUrl = (import.meta.env.VITE_CLOUD_BASE_URL || 'https://templatical.com').replace(/\/$/, '');

    if (authMode.value === 'quick') {
        return {
            url: `${baseUrl}/api/v1/auth/token`,
            baseUrl,
            requestOptions: {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    client_id: clientId.value.trim(),
                    client_secret: clientSecret.value.trim(),
                    tenant: tenant.value.trim(),
                },
            },
        };
    }

    const config: TemplaticalCloudEditorConfig['auth'] = {
        url: authUrl.value.trim(),
        baseUrl,
        requestOptions: {
            method: authMethod.value,
            credentials: authCredentials.value,
        },
    };

    if (authHeaders.value.trim()) {
        try {
            config.requestOptions!.headers = JSON.parse(authHeaders.value.trim());
        } catch {
            // ignore invalid JSON
        }
    }

    if (authBody.value.trim() && authMethod.value === 'POST') {
        try {
            config.requestOptions!.body = JSON.parse(authBody.value.trim());
        } catch {
            // ignore invalid JSON
        }
    }

    return config;
}

const isAuthValid = ref(true);

function validateAuth(): boolean {
    if (authMode.value === 'quick') {
        if (!clientId.value.trim() || !clientSecret.value.trim() || !tenant.value.trim()) {
            loadError.value = 'Client ID, Client Secret, and Tenant are required';
            isAuthValid.value = false;
            return false;
        }
        isAuthValid.value = true;
        return true;
    }

    if (!authUrl.value.trim()) {
        loadError.value = 'Auth URL is required';
        isAuthValid.value = false;
        return false;
    }
    isAuthValid.value = true;
    return true;
}

const mergeTagList: MergeTag[] = [
    { label: 'First Name', value: '{{first_name}}' },
    { label: 'Last Name', value: '{{last_name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Company', value: '{{company}}' },
    { label: 'Plan Name', value: '{{plan_name}}' },
];

function requestMergeTag(): Promise<MergeTag | null> {
    return new Promise((resolve) => {
        const tag = mergeTagList[0];
        resolve(tag ?? null);
    });
}

async function loadTemplate(): Promise<void> {
    if (!validateAuth()) return;

    const uuid = templateUuid.value.trim();
    if (!uuid) {
        loadError.value = 'Please enter a template UUID';
        return;
    }

    saveSettings();
    loadError.value = '';
    isLoading.value = true;
    currentTemplateId.value = uuid;
    screen.value = 'editor';

    await nextTick();
    await initEditor(uuid);
    isLoading.value = false;
}

async function startFresh(): Promise<void> {
    if (!validateAuth()) return;

    saveSettings();
    loadError.value = '';
    currentTemplateId.value = null;
    screen.value = 'editor';

    await nextTick();
    await initEditor();
}

async function initEditor(templateId?: string): Promise<void> {
    if (!editorContainer.value) return;

    try {
        const config: TemplaticalCloudEditorConfig = {
            container: editorContainer.value,
            auth: buildAuthConfig(),
            mergeTags: {
                syntax: 'liquid' as const,
                tags: mergeTagList,
            },
            customBlocks: customBlockDefinitions,
            onRequestMergeTag: requestMergeTag,
            onCreate: (template) => {
                currentTemplateId.value = template.id;
                console.log('[Cloud SDK] Template created:', template.id);
            },
            onLoad: (template) => {
                currentTemplateId.value = template.id;
                console.log('[Cloud SDK] Template loaded:', template.id);
            },
            onSave: (result) => {
                console.log('[Cloud SDK] Template saved:', result);
            },
            onError: (error: Error) => {
                console.error('[Cloud SDK]', error);
            },
        };

        const instance = await initCloud(config);
        editor.value = instance;

        if (templateId) {
            await instance.load(templateId);
        } else {
            await instance.create();
        }
    } catch (err) {
        console.error('[Cloud SDK] Init failed:', err);
        loadError.value = `Failed to initialize: ${(err as Error).message}`;
        backToStart();
    }
}

function backToStart(): void {
    editor.value?.unmount();
    editor.value = null;
    currentTemplateId.value = null;
    screen.value = 'start';
}

async function saveTemplate(): Promise<void> {
    if (!editor.value) return;
    try {
        await editor.value.save();
        console.log('[Cloud SDK] Saved');
    } catch (err) {
        console.error('[Cloud SDK] Save failed:', err);
    }
}

function goToOss(): void {
    window.location.hash = '';
    window.location.reload();
}

onMounted(() => {
    loadSettings();
});


onUnmounted(() => {
    editor.value?.unmount();
});
</script>

<template>
    <div class="cloud flex flex-col h-screen font-sans bg-white text-gray-900">
        <!-- Start Screen -->
        <template v-if="screen === 'start'">
            <div class="flex flex-col items-center justify-center min-h-screen px-6 py-12 gap-4">
                <div class="max-w-[800px] w-full text-center">
                    <div class="flex items-center gap-3 mb-2 justify-center">
                        <LogoIcon />
                        <div>
                            <h1 class="m-0 text-[22px] font-semibold text-gray-900 tracking-[-0.01em]">Templatical Cloud</h1>
                        </div>
                    </div>
                    <p class="mb-0 text-gray-500 text-sm leading-normal">Everything in the OSS editor, plus cloud-powered features.</p>
                </div>

                <div class="flex flex-col lg:flex-row gap-4 max-w-[800px] w-full items-start">
                    <div class="flex-1 bg-white border border-gray-200 rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                        <div class="flex items-center gap-1 mb-4">
                            <button
                                class="h-7 px-2.5 text-[12px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                                :class="authMode === 'quick' ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-50'"
                                @click="authMode = 'quick'"
                            >
                                API Credentials
                            </button>
                            <button
                                class="h-7 px-2.5 text-[12px] font-medium rounded-md border-none cursor-pointer transition-colors duration-150"
                                :class="authMode === 'custom' ? 'bg-gray-100 text-gray-900' : 'bg-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-50'"
                                @click="authMode = 'custom'"
                            >
                                Auth Proxy
                            </button>
                        </div>

                        <!-- API Credentials -->
                        <div v-if="authMode === 'quick'">
                            <p class="m-0 mb-4 text-[13px] text-gray-500 leading-relaxed">Use your project's API credentials to connect directly. Meant only for development and testing — no backend required.</p>
                            <div class="flex-1 mb-2.5">
                                <label for="cloud-client-id" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Client ID</label>
                                <input
                                    id="cloud-client-id"
                                    v-model="clientId"
                                    type="text"
                                    class="pg-input font-mono"
                                    :class="{ '!border-red-500': !isAuthValid && !clientId.trim() }"
                                    placeholder="your-client-id"
                                />
                            </div>
                            <div class="flex-1 mb-2.5">
                                <label for="cloud-client-secret" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Client Secret</label>
                                <input
                                    id="cloud-client-secret"
                                    v-model="clientSecret"
                                    type="password"
                                    class="pg-input font-mono"
                                    :class="{ '!border-red-500': !isAuthValid && !clientSecret.trim() }"
                                    placeholder="your-client-secret"
                                />
                            </div>
                            <div class="flex-1">
                                <label for="cloud-tenant" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Tenant</label>
                                <input
                                    id="cloud-tenant"
                                    v-model="tenant"
                                    type="text"
                                    class="pg-input font-mono"
                                    :class="{ '!border-red-500': !isAuthValid && !tenant.trim() }"
                                    placeholder="tenant-slug-or-uuid"
                                />
                            </div>
                            <div class="mt-3 flex gap-2 items-start rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                                <svg class="shrink-0 mt-px text-amber-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                                <p class="m-0 text-[11px] text-amber-700 leading-snug">Credentials are sent directly from the browser. For production, use the Auth Proxy tab to route token requests through your backend.</p>
                            </div>
                        </div>

                        <!-- Auth Proxy -->
                        <div v-else>
                            <p class="m-0 mb-4 text-[13px] text-gray-500 leading-relaxed">Point the SDK to your backend token endpoint. The editor will send a request to this URL to retrieve an access token before connecting.</p>
                            <div class="flex-1 mb-2.5">
                                <label for="cloud-auth-url" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Auth Endpoint</label>
                                <input
                                    id="cloud-auth-url"
                                    v-model="authUrl"
                                    type="text"
                                    class="pg-input font-sans"
                                    :class="{ '!border-red-500': !isAuthValid }"
                                    placeholder="https://your-app.com/api/templatical/token"
                                />
                            </div>
                            <div class="flex gap-3 mb-2.5">
                                <div class="flex-1">
                                    <label for="cloud-auth-method" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Method</label>
                                    <select id="cloud-auth-method" v-model="authMethod" class="pg-input py-2 px-3 pr-8 text-[13px] font-sans cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_width=%2712%27_height=%2712%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%236b7280%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpath_d=%27m6_9_6_6_6-6%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_10px_center]">
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                    </select>
                                </div>
                                <div class="flex-1">
                                    <label for="cloud-auth-credentials" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Credentials</label>
                                    <select id="cloud-auth-credentials" v-model="authCredentials" class="pg-input py-2 px-3 pr-8 text-[13px] font-sans cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_width=%2712%27_height=%2712%27_viewBox=%270_0_24_24%27_fill=%27none%27_stroke=%27%236b7280%27_stroke-width=%272%27_stroke-linecap=%27round%27_stroke-linejoin=%27round%27%3E%3Cpath_d=%27m6_9_6_6_6-6%27/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_10px_center]">
                                        <option value="omit">omit</option>
                                        <option value="include">include</option>
                                        <option value="same-origin">same-origin</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex-1 mb-2.5">
                                <label for="cloud-auth-headers" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Headers <span class="font-normal normal-case tracking-normal opacity-70">JSON, optional</span></label>
                                <textarea
                                    id="cloud-auth-headers"
                                    v-model="authHeaders"
                                    class="pg-input font-mono !text-xs resize-y min-h-10"
                                    rows="2"
                                    placeholder='{"Authorization": "Bearer ..."}'
                                ></textarea>
                            </div>
                            <div v-if="authMethod === 'POST'" class="flex-1 mb-2.5">
                                <label for="cloud-auth-body" class="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-[0.5px]">Body <span class="font-normal normal-case tracking-normal opacity-70">JSON, optional</span></label>
                                <textarea
                                    id="cloud-auth-body"
                                    v-model="authBody"
                                    class="pg-input font-mono !text-xs resize-y min-h-10"
                                    rows="2"
                                    placeholder='{"project_id": "..."}'
                                ></textarea>
                            </div>
                        </div>

                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <p class="m-0 text-xs text-gray-500 leading-snug opacity-80">Persisted in browser storage.</p>
                            <button class="py-1.5 px-3.5 text-[13px] border border-gray-200 rounded-md bg-white text-gray-500 font-medium font-sans cursor-pointer transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50" @click="saveSettings(); authSaved = true; setTimeout(() => authSaved = false, 2000)">
                                {{ authSaved ? 'Saved' : 'Save' }}
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 bg-white border border-gray-200 rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                        <div>
                            <h2 class="m-0 mb-3 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px]">Load Existing Template</h2>
                            <div class="flex gap-2">
                                <input
                                    v-model="templateUuid"
                                    type="text"
                                    class="pg-input flex-1 py-3 px-4 font-sans placeholder:text-gray-500"
                                    placeholder="Enter template UUID..."
                                    @keydown.enter="loadTemplate"
                                />
                                <button class="pg-cta" :disabled="isLoading" @click="loadTemplate">
                                    Load
                                </button>
                            </div>
                            <p v-if="loadError" class="text-red-500 text-[13px] mt-2 mb-0">{{ loadError }}</p>
                        </div>

                        <div class="flex items-center gap-4 my-6 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200">
                            <span>or</span>
                        </div>

                        <button class="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium font-sans rounded-lg cursor-pointer transition-colors duration-150 bg-transparent text-gray-500 border border-gray-200 hover:not-disabled:bg-gray-50 hover:not-disabled:text-gray-900" @click="startFresh">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Start from Scratch
                        </button>
                    </div>
                </div>

                <div class="max-w-[800px] w-full grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-[13px] text-gray-500">
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/></svg>Version History</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v18m-6-6 6 6 6-6"/></svg>Auto Save</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>AI Writing</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Real-time Collaboration</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>Media Library</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>Saved Modules</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>Test Email</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>MCP Integration</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>Commenting</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Template Scoring</div>
                    <div class="flex items-center gap-2"><svg class="shrink-0 text-primary" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z"/><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z"/><path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z"/></svg>White Label</div>
                    <a href="https://cloud.templatical.com" target="_blank" rel="noopener" class="flex items-center gap-2 text-gray-500 no-underline hover:text-gray-900">and more &rarr;</a>
                </div>

                <button class="bg-none border-none text-gray-500 text-[13px] font-sans cursor-pointer transition-colors duration-150 hover:text-gray-900" @click="goToOss">
                    &larr; Back to OSS Playground
                </button>
            </div>
        </template>

        <!-- Editor Screen -->
        <template v-else>
            <header class="flex items-center justify-between h-12 px-4 border-b border-gray-200 bg-white shrink-0">
                <div class="flex items-center gap-3">
                    <button class="pg-toolbar-btn" @click="backToStart">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Back
                    </button>
                    <span class="inline-block text-[11px] font-medium py-0.5 px-1.5 rounded-[4px] bg-gray-50 border border-gray-200 text-gray-500">Cloud</span>
                    <code v-if="currentTemplateId" class="text-xs text-gray-500 font-mono py-1 px-2 bg-gray-50 border border-gray-200 rounded-[4px]">{{ currentTemplateId }}</code>
                    <span v-else class="text-xs text-gray-500 font-mono py-1 px-2 bg-gray-50 border border-gray-200 rounded-[4px]">New Template</span>
                </div>
                <div class="flex items-center gap-2">
                    <button class="inline-flex items-center gap-[5px] h-8 px-2.5 border border-primary rounded-md bg-primary text-white text-[13px] font-medium font-sans cursor-pointer transition-colors duration-150 ease-in-out hover:bg-primary-hover hover:border-primary-hover hover:text-white" @click="saveTemplate">
                        Save
                    </button>
                </div>
            </header>
            <div class="flex flex-1 min-h-0">
                <div ref="editorContainer" class="flex-1 min-w-0" />
            </div>
        </template>
    </div>
</template>

