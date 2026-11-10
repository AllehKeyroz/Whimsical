import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useStore } from "./store";
import "./styles.css";

if (import.meta.env.DEV) {
  (window as unknown as { __whim: typeof useStore }).__whim = useStore;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
