import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../prisma/migrations/20260824030000_preserve_omitted_bookmark_end/migration.sql",
  import.meta.url,
);

describe("omitted bookmark ending-verse migration", () => {
  it("makes the ending nullable and backfills only titles without a range", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain('ALTER COLUMN "end_verse" DROP NOT NULL');
    expect(sql).toContain('SET "end_verse" = NULL');
    expect(sql).toContain(`bookmark."title" !~ ' [0-9]+:[0-9]+-[0-9]+$'`);
    expect(sql).toContain('"end_verse" IS NULL');
    expect(sql).toContain('OR "end_verse" >= "start_verse"');
  });
});
