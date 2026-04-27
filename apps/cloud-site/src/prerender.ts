import { features } from "./features";

export const prerenderRoutes: string[] = [
  "/",
  "/features",
  "/compare",
  "/faq",
  ...features.map((f) => `/features/${f.slug}`),
];
