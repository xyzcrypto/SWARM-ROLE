import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@modules": resolve(__dirname, "src/modules"),   // add
      "@core": resolve(__dirname, "src/core"),      // add
      "@shared": resolve(__dirname, "src/shared"),    // add
      "server-only": resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
