import {
  ControlsHeight,
  ControlsHeightContext,
} from "@jetbrains/ring-ui-built/components/global/controls-height";
import "@jetbrains/ring-ui-built/components/style.css";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ControlsHeightContext.Provider value={ControlsHeight.S}>
      <App />
    </ControlsHeightContext.Provider>
  </React.StrictMode>,
);
