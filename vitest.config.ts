import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/config/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage/unit",
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
    outputFile: {
      junit: "test-results/unit.xml",
    },
    reporters: ["default", "junit"],
  },
});
