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
      // Next resolves `server-only` itself at build time; vitest cannot.
      // See test/stubs/server-only.ts for why a no-op is correct here.
      "server-only": resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
