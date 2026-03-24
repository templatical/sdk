import type { Template, TemplateSnapshot } from '@templatical/types';
import { ApiClient } from './api';
import type { AuthManager } from './auth';
import { ref, type Ref } from 'vue';

export interface UseSnapshotHistoryOptions {
    authManager: AuthManager;
    templateId: string;
    onRestore?: (template: Template) => void;
    onError?: (error: Error) => void;
}

export interface UseSnapshotHistoryReturn {
    snapshots: Ref<TemplateSnapshot[]>;
    isLoading: Ref<boolean>;
    isRestoring: Ref<boolean>;
    loadSnapshots: () => Promise<void>;
    restoreSnapshot: (snapshotId: string) => Promise<Template>;
}

export function useSnapshotHistory(
    options: UseSnapshotHistoryOptions,
): UseSnapshotHistoryReturn {
    const api = new ApiClient(options.authManager);

    const snapshots = ref<TemplateSnapshot[]>([]);
    const isLoading = ref(false);
    const isRestoring = ref(false);

    async function loadSnapshots(): Promise<void> {
        isLoading.value = true;
        try {
            snapshots.value = await api.getSnapshots(options.templateId);
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    async function restoreSnapshot(snapshotId: string): Promise<Template> {
        isRestoring.value = true;
        try {
            const template = await api.restoreSnapshot(
                options.templateId,
                snapshotId,
            );
            options.onRestore?.(template);
            return template;
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        } finally {
            isRestoring.value = false;
        }
    }

    return {
        snapshots,
        isLoading,
        isRestoring,
        loadSnapshots,
        restoreSnapshot,
    };
}
