import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../prisma/migrations/20260907010000_drop_migrated_slide_body/migration.sql",
  import.meta.url,
);

describe("migrated Slide body removal", () => {
  it("validates every document before removing the former plain-text copy", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const precondition = sql.indexOf("IF EXISTS");
    const validation = sql.indexOf(
      'VALIDATE CONSTRAINT "slides_text_document_required"',
    );
    const dropBody = sql.indexOf('DROP COLUMN "body"');

    expect(precondition).toBeGreaterThanOrEqual(0);
    expect(sql).toContain("\"content_type\" = 'TEXT'");
    expect(sql).toContain('"text_document" IS NULL');
    expect(sql).toContain(
      "\"text_document\" -> 'version' IS DISTINCT FROM '2'::jsonb",
    );
    expect(sql).toContain("refusing to drop slides.body");
    expect(sql).toContain('AND "text_document" IS NOT NULL');
    expect(sql).toContain(") IS TRUE) NOT VALID");
    expect(sql).toContain(
      'DROP TRIGGER "slides_clear_stale_text_document" ON "slides"',
    );
    expect(sql).toContain('DROP FUNCTION "clear_stale_slide_text_document"()');
    expect(validation).toBeGreaterThan(precondition);
    expect(dropBody).toBeGreaterThan(validation);
  });
});
