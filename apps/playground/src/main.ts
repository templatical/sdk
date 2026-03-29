import { createApp, shallowRef, h, Transition, type Component } from "vue";
import { useEventListener } from "@vueuse/core";
import App from "./App.vue";
import Cloud from "./Cloud.vue";
import "@templatical/editor/src/styles/index.css";
import "./style.css";

const pages: Record<string, Component> = {
  "": App,
  "#cloud": Cloud,
};

const currentPage = shallowRef<Component>(pages[window.location.hash] ?? App);

useEventListener(window, "hashchange", () => {
  currentPage.value = pages[window.location.hash] ?? App;
});

createApp({
  setup() {
    return () =>
      h(Transition, { name: "pg-screen", mode: "out-in" }, () =>
        h(currentPage.value, {
          key: currentPage.value === Cloud ? "cloud" : "oss",
        }),
      );
  },
}).mount("#app");
