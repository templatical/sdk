<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { useFocusTrap } from "@vueuse/integrations/useFocusTrap";
import { initCloud } from "@templatical/editor";
import type {
  TemplaticalCloudEditor,
  TemplaticalCloudEditorConfig,
} from "@templatical/editor";
import type { MergeTag } from "@templatical/types";
import { customBlockDefinitions } from "@/templates";
import LogoIcon from "@/LogoIcon.vue";
import { usePlaygroundI18n, format, supportedLocales } from "@/i18n";

const { locale, t } = usePlaygroundI18n();

const STORAGE_KEY = "templatical-cloud-playground";

type Screen = "start" | "editor";

const screen = ref<Screen>("start");
const loadError = ref("");
const initError = ref("");
const isLoading = ref(false);
const currentTemplateId = ref<string | null>(null);

const editorContainer = ref<HTMLElement | null>(null);
const editor = ref<TemplaticalCloudEditor | null>(null);

// All persisted fields — auto-synced to localStorage
const settings = useLocalStorage(
  STORAGE_KEY,
  {
    authMode: "quick" as "quick" | "custom",
    clientId: "",
    clientSecret: "",
    tenant: "",
    signingKey: "",
    userName: "Playground User",
    testEmailAddress: "",
    realtimeMode: "collab" as "collab" | "mcp",
    authUrl: "",
    authMethod: "GET" as "GET" | "POST",
    authCredentials: "omit" as "omit" | "include" | "same-origin",
    authHeaders: "",
    authBody: "",
    templateUuid: "",
  },
  { mergeDefaults: true },
);

// Non-persisted UI state
const signingOpen = ref(false);

function buildAuthConfig(): TemplaticalCloudEditorConfig["auth"] {
  const baseUrl = (
    import.meta.env.VITE_CLOUD_BASE_URL || "https://cloud.templatical.com"
  ).replace(/\/$/, "");

  if (settings.value.authMode === "quick") {
    tokenAuthUrl = `${baseUrl}/api/v1/auth/token`;
    return {
      url: tokenAuthUrl,
      baseUrl,
      requestOptions: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: {
          client_id: settings.value.clientId.trim(),
          client_secret: settings.value.clientSecret.trim(),
          tenant: settings.value.tenant.trim(),
        },
      },
    };
  }

  tokenAuthUrl = settings.value.authUrl.trim();
  const config: TemplaticalCloudEditorConfig["auth"] = {
    url: tokenAuthUrl,
    baseUrl,
    requestOptions: {
      method: settings.value.authMethod,
      credentials: settings.value.authCredentials,
    },
  };

  if (settings.value.authHeaders.trim()) {
    try {
      config.requestOptions!.headers = JSON.parse(
        settings.value.authHeaders.trim(),
      );
    } catch {
      // ignore invalid JSON
    }
  }

  if (settings.value.authBody.trim() && settings.value.authMethod === "POST") {
    try {
      config.requestOptions!.body = JSON.parse(settings.value.authBody.trim());
    } catch {
      // ignore invalid JSON
    }
  }

  return config;
}

const isAuthValid = ref(true);

function validateAuth(): boolean {
  if (settings.value.authMode === "quick") {
    if (
      !settings.value.clientId.trim() ||
      !settings.value.clientSecret.trim() ||
      !settings.value.tenant.trim()
    ) {
      loadError.value = t.value.cloud.errors.requiredFields;
      isAuthValid.value = false;
      return false;
    }
    isAuthValid.value = true;
    return true;
  }

  if (!settings.value.authUrl.trim()) {
    loadError.value = t.value.cloud.errors.authUrlRequired;
    isAuthValid.value = false;
    return false;
  }
  isAuthValid.value = true;
  return true;
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let tokenAuthUrl: string | null = null;
let originalFetch: typeof window.fetch | null = null;
const PATCHED = Symbol.for("templatical-playground-fetch");

onMounted(() => {
  if ((window.fetch as unknown as Record<symbol, boolean>)[PATCHED]) return;

  originalFetch = window.fetch;

  const patchedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await originalFetch!(input, init);

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const key = settings.value.signingKey.trim();
    if (!key || !tokenAuthUrl || !url.includes(tokenAuthUrl)) {
      return response;
    }

    const cloned = response.clone();
    const data = await cloned.json();

    const userId = crypto.randomUUID();
    const name = settings.value.userName.trim() || "Playground User";
    const userSignature = await hmacSha256(key, userId);
    data.user = { id: userId, name, signature: userSignature };

    const email = settings.value.testEmailAddress.trim();
    if (email) {
      const emails = [email];
      const testEmailSignature = await hmacSha256(key, JSON.stringify(emails));
      data.test_email = {
        allowed_emails: emails,
        signature: testEmailSignature,
      };
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  (patchedFetch as unknown as Record<symbol, boolean>)[PATCHED] = true;
  window.fetch = patchedFetch;
});

const mergeTagList = computed<MergeTag[]>(() => [
  { label: t.value.mergeTags.firstName, value: "{{first_name}}" },
  { label: t.value.mergeTags.lastName, value: "{{last_name}}" },
  { label: t.value.mergeTags.email, value: "{{email}}" },
  { label: t.value.mergeTags.company, value: "{{company}}" },
  { label: t.value.mergeTags.planName, value: "{{plan_name}}" },
]);

const mergeTagPickerOpen = ref(false);
let mergeTagResolve: ((tag: MergeTag | null) => void) | null = null;

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

const mergeTagModalRef = ref<HTMLElement | null>(null);
const { activate: activateMergeTagTrap, deactivate: deactivateMergeTagTrap } =
  useFocusTrap(mergeTagModalRef, {
    allowOutsideClick: true,
    escapeDeactivates: false,
  });
watch(mergeTagPickerOpen, async (open) => {
  if (open) {
    await nextTick();
    activateMergeTagTrap();
  } else {
    deactivateMergeTagTrap();
  }
});

async function loadTemplate(): Promise<void> {
  if (!validateAuth()) return;

  const uuid = settings.value.templateUuid.trim();
  if (!uuid) {
    loadError.value = t.value.cloud.errors.enterUuid;
    return;
  }

  loadError.value = "";
  isLoading.value = true;
  currentTemplateId.value = uuid;
  screen.value = "editor";

  await nextTick();
  await initEditor(uuid);
  isLoading.value = false;
}

async function startFresh(): Promise<void> {
  if (!validateAuth()) return;

  loadError.value = "";
  currentTemplateId.value = null;
  screen.value = "editor";

  await nextTick();
  await initEditor();
}

async function initEditor(templateId?: string): Promise<void> {
  if (!editorContainer.value) return;

  initError.value = "";
  try {
    const config: TemplaticalCloudEditorConfig = {
      container: editorContainer.value,
      auth: buildAuthConfig(),
      locale: locale.value,
      mergeTags: {
        syntax: "liquid" as const,
        tags: mergeTagList.value,
        onRequest: requestMergeTag,
      },
      customBlocks: customBlockDefinitions,
      onCreate: (template) => {
        currentTemplateId.value = template.id;
        console.log("[Cloud SDK] Template created:", template.id);
      },
      onLoad: (template) => {
        currentTemplateId.value = template.id;
        console.log("[Cloud SDK] Template loaded:", template.id);
      },
      onSave: (result) => {
        console.log("[Cloud SDK] Template saved:", result);
      },
      onError: (error: Error) => {
        console.error("[Cloud SDK]", error);
      },
      commenting: !!(
        settings.value.signingKey.trim() && settings.value.userName.trim()
      ),
      ...(settings.value.realtimeMode === "collab"
        ? {
            collaboration: {
              enabled: !!(
                settings.value.signingKey.trim() &&
                settings.value.userName.trim()
              ),
            },
          }
        : {
            mcp: {
              enabled: true,
              onOperation: (payload: unknown) =>
                console.log("[Cloud SDK] MCP operation:", payload),
            },
          }),
    };

    const instance = await initCloud(config);
    editor.value = instance;

    if (templateId) {
      await instance.load(templateId);
    } else {
      await instance.create();
    }
  } catch (err) {
    console.error("[Cloud SDK] Init failed:", err);
    initError.value = format(t.value.cloud.errors.initFailed, {
      message: (err as Error).message,
    });
  }
}

function backToStart(): void {
  editor.value?.unmount();
  editor.value = null;
  currentTemplateId.value = null;
  screen.value = "start";
}

async function saveTemplate(): Promise<void> {
  if (!editor.value) return;
  try {
    await editor.value.save();
    console.log("[Cloud SDK] Saved");
  } catch (err) {
    console.error("[Cloud SDK] Save failed:", err);
  }
}

function goToOss(): void {
  editor.value?.unmount();
  editor.value = null;
  window.location.hash = "";
}

watch(locale, () => {
  if (screen.value === "editor" && editor.value) {
    initEditor(currentTemplateId.value ?? undefined);
  }
});

onUnmounted(() => {
  editor.value?.unmount();
  if (originalFetch) {
    window.fetch = originalFetch;
    originalFetch = null;
  }
});
</script>

<template>
  <div class="cloud flex flex-col h-screen font-sans bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
    <!-- Start Screen -->
    <template v-if="screen === 'start'">
      <main
        class="relative flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 py-12 gap-4"
      >
        <div class="absolute top-4 right-4">
          <select
            v-model="locale"
            :aria-label="t.a11y.selectLanguage"
            class="pg-locale-select"
          >
            <option v-for="loc in supportedLocales" :key="loc" :value="loc">
              {{ loc.toUpperCase() }}
            </option>
          </select>
        </div>
        <div class="max-w-[800px] w-full text-center">
          <div class="flex items-center gap-3 mb-2 justify-center">
            <LogoIcon />
            <div>
              <h1
                class="m-0 text-[22px] font-semibold text-gray-900 tracking-[-0.01em] dark:text-gray-100"
              >
                {{ t.cloud.title }}
              </h1>
            </div>
          </div>
          <p class="mb-0 text-gray-500 dark:text-gray-400 text-sm leading-normal">
            {{ t.cloud.subtitle }}
          </p>
        </div>

        <div
          class="flex flex-col lg:flex-row gap-4 max-w-[800px] w-full items-start"
        >
          <div
            class="flex-1 bg-white border border-gray-200 rounded-2xl p-5 sm:p-8 shadow-card dark:bg-gray-800 dark:border-gray-700"
          >
            <div
              role="tablist"
              :aria-label="t.a11y.authMethod"
              class="flex items-center gap-1 mb-4"
            >
              <button
                role="tab"
                :aria-selected="settings.authMode === 'quick'"
                aria-controls="auth-panel-quick"
                class="pg-tab"
                :class="settings.authMode === 'quick' ? 'pg-tab-active' : 'pg-tab-inactive'"
                @click="settings.authMode = 'quick'"
              >
                {{ t.cloud.auth.apiCredentials }}
              </button>
              <button
                role="tab"
                :aria-selected="settings.authMode === 'custom'"
                aria-controls="auth-panel-custom"
                class="pg-tab"
                :class="settings.authMode === 'custom' ? 'pg-tab-active' : 'pg-tab-inactive'"
                @click="settings.authMode = 'custom'"
              >
                {{ t.cloud.auth.authProxy }}
              </button>
            </div>

            <!-- API Credentials -->
            <div
              v-if="settings.authMode === 'quick'"
              id="auth-panel-quick"
              role="tabpanel"
            >
              <p class="m-0 mb-4 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {{ t.cloud.auth.apiDescription }}
              </p>
              <div class="flex-1 mb-2.5">
                <label
                  for="cloud-client-id"
                  class="pg-form-label"
                  >{{ t.cloud.auth.clientId }}
                  <span class="text-red-500">*</span></label
                >
                <input
                  id="cloud-client-id"
                  v-model="settings.clientId"
                  type="text"
                  autocomplete="off"
                  class="pg-input"
                  :class="{
                    '!border-red-500':
                      !isAuthValid && !settings.clientId.trim(),
                  }"
                  placeholder="your-client-id"
                />
              </div>
              <div class="flex-1 mb-2.5">
                <label
                  for="cloud-client-secret"
                  class="pg-form-label"
                  >{{ t.cloud.auth.clientSecret }}
                  <span class="text-red-500">*</span></label
                >
                <input
                  id="cloud-client-secret"
                  v-model="settings.clientSecret"
                  type="password"
                  autocomplete="off"
                  class="pg-input"
                  :class="{
                    '!border-red-500':
                      !isAuthValid && !settings.clientSecret.trim(),
                  }"
                  placeholder="your-client-secret"
                />
              </div>
              <div class="flex-1">
                <label
                  for="cloud-tenant"
                  class="pg-form-label"
                  >{{ t.cloud.auth.tenant }}
                  <span class="text-red-500">*</span></label
                >
                <input
                  id="cloud-tenant"
                  v-model="settings.tenant"
                  type="text"
                  autocomplete="off"
                  class="pg-input"
                  :class="{
                    '!border-red-500': !isAuthValid && !settings.tenant.trim(),
                  }"
                  placeholder="tenant-slug-or-uuid"
                />
              </div>
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  :aria-expanded="signingOpen"
                  aria-controls="signing-section"
                  class="pg-form-label m-0 mb-3 cursor-pointer flex items-center gap-1.5 select-none bg-transparent border-none p-0"
                  @click="signingOpen = !signingOpen"
                >
                  <svg
                    class="shrink-0 transition-transform duration-150"
                    :class="signingOpen ? 'rotate-90' : ''"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  {{ t.cloud.auth.identitySigning }}
                  <span
                    class="font-normal normal-case tracking-normal opacity-70"
                    >{{ t.cloud.auth.optional }}</span
                  >
                </button>
                <Transition name="pg-collapsible">
                  <div id="signing-section" v-show="signingOpen">
                    <div class="flex-1 mb-2.5">
                      <label
                        for="cloud-signing-key"
                        class="pg-form-label"
                        >{{ t.cloud.auth.signingKey }}</label
                      >
                      <input
                        id="cloud-signing-key"
                        v-model="settings.signingKey"
                        type="password"
                        class="pg-input"
                        placeholder="Project signing key"
                      />
                      <p
                        class="m-0 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 leading-snug"
                      >
                        {{ t.cloud.auth.signingKeyHelp }}
                      </p>
                    </div>
                    <div
                      role="tablist"
                      :aria-label="t.a11y.realtimeMode"
                      class="flex items-center gap-1 mb-3"
                    >
                      <button
                        role="tab"
                        :aria-selected="settings.realtimeMode === 'collab'"
                        class="pg-tab"
                        :class="settings.realtimeMode === 'collab' ? 'pg-tab-active' : 'pg-tab-inactive'"
                        @click="settings.realtimeMode = 'collab'"
                      >
                        {{ t.cloud.auth.collaboration }}
                      </button>
                      <button
                        role="tab"
                        :aria-selected="settings.realtimeMode === 'mcp'"
                        class="pg-tab"
                        :class="settings.realtimeMode === 'mcp' ? 'pg-tab-active' : 'pg-tab-inactive'"
                        @click="settings.realtimeMode = 'mcp'"
                      >
                        {{ t.cloud.auth.mcp }}
                      </button>
                    </div>
                    <p class="m-0 mb-3 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                      {{ t.cloud.auth.realtimeDescription }}
                    </p>
                    <div class="flex gap-3 mb-2.5">
                      <div class="flex-1">
                        <label
                          for="cloud-user-name"
                          class="pg-form-label"
                          >{{ t.cloud.auth.userName }}</label
                        >
                        <input
                          id="cloud-user-name"
                          v-model="settings.userName"
                          type="text"
                          class="pg-input"
                          placeholder="Playground User"
                        />
                      </div>
                      <div class="flex-1">
                        <label
                          for="cloud-test-email"
                          class="pg-form-label"
                          >{{ t.cloud.auth.testEmail }}</label
                        >
                        <input
                          id="cloud-test-email"
                          v-model="settings.testEmailAddress"
                          type="email"
                          class="pg-input"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>

              <div
                class="mt-3 flex gap-2 items-start rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 dark:bg-amber-950/30 dark:border-amber-800"
              >
                <svg
                  class="shrink-0 mt-px text-amber-500"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path
                    d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
                  />
                  <line x1="12" x2="12" y1="9" y2="13" />
                  <line x1="12" x2="12.01" y1="17" y2="17" />
                </svg>
                <p class="m-0 text-[11px] text-amber-700 leading-snug dark:text-amber-400">
                  {{ t.cloud.auth.credentialsWarning }}
                </p>
              </div>
            </div>

            <!-- Auth Proxy -->
            <div v-else id="auth-panel-custom" role="tabpanel">
              <p class="m-0 mb-4 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {{ t.cloud.auth.proxyDescription }}
              </p>
              <div class="flex-1 mb-2.5">
                <label
                  for="cloud-auth-url"
                  class="pg-form-label"
                  >{{ t.cloud.auth.authEndpoint }}
                  <span class="text-red-500">*</span></label
                >
                <input
                  id="cloud-auth-url"
                  v-model="settings.authUrl"
                  type="text"
                  class="pg-input"
                  :class="{ '!border-red-500': !isAuthValid }"
                  placeholder="https://your-app.com/api/templatical/token"
                />
              </div>
              <div class="flex gap-3 mb-2.5">
                <div class="flex-1">
                  <label
                    for="cloud-auth-method"
                    class="pg-form-label"
                    >{{ t.cloud.auth.method }}</label
                  >
                  <select
                    id="cloud-auth-method"
                    v-model="settings.authMethod"
                    class="pg-select"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div class="flex-1">
                  <label
                    for="cloud-auth-credentials"
                    class="pg-form-label"
                    >{{ t.cloud.auth.credentials }}</label
                  >
                  <select
                    id="cloud-auth-credentials"
                    v-model="settings.authCredentials"
                    class="pg-select"
                  >
                    <option value="omit">omit</option>
                    <option value="include">include</option>
                    <option value="same-origin">same-origin</option>
                  </select>
                </div>
              </div>
              <div class="flex-1 mb-2.5">
                <label
                  for="cloud-auth-headers"
                  class="pg-form-label"
                  >{{ t.cloud.auth.headers }}
                  <span
                    class="font-normal normal-case tracking-normal opacity-70"
                    >{{ t.cloud.auth.jsonOptional }}</span
                  ></label
                >
                <textarea
                  id="cloud-auth-headers"
                  v-model="settings.authHeaders"
                  class="pg-input !text-xs resize-y min-h-10"
                  rows="2"
                  placeholder='{"Authorization": "Bearer ..."}'
                ></textarea>
              </div>
              <div v-if="settings.authMethod === 'POST'" class="flex-1 mb-2.5">
                <label
                  for="cloud-auth-body"
                  class="pg-form-label"
                  >{{ t.cloud.auth.body }}
                  <span
                    class="font-normal normal-case tracking-normal opacity-70"
                    >{{ t.cloud.auth.jsonOptional }}</span
                  ></label
                >
                <textarea
                  id="cloud-auth-body"
                  v-model="settings.authBody"
                  class="pg-input !text-xs resize-y min-h-10"
                  rows="2"
                  placeholder='{"project_id": "..."}'
                ></textarea>
              </div>
            </div>
          </div>

          <div
            class="flex-1 bg-white border border-gray-200 rounded-2xl p-5 sm:p-8 shadow-card dark:bg-gray-800 dark:border-gray-700"
          >
            <div>
              <h2
                class="pg-form-label m-0 mb-3"
              >
                {{ t.cloud.template.loadExisting }}
              </h2>
              <div class="flex gap-2">
                <input
                  v-model="settings.templateUuid"
                  type="text"
                  :aria-label="t.a11y.templateUuid"
                  class="pg-input flex-1 py-3 px-4 font-sans placeholder:text-gray-500"
                  :placeholder="t.cloud.template.enterUuid"
                  @keydown.enter="loadTemplate"
                />
                <button
                  class="pg-cta"
                  :disabled="isLoading"
                  @click="loadTemplate"
                >
                  {{ t.cloud.template.load }}
                </button>
              </div>
              <p v-if="loadError" class="text-red-500 text-[13px] mt-2 mb-0">
                {{ loadError }}
              </p>
            </div>

            <div
              class="flex items-center gap-4 my-6 text-gray-500 text-xs uppercase tracking-[0.5px] before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200 dark:text-gray-400 before:dark:bg-gray-700 after:dark:bg-gray-700"
            >
              <span>{{ t.common.or }}</span>
            </div>

            <button
              class="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium font-sans rounded-lg cursor-pointer transition-colors duration-150 bg-transparent text-gray-500 border border-gray-200 hover:not-disabled:bg-gray-50 hover:not-disabled:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:not-disabled:bg-gray-700 dark:hover:not-disabled:text-gray-100"
              @click="startFresh"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {{ t.cloud.template.startFromScratch }}
            </button>
          </div>
        </div>

        <ul
          class="max-w-[800px] w-full grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-[13px] text-gray-500 list-none m-0 p-0 dark:text-gray-400"
        >
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" /></svg
            >{{ t.cloud.features.versionHistory }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 3v18m-6-6 6 6 6-6" /></svg
            >{{ t.cloud.features.autoSave }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              /></svg
            >{{ t.cloud.features.aiWriting }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg
            >{{ t.cloud.features.realtimeCollaboration }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg
            >{{ t.cloud.features.mediaLibrary }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" x2="12" y1="2" y2="15" /></svg
            >{{ t.cloud.features.savedModules }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
              />
              <line x1="4" x2="4" y1="22" y2="15" /></svg
            >{{ t.cloud.features.testEmail }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" /></svg
            >{{ t.cloud.features.mcpIntegration }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg
            >{{ t.cloud.features.commenting }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              <polyline points="22 4 12 14.01 9 11.01" /></svg
            >{{ t.cloud.features.templateScoring }}
          </li>
          <li class="flex items-center gap-2">
            <svg
              class="shrink-0 text-primary"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5Z" />
              <path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z" />
              <path d="M18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5Z" />
              <path d="m12 15 3.5 3.5L12 22l-3.5-3.5L12 15Z" /></svg
            >{{ t.cloud.features.whiteLabel }}
          </li>
          <li class="flex items-center gap-2">
            <a
              href="https://cloud.templatical.com"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 text-gray-500 no-underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >{{ t.cloud.features.andMore }}</a
            >
          </li>
        </ul>

        <button
          class="bg-transparent border-none text-gray-500 text-[13px] font-sans cursor-pointer transition-colors duration-150 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md dark:text-gray-400 dark:hover:text-gray-100"
          @click="goToOss"
        >
          {{ t.cloud.backToOss }}
        </button>
      </main>
    </template>

    <!-- Editor Screen -->
    <template v-else>
      <header
        class="flex items-center justify-between h-12 px-4 bg-gray-100 shrink-0 dark:bg-gray-800"
      >
        <div class="flex items-center gap-3">
          <button class="pg-toolbar-btn" @click="backToStart">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ t.cloud.editor.back }}
          </button>
          <span
            class="hidden sm:inline-block text-[11px] font-medium py-0.5 px-1.5 rounded bg-gray-50 border border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
            >{{ t.cloud.editor.cloud }}</span
          >
          <code
            v-if="currentTemplateId"
            class="hidden sm:inline text-xs text-gray-500 font-mono py-1 px-2 bg-gray-50 border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
            >{{ currentTemplateId }}</code
          >
          <span
            v-else
            class="hidden sm:inline text-xs text-gray-500 font-mono py-1 px-2 bg-gray-50 border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
            >{{ t.cloud.editor.newTemplate }}</span
          >
        </div>
        <div class="flex items-center gap-2">
          <select
            v-model="locale"
            :aria-label="t.a11y.selectLanguage"
            class="pg-locale-select"
          >
            <option v-for="loc in supportedLocales" :key="loc" :value="loc">
              {{ loc.toUpperCase() }}
            </option>
          </select>
          <button
            class="pg-cta h-8 px-3 text-[13px] rounded-md"
            @click="saveTemplate"
          >
            {{ t.cloud.editor.save }}
          </button>
        </div>
      </header>
      <main class="flex flex-1 min-h-0 bg-gray-100 p-[15px] dark:bg-gray-950">
        <div
          v-if="initError"
          class="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700"
        >
          <p class="m-0 text-sm text-red-500">{{ initError }}</p>
          <button
            class="pg-toolbar-btn"
            @click="initEditor(currentTemplateId ?? undefined)"
          >
            {{ t.cloud.editor.retry }}
          </button>
        </div>
        <div
          v-else
          ref="editorContainer"
          class="flex-1 min-w-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700"
        />
      </main>
    </template>

    <!-- Merge Tag Picker Modal -->
    <Teleport to="body">
      <Transition name="pg-modal">
        <div
          v-if="mergeTagPickerOpen"
          class="pg-modal-backdrop"
          @click.self="cancelMergeTagPicker"
          @keydown.escape="cancelMergeTagPicker"
        >
          <div
            ref="mergeTagModalRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-mergetag-modal-title"
            class="pg-modal-dialog w-[380px] max-w-[90vw] max-h-[480px] flex flex-col bg-white rounded-xl shadow-modal-sm overflow-hidden dark:bg-gray-800"
          >
            <div
              class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700"
            >
              <span
                id="cloud-mergetag-modal-title"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                >{{ t.mergeTagModal.title }}</span
              >
              <button
                :aria-label="t.common.close"
                class="pg-modal-close"
                @click="cancelMergeTagPicker"
              >
                &times;
              </button>
            </div>
            <div class="overflow-y-auto p-2">
              <button
                v-for="tag in mergeTagList"
                :key="tag.value"
                class="group flex items-center justify-between w-full px-3 py-2.5 border-none bg-transparent rounded-lg cursor-pointer transition-[background] duration-[120ms] text-left font-sans hover:bg-gray-50 dark:hover:bg-gray-700"
                @click="selectMergeTag(tag)"
              >
                <span class="text-[13px] font-medium text-gray-900 dark:text-gray-100">{{
                  tag.label
                }}</span>
                <code
                  class="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-700 dark:group-hover:bg-gray-600"
                  >{{ tag.value }}</code
                >
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
