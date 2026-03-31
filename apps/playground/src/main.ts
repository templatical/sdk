import { createApp, shallowRef, h, Transition, defineAsyncComponent } from "vue";
import { useEventListener } from "@vueuse/core";
import App from "./App.vue";
import "@templatical/editor/src/styles/index.css";
import "./style.css";

// Dark mode: follow system preference
const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
function applyDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
}
applyDarkMode(darkMq.matches);
darkMq.addEventListener("change", (e) => applyDarkMode(e.matches));

// Lazy-load Cloud page — only fetched when user navigates to #cloud
const Cloud = defineAsyncComponent(() => import("./Cloud.vue"));

const pages: Record<string, ReturnType<typeof defineAsyncComponent> | typeof App> = {
  "": App,
  "#cloud": Cloud,
};

const currentPage = shallowRef(pages[window.location.hash] ?? App);

useEventListener(window, "hashchange", () => {
  currentPage.value = pages[window.location.hash] ?? App;
});

const shareId = new URLSearchParams(window.location.search).get("s");

const app = createApp({
  setup() {
    return () =>
      h(Transition, { name: "pg-screen", mode: "out-in" }, () =>
        h(currentPage.value, {
          key: currentPage.value === Cloud ? "cloud" : "oss",
        }),
      );
  },
});

app.provide("shareId", shareId);
app.mount("#app");
