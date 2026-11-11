import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useStore } from "./store";
import "./styles.css";

if (import.meta.env.DEV) {
  (window as unknown as { __whim: typeof useStore }).__whim = useStore;
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline cache is optional */
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
