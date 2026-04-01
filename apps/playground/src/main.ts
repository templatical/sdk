import {
  createApp,
  shallowRef,
  h,
  Transition,
  defineAsyncComponent,
} from "vue";
import { useEventListener } from "@vueuse/core";
import App from "./App.vue";
import "@templatical/editor/src/styles/index.css";
import "./style.css";

// Dark mode: pre-hydration to avoid flash. Full reactive control is in
// usePlaygroundTheme() composable (auto/light/dark, persisted to localStorage).
{
  const raw = localStorage.getItem("tpl-playground-theme");
  const theme = raw ? raw.replace(/^"|"$/g, "") : "auto";
  const dark =
    theme === "dark" ||
    (theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Lazy-load Cloud page — only fetched when user navigates to #cloud
const Cloud = defineAsyncComponent(() => import("./Cloud.vue"));

const pages: Record<
  string,
  ReturnType<typeof defineAsyncComponent> | typeof App
> = {
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
