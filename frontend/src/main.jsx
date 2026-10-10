import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/dm-sans";
import "@fontsource/crimson-text/400.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import { AuthProvider } from "./auth";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
