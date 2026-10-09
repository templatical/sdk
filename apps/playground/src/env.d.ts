/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUD_BASE_URL?: string;
}

/** Set by `define` in vite.config.ts, from scripts/build-info.ts. */
declare const __PG_BUILD_INFO__: import("./host/buildInfo").BuildInfo;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
