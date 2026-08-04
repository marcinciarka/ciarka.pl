import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Defer JetBrains Mono until the main thread is idle so ~40 KiB of mono faces
// stay off the critical path. System mono stands in until then (font-display:
// swap on the @fontsource faces).
const loadMono = () => {
  void import("./fontsMono");
};
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(loadMono, { timeout: 4000 });
} else {
  window.setTimeout(loadMono, 2000);
}
