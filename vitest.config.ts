import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/engine/**"],
      exclude: ["src/engine/index.ts", "src/engine/types.ts"],
      thresholds: { "src/engine/**": { statements: 95, branches: 85, functions: 95, lines: 95 } },
    },
  },
});
