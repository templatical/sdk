import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import { routes } from "./router";
import "./styles/main.css";

export const createApp = ViteSSG(
  App,
  {
    routes,
    base: "/",
  },
  ({ router }) => {
    router.options.scrollBehavior = (to, _from, savedPosition) => {
      if (savedPosition) return savedPosition;
      if (to.hash) {
        return { el: to.hash, behavior: "smooth" };
      }
      return { top: 0 };
    };
  },
);
