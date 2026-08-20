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
    environment: "jsdom",
    include: ["src/**/*.component.test.tsx"],
    outputFile: {
      junit: "test-results/component.xml",
    },
    reporters: ["default", "junit"],
    setupFiles: ["./tests/component/setup.ts"],
  },
});
