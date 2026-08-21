import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fixture = resolve("tests/fixtures/ginmaku-bible-import.sql");

describe("Ginmaku Bible migration rehearsal", () => {
  it("proves rollback, retry, backup restore, and content-free reporting", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/rehearse-ginmaku-bible.ts"),
        fixture,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          REHEARSAL_ADMIN_DATABASE_URL:
            process.env.CI === "true"
              ? process.env.DATABASE_URL
              : "postgresql://levi:levi@127.0.0.1:55432/levi?schema=public",
        },
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    const report = JSON.parse(output);

    expect(report).toMatchObject({
      formatVersion: 1,
      tool: { name: "levi-ginmaku-bible-rehearsal", version: 1 },
      source: {
        formatVersion: 2,
        counts: { books: 1, verses: 4, emptyText: 1, pairedLocations: 2 },
      },
      checks: {
        dryRun: "import",
        injectedFailure: "IMPORT_INJECTED_FAILURE",
        failedTransactionRolledBack: true,
        importStatus: "imported",
        exactAfterImport: true,
        sampleFingerprintsMatchAfterImport: true,
        rerunStatus: "unchanged",
        exactAfterRestore: true,
        sampleFingerprintsMatchAfterRestore: true,
      },
      productionExecuted: false,
    });
    expect(report.counts.after).toEqual(report.counts.restored);
    expect(report.counts.before).toEqual(report.counts.afterFailure);
    expect(output).not.toContain("架空の本文");
    expect(output).not.toContain("Synthetic text");
    expect(output).not.toContain("Synthetic Book");
  }, 30_000);
});
