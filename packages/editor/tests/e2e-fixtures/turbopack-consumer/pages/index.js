import { createElement } from "react";
import dynamic from "next/dynamic";

// Editor needs DOM; disable SSR but still force turbopack to bundle the
// editor module graph during `next build` so any unsupported AMD/UMD form
// in published chunks surfaces as a build-time error.
const EditorMount = dynamic(
  () => import("../components/EditorMount.js"),
  { ssr: false },
);

export default function Home() {
  return createElement(EditorMount);
}
