import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";

/*
 * Intent: app entry (2026-10-05, amended 2026-10-06)
 * SW registration is PROD-only: in dev the precached bundle poisons iteration
 * (edited source never reaches the page until the SW is unregistered).
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.warn);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
