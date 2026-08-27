import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: [
        "lib/extractScores.ts",
        "lib/extractVerdict.ts",
        "lib/historyStorage.ts",
        "lib/agents/**",
        "lib/research/search.ts",
        "lib/research/orchestrator.ts",
        "app/api/start/route.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
