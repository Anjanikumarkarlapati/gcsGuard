import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // strictPort: fail instead of silently moving to another port the API does not allow.
  server: { port: 5364, strictPort: true },
});
