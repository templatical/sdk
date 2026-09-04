import {
  createApp,
  shallowRef,
  h,
  Transition,
  defineAsyncComponent,
} from "vue";
import { useEventListener } from "@vueuse/core";
import App from "./App.vue";
import { CAPABILITY_ROUTE } from "./shell/useCapabilityRoute";
import "@templatical/editor/src/styles/index.css";
import "./style.css";

// Dark mode: pre-hydration to avoid flash. Full reactive control is in
// usePlaygroundTheme() composable (auto/light/dark, persisted to localStorage).
{
  let dark = false;
  try {
    const raw = localStorage.getItem("tpl-playground-theme");
    const theme = raw ? raw.replace(/^"|"$/g, "") : "auto";
    dark =
      theme === "dark" ||
      (theme === "auto" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {
    // localStorage may be unavailable in private browsing or when storage is full
    dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.documentElement.classList.toggle("dark", dark);
}

// Lazy-load Cloud page — only fetched when user navigates to #cloud
const Cloud = defineAsyncComponent(() => import("./Cloud.vue"));
// Lazy-load multi-instance shadow-DOM playground — only used by e2e specs.
const MultiInstance = defineAsyncComponent(() => import("./MultiInstance.vue"));
// Lazy-load the capability shell — only fetched when the user navigates to
// #capabilities. The default route stays the template chooser until a later
// plan flips it.
const CapabilityShell = defineAsyncComponent(
  () => import("./shell/CapabilityShell.vue"),
);

const pages: Record<
  string,
  ReturnType<typeof defineAsyncComponent> | typeof App
> = {
  "": App,
  "#cloud": Cloud,
  "#multi": MultiInstance,
  [CAPABILITY_ROUTE]: CapabilityShell,
};

/**
 * Resolve the page for a hash. `#capabilities/<id>` carries a capability id
 * after the route, so an exact-key lookup alone can't match it — but the
 * three original routes never carry a suffix, so they resolve through the
 * same exact match as before and this adds nothing for them to regress.
 */
function resolvePage(
  hash: string,
): ReturnType<typeof defineAsyncComponent> | typeof App {
  if (hash in pages) return pages[hash];
  if (hash.startsWith(`${CAPABILITY_ROUTE}/`)) return CapabilityShell;
  return App;
}

function pageKeyFor(component: unknown): string {
  if (component === Cloud) return "cloud";
  if (component === MultiInstance) return "multi";
  if (component === CapabilityShell) return "capabilities";
  return "oss";
}

const currentPage = shallowRef(resolvePage(window.location.hash));

useEventListener(window, "hashchange", () => {
  currentPage.value = resolvePage(window.location.hash);
});

const shareId = new URLSearchParams(window.location.search).get("s");

const app = createApp({
  setup() {
    return () =>
      h(Transition, { name: "pg-screen", mode: "out-in" }, () =>
        h(currentPage.value, {
          key: pageKeyFor(currentPage.value),
        }),
      );
  },
});

app.provide("shareId", shareId);
app.mount("#app");
