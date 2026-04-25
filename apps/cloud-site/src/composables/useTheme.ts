import { useColorMode } from '@vueuse/core';

export type Theme = 'light' | 'dark';

export function useTheme() {
    const mode = useColorMode({
        selector: 'html',
        attribute: 'data-theme',
        storageKey: 'tpl-cloud-theme',
        modes: {
            light: 'light',
            dark: 'dark',
        },
        initialValue: 'auto',
    });

    function toggle() {
        mode.value = mode.value === 'dark' ? 'light' : 'dark';
    }

    return { mode, toggle };
}
