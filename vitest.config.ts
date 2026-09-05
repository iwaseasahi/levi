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
    coverage: {
      exclude: ["src/agent-orchestration/types.ts"],
      include: [
        "src/agent-orchestration/**/*.ts",
        "src/application/**/*.ts",
        "src/app/api/**/controller.ts",
        "src/app/api/ready/route.ts",
        "src/app/api/church-api-support.ts",
        "src/app/church/audience/audience-fit.ts",
        "src/app/church/client-api.ts",
        "src/app/church/scripture-search-selection.ts",
        "src/app/church/scripture-search-link.ts",
        "src/app/church/scripture-font-scale.ts",
        "src/config/**/*.ts",
        "src/domain/**/*.ts",
        "src/infrastructure/auth/admin-basic-auth.ts",
        "src/infrastructure/auth/options.ts",
        "src/infrastructure/database/reset-guard.ts",
        "src/infrastructure/database/saved-content-ordering.ts",
        "src/infrastructure/database/scripture-row-mapper.ts",
        "src/infrastructure/database/serializable-retry.ts",
        "src/infrastructure/database/test-database-guard.ts",
        "src/infrastructure/observability/**/*.ts",
        "src/migration/ginmaku-bible-exactness.ts",
        "src/migration/ginmaku-bible-mapping.ts",
        "src/migration/rehearsal-database-guard.ts",
        "src/operations/admin-password-hash.ts",
        "src/operations/release-plan.ts",
        "src/proxy.ts",
      ],
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
