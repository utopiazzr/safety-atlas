import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "./signals.css";
import "./library.css";
import "./cosmic.css";
import "./theatre.css";
import "./constructivist.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
