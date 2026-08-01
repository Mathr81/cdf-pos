import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// URL de l'API vue par le navigateur. En prod (même origine) : laisser vide.
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3001";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // On ne précache PAS les réponses API : l'offline s'appuie sur IndexedDB
      // (outbox + projection), pas sur le cache HTTP.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
      manifest: {
        name: "CDF Caisse",
        short_name: "CDF",
        description: "Caisse & cuisine — comité des fêtes",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiUrl, changeOrigin: true },
      "/socket.io": { target: apiUrl, ws: true, changeOrigin: true },
    },
  },
});
