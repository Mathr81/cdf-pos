import { defineConfig } from "vitest/config";

// Config séparée de `vite.config.ts` : les tests n'ont pas besoin du plugin
// PWA ni de Tailwind, et les charger ralentirait chaque run pour rien.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
