import { onMounted, onBeforeUnmount } from 'vue';

export function useScrollReveal(selector = '.reveal') {
    let observer: IntersectionObserver | null = null;

    onMounted(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('reveal--in');
                        observer?.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
        );
        for (const el of document.querySelectorAll(selector)) {
            observer.observe(el);
        }
    });

    onBeforeUnmount(() => observer?.disconnect());
}
