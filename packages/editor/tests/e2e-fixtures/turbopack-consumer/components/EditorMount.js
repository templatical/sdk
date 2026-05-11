import { createElement, useEffect, useRef } from "react";
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

export default function EditorMount() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const editor = init({ container: ref.current });
    return () => {
      if (editor && typeof editor.unmount === "function") editor.unmount();
    };
  }, []);
  return createElement("div", { ref, style: { height: "100vh" } });
}
