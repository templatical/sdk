/**
 * Lightweight logger for the editor package.
 *
 * In production builds, `warn` and `error` still emit so consumers can surface
 * SDK issues, but tagged with `[Templatical]` for filtering. `debug`/`info` are
 * compiled out in production via the bundler's dead-code elimination.
 */

const TAG = "[Templatical]";

function isProduction(): boolean {
  // Consumer bundlers replace this expression statically. A typeof-process
  // guard would override that value in browsers, which do not have process.
  try {
    return process.env.NODE_ENV === "production";
  } catch {
    // Unbundled browser use has no environment value; keep info/debug quiet.
    return true;
  }
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
