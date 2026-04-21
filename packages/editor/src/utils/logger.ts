/**
 * Lightweight logger for the editor package.
 *
 * In production builds, `warn` and `error` still emit so consumers can surface
 * SDK issues, but tagged with `[Templatical]` for filtering. `debug`/`info` are
 * compiled out in production via the bundler's dead-code elimination.
 */

const TAG = "[Templatical]";

function isProduction(): boolean {
  // `process.env.NODE_ENV` is replaced statically by Vite/tsup in consumer builds.
  // Guard access so pure browser environments (no process) don't throw.
  return (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV === "production"
  );
}

export const logger = {
  warn(...args: unknown[]): void {
    console.warn(TAG, ...args);
  },
  error(...args: unknown[]): void {
    console.error(TAG, ...args);
  },
  debug(...args: unknown[]): void {
    if (!isProduction()) {
      console.debug(TAG, ...args);
    }
  },
  info(...args: unknown[]): void {
    if (!isProduction()) {
      console.info(TAG, ...args);
    }
  },
};
