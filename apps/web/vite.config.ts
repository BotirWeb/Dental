import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // T5: tish kartasi kutubxonasi (`DentalChartEditor-*.js`, ~2.6 MB)
        // precache'ga KIRMAYDI — aks holda service worker uni har
        // foydalanuvchiga (kassirga ham) o'rnatishda yuklab olardi, workbox
        // esa 2 MiB dan katta faylda build'ni to'xtatadi. U faqat karta
        // sahifasi ochilganda tarmoqdan olinadi (keyin brauzer HTTP keshida);
        // karta baribir serverga bog'liq (saqlash /api orqali), oflayn
        // ishlash talab qilinmaydi. Default ro'yxat (node_modules) saqlanadi.
        globIgnores: ["**/node_modules/**/*", "**/DentalChartEditor-*.js"],
      },
      manifest: {
        name: "Dental — klinika boshqaruvi",
        short_name: "Dental",
        description: "Stomatologiya klinikasi uchun jadval, kassa va hisobot tizimi",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Backend ham /api ostida ishlaydi (apps/api/src/api/app.ts) — shu
      // tufayli brauzer nuqtai nazaridan hammasi bitta origin, cookie/CORS
      // muammosi umuman bo'lmaydi. Prod'da xuddi shu vazifani Caddy bajaradi.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
