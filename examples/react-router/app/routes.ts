import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("api/templates", "routes/api.templates.ts"),
  route("api/templates/:id", "routes/api.templates.$id.ts"),
  route("api/saved-blocks", "routes/api.saved-blocks.ts"),
  route("api/saved-blocks/:id", "routes/api.saved-blocks.$id.ts"),
  route("api/render", "routes/api.render.ts"),
  route("api/test-email", "routes/api.test-email.ts"),
] satisfies RouteConfig;
