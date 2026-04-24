/**
 * Returns a Proxy that auto-stubs every translation key access.
 *
 * Nested property access (`t.countdown.setDate`) yields child proxies that
 * stringify to the dot-path (`"countdown.setDate"`), so Vue's text
 * interpolation produces a deterministic, inspectable placeholder.
 *
 * This makes tests independent of real translation content. If a test needs
 * to assert on a specific rendered string, override that key in the
 * `provides` option passed to `mountEditor`.
 */
export function makeStubTranslations(path: string[] = []): any {
  const target = Object.assign(() => {}, { __path: path.join('.') });
  return new Proxy(target, {
    get(_, key) {
      if (key === Symbol.toPrimitive) {
        return () => path.join('.') || '';
      }
      if (key === 'toString' || key === 'valueOf') {
        return () => path.join('.') || '';
      }
      if (key === Symbol.iterator || typeof key === 'symbol') {
        return undefined;
      }
      return makeStubTranslations([...path, String(key)]);
    },
    apply() {
      return path.join('.');
    },
  });
}
