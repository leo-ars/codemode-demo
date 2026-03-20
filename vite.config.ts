import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    cloudflare({
      configPath: "./wrangler.jsonc",
    }),
    react(),
    tailwindcss(),
  ],
  define: {
    __filename: "'index.ts'",
  },
});
