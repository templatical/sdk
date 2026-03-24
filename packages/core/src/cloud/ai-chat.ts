import type { AiChatMessage } from '@templatical/types';
import type { AuthManager } from './auth';
import { API_ROUTES, buildUrl } from './url-builder';
import type { MergeTag, TemplateContent } from '@templatical/types';
import { ref } from 'vue';

export interface UseAiChatOptions {
    authManager: AuthManager;
    getTemplateId: () => string | null;
    onApply?: (content: TemplateContent) => void;
    onError?: (error: Error) => void;
}

export interface UseAiChatReturn {
    messages: ReturnType<typeof ref<AiChatMessage[]>>;
    isGenerating: ReturnType<typeof ref<boolean>>;
    isLoadingHistory: ReturnType<typeof ref<boolean>>;
    isLastChangeReverted: ReturnType<typeof ref<boolean>>;
    lastApplyMessageId: ReturnType<typeof ref<string | null>>;
    error: ReturnType<typeof ref<string | null>>;
    failedPrompt: ReturnType<typeof ref<string | null>>;
    suggestions: ReturnType<typeof ref<string[]>>;
    isLoadingSuggestions: ReturnType<typeof ref<boolean>>;
    sendPrompt: (
        prompt: string,
        currentContent: TemplateContent,
        mergeTags: MergeTag[],
    ) => Promise<TemplateContent | null>;
    toggleLastRevert: () => void;
    loadConversation: () => Promise<void>;
    loadSuggestions: (
        currentContent: TemplateContent,
        mergeTags: MergeTag[],
    ) => Promise<void>;
    clearChat: () => void;
}

let messageIdCounter = 0;

function generateMessageId(): string {
    return `msg_${Date.now()}_${++messageIdCounter}`;
}

export function useAiChat(options: UseAiChatOptions): UseAiChatReturn {
    const { authManager, getTemplateId, onApply, onError } = options;

    const messages = ref<AiChatMessage[]>([]);
    const isGenerating = ref(false);
    const isLoadingHistory = ref(false);
    const error = ref<string | null>(null);
    const failedPrompt = ref<string | null>(null);
    const conversationId = ref<string | null>(null);
    const lastApplyMessageId = ref<string | null>(null);
    const lastPreviousContent = ref<TemplateContent | null>(null);
    const lastAppliedContent = ref<TemplateContent | null>(null);
    const isLastChangeReverted = ref(false);
    const suggestions = ref<string[]>([]);
    const isLoadingSuggestions = ref(false);

    function updateMessage(
        msgId: string,
        updates: Partial<AiChatMessage>,
    ): void {
        const idx = messages.value.findIndex((m) => m.id === msgId);
        if (idx === -1) {
            return;
        }

        const updated = { ...messages.value[idx], ...updates };
        messages.value = [
            ...messages.value.slice(0, idx),
            updated,
            ...messages.value.slice(idx + 1),
        ];
    }

    async function loadConversation(): Promise<void> {
        const templateId = getTemplateId();
        if (!templateId) {
            return;
        }

        isLoadingHistory.value = true;

        try {
            const url = buildUrl(API_ROUTES['ai.conversationMessages'], {
                project: authManager.projectId,
                tenant: authManager.tenantSlug,
                template: templateId,
            });

            const response = await authManager.authenticatedFetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (data.conversation_id) {
                conversationId.value = data.conversation_id;
            }

            if (Array.isArray(data.data) && data.data.length > 0) {
                messages.value = data.data.map(
                    (msg: {
                        id: string;
                        role: 'user' | 'assistant';
                        content: string;
                        created_at: string;
                    }) => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        timestamp: new Date(msg.created_at).getTime(),
                    }),
                );
            }
        } catch {
            // Silently fail - chat will start fresh
        } finally {
            isLoadingHistory.value = false;
        }
    }

    async function loadSuggestions(
        currentContent: TemplateContent,
        mergeTags: MergeTag[],
    ): Promise<void> {
        const templateId = getTemplateId();
        if (!templateId) {
            return;
        }

        isLoadingSuggestions.value = true;

        try {
            const url = buildUrl(API_ROUTES['ai.suggestions'], {
                project: authManager.projectId,
                tenant: authManager.tenantSlug,
                template: templateId,
            });

            const response = await authManager.authenticatedFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({
                    current_content: currentContent,
                    merge_tags: mergeTags.map((p) => ({
                        label: p.label,
                        value: p.value,
                    })),
                }),
            });

            if (!response.ok) {
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) {
                        continue;
                    }

                    let event;
                    try {
                        event = JSON.parse(line.slice(6));
                    } catch {
                        continue;
                    }

                    if (
                        event.type === 'done' &&
                        Array.isArray(event.suggestions)
                    ) {
                        suggestions.value = event.suggestions.slice(0, 3);
                    }
                }
            }
        } catch {
            // Silently fail - suggestions are non-critical
        } finally {
            isLoadingSuggestions.value = false;
        }
    }

    async function sendPrompt(
        prompt: string,
        currentContent: TemplateContent,
        mergeTags: MergeTag[],
    ): Promise<TemplateContent | null> {
        const templateId = getTemplateId();
        if (!templateId) {
            throw new Error(
                'Template must be saved before using AI generation',
            );
        }

        isGenerating.value = true;
        error.value = null;
        failedPrompt.value = null;
        suggestions.value = [];

        const userMsgId = generateMessageId();
        messages.value = [
            ...messages.value,
            {
                id: userMsgId,
                role: 'user',
                content: prompt,
                timestamp: Date.now(),
            },
        ];

        const assistantMsgId = generateMessageId();
        messages.value = [
            ...messages.value,
            {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
            },
        ];

        try {
            const url = buildUrl(API_ROUTES['ai.generate'], {
                project: authManager.projectId,
                tenant: authManager.tenantSlug,
                template: templateId,
            });

            const response = await authManager.authenticatedFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({
                    prompt,
                    current_content: currentContent,
                    merge_tags: mergeTags.map((p) => ({
                        label: p.label,
                        value: p.value,
                    })),
                    conversation_id: conversationId.value,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                if (response.status === 403) {
                    throw new Error('ai_generation_not_available');
                }
                throw new Error(
                    errorData?.message || 'Failed to generate template',
                );
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to read stream');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let result: TemplateContent | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) {
                        continue;
                    }

                    const jsonStr = line.slice(6);

                    let event;
                    try {
                        event = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }

                    if (event.type === 'text') {
                        updateMessage(assistantMsgId, {
                            content:
                                (messages.value.find(
                                    (m) => m.id === assistantMsgId,
                                )?.content ?? '') + event.text,
                        });
                    } else if (event.type === 'error') {
                        throw new Error(
                            event.message || 'Failed to generate template',
                        );
                    } else if (event.type === 'done') {
                        if (event.conversation_id) {
                            conversationId.value = event.conversation_id;
                        }

                        updateMessage(assistantMsgId, {
                            content: event.text,
                        });

                        result = event.content ?? null;

                        if (result) {
                            lastPreviousContent.value = currentContent;
                            lastAppliedContent.value = result;
                            lastApplyMessageId.value = assistantMsgId;
                            isLastChangeReverted.value = false;
                            onApply?.(result);
                        } else {
                            error.value = 'ai_apply_failed';
                        }
                    }
                }
            }

            return result;
        } catch (err) {
            const wrappedError =
                err instanceof Error
                    ? err
                    : new Error('Failed to generate template');
            error.value = wrappedError.message;
            failedPrompt.value = prompt;
            onError?.(wrappedError);

            messages.value = messages.value.filter(
                (m) => m.id !== userMsgId && m.id !== assistantMsgId,
            );

            return null;
        } finally {
            isGenerating.value = false;
        }
    }

    function toggleLastRevert(): void {
        if (isLastChangeReverted.value) {
            if (lastAppliedContent.value) {
                onApply?.(lastAppliedContent.value);
            }
            isLastChangeReverted.value = false;
        } else {
            if (lastPreviousContent.value) {
                onApply?.(lastPreviousContent.value);
            }
            isLastChangeReverted.value = true;
        }
    }

    function clearChat(): void {
        messages.value = [];
        conversationId.value = null;
        error.value = null;
        lastApplyMessageId.value = null;
        lastPreviousContent.value = null;
        lastAppliedContent.value = null;
        isLastChangeReverted.value = false;
    }

    return {
        messages,
        isGenerating,
        isLoadingHistory,
        isLastChangeReverted,
        lastApplyMessageId,
        error,
        failedPrompt,
        suggestions,
        isLoadingSuggestions,
        sendPrompt,
        toggleLastRevert,
        loadConversation,
        loadSuggestions,
        clearChat,
    };
}
