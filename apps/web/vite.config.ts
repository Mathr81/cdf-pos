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
        // Les images produit ne sont pas connues au build : elles sont
        // uploadées en cours d'exploitation. Elles sont donc mises en cache à
        // l'exécution, au premier affichage, pour rester disponibles hors ligne.
        //
        // CacheFirst est ici exact et pas seulement pratique : le nom de
        // fichier est le hash du contenu, une clé donnée ne peut donc jamais
        // changer de contenu. Rien à revalider. Changer d'image change l'URL.
        //
        // Si une image n'est pas encore en cache et que le poste est hors
        // ligne, la requête échoue et TicketBlock retombe sur l'icône du
        // produit (voir components/ProductIcon.tsx).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/media/"),
            handler: "CacheFirst",
            options: {
              cacheName: "cdf-media",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "CDF Caisse",
        short_name: "CDF",
        description: "Caisse & cuisine — comité des fêtes",
        theme_color: "#14100f",
        background_color: "#14100f",
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
