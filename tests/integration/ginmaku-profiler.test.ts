import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Ginmaku dump profiler", () => {
  it("reports only aggregate and fingerprint evidence for a synthetic dump", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/profile-ginmaku-dump.ts"),
        resolve("tests/fixtures/ginmaku-bible-synthetic.sql"),
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(output);

    expect(report.bookNames).toMatchObject({
      rows: 1,
      nulls: { english: 0, japanese: 0 },
      unexpectedTestaments: 0,
      nonPositiveIds: 0,
    });
    expect(report.books).toMatchObject({
      rows: 4,
      versions: { "1": 2, "2": 2 },
      qualityByVersion: {
        "1": { rows: 2, trimmedEmptyText: 1 },
        "2": { rows: 2, trimmedEmptyText: 0 },
      },
      trimmedEmptyText: 1,
      duplicateLocations: 1,
      verseGapCount: 1,
      orphanBookNameReferences: 0,
      unexpectedVersions: 0,
      invalidCoordinates: 0,
      zeroVerseCount: 0,
    });
    expect(output).not.toContain("架空の本文");
    expect(output).not.toContain("Synthetic text");
  });
});
