/// <reference types="vitest" />
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH is set by the GitHub Pages workflow (for example "/prayer-app/").
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Prayer Points",
        short_name: "Prayer",
        description: "Keep track of prayer points. No point is forgotten.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#faf7f2",
        theme_color: "#3b5b7a",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    // Project limit: at most 3 processes.
    poolOptions: { forks: { minForks: 1, maxForks: 3 } },
  },
});
