import type { SavedModule } from '@templatical/types';
import { ApiClient } from './api';
import type { AuthManager } from './auth';
import type { Block } from '@templatical/types';
import { ref, type Ref } from 'vue';

export interface UseSavedModulesOptions {
    authManager: AuthManager;
    onError?: (error: Error) => void;
}

export interface UseSavedModulesReturn {
    modules: Ref<SavedModule[]>;
    isLoading: Ref<boolean>;
    loadModules: (search?: string) => Promise<void>;
    createModule: (name: string, content: Block[]) => Promise<SavedModule>;
    updateModule: (
        id: string,
        data: Partial<{ name: string; content: Block[] }>,
    ) => Promise<SavedModule>;
    deleteModule: (id: string) => Promise<void>;
}

export function useSavedModules(
    options: UseSavedModulesOptions,
): UseSavedModulesReturn {
    const api = new ApiClient(options.authManager);

    const modules = ref<SavedModule[]>([]);
    const isLoading = ref(false);

    async function loadModules(search?: string): Promise<void> {
        isLoading.value = true;
        try {
            modules.value = await api.listModules(search);
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        } finally {
            isLoading.value = false;
        }
    }

    async function createModule(
        name: string,
        content: Block[],
    ): Promise<SavedModule> {
        try {
            const module = await api.createModule({ name, content });
            modules.value = [module, ...modules.value];
            return module;
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        }
    }

    async function updateModule(
        id: string,
        data: Partial<{ name: string; content: Block[] }>,
    ): Promise<SavedModule> {
        try {
            const updated = await api.updateModule(id, data);
            modules.value = modules.value.map((m) =>
                m.id === id ? updated : m,
            );
            return updated;
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        }
    }

    async function deleteModule(id: string): Promise<void> {
        try {
            await api.deleteModule(id);
            modules.value = modules.value.filter((m) => m.id !== id);
        } catch (error) {
            options.onError?.(error as Error);
            throw error;
        }
    }

    return {
        modules,
        isLoading,
        loadModules,
        createModule,
        updateModule,
        deleteModule,
    };
}
