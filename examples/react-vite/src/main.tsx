import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EmailEditor } from "./email-editor";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EmailEditor />
  </StrictMode>,
);
