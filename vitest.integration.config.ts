import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/integration/**/*.test.ts"],
    maxWorkers: 1,
    outputFile: {
      junit: "test-results/integration.xml",
    },
    reporters: ["default", "junit"],
    setupFiles: ["./tests/integration/setup.ts"],
  },
});
