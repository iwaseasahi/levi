import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/client";
import {
  dryRunGinmakuBible,
  importGinmakuBible,
  reconcileGinmakuBible,
  validateGinmakuBibleDump,
} from "@/migration/ginmaku-bible-import";

const fixture = resolve("tests/fixtures/ginmaku-bible-import.sql");

async function clearImportFixture() {
  await prisma.bibleVerse.deleteMany({
    where: { book: { canonicalCode: "GEN" } },
  });
  await prisma.bibleBookName.deleteMany({
    where: { book: { canonicalCode: "GEN" } },
  });
  await prisma.bibleBook.deleteMany({ where: { canonicalCode: "GEN" } });
  await prisma.bibleTranslation.updateMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    data: {
      rightsStatus: "PENDING",
      sourceReference: null,
      rightsNotice: null,
    },
  });
}

async function ensureTranslationMetadata() {
  await prisma.bibleTranslation.upsert({
    where: { code: "JSS3" },
    update: {},
    create: {
      code: "JSS3",
      name: "Synthetic Japanese translation",
      languageTag: "ja",
      displayOrder: 1,
      rightsStatus: "PENDING",
    },
  });
  await prisma.bibleTranslation.upsert({
    where: { code: "NKJV" },
    update: {},
    create: {
      code: "NKJV",
      name: "Synthetic English translation",
      languageTag: "en",
      displayOrder: 2,
      rightsStatus: "PENDING",
    },
  });
}

async function approveSyntheticImport() {
  await prisma.bibleTranslation.updateMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    data: {
      rightsStatus: "APPROVED",
      sourceReference: "synthetic integration fixture",
      rightsNotice: "not scripture; test use only",
    },
  });
}

beforeEach(async () => {
  await clearImportFixture();
  await ensureTranslationMetadata();
});
afterEach(clearImportFixture);
afterAll(async () => prisma.$disconnect());

describe("Ginmaku Bible import", () => {
  it("preserves empty, verse-zero, and newline values and is idempotent", async () => {
    await approveSyntheticImport();
    const source = await validateGinmakuBibleDump(fixture);
    expect(source.report.counts).toMatchObject({
      verses: 4,
      emptyText: 1,
      zeroVerse: 2,
    });
    await expect(dryRunGinmakuBible(prisma, source)).resolves.toMatchObject({
      action: "import",
    });

    await expect(
      importGinmakuBible(prisma, source, { batchSize: 2 }),
    ).resolves.toMatchObject({
      status: "imported",
      batches: 2,
    });
    await expect(
      importGinmakuBible(prisma, source, { batchSize: 2 }),
    ).resolves.toMatchObject({
      status: "unchanged",
    });
    await expect(reconcileGinmakuBible(prisma, source)).resolves.toMatchObject({
      exact: true,
    });
    await expect(dryRunGinmakuBible(prisma, source)).resolves.toMatchObject({
      action: "unchanged",
    });
    await expect(
      prisma.bibleVerse.findFirstOrThrow({
        where: { translation: { code: "JSS3" }, verseNumber: 0 },
        select: { text: true },
      }),
    ).resolves.toEqual({ text: "" });
    await expect(
      prisma.bibleVerse.findFirstOrThrow({
        where: { translation: { code: "JSS3" }, verseNumber: 1 },
        select: { text: true },
      }),
    ).resolves.toEqual({ text: "架空の本文\n改行" });
  });

  it("emits anonymous validate CLI evidence", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/import-ginmaku-bible.ts"),
        "validate",
        fixture,
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(output)).toMatchObject({
      mode: "validate",
      source: { counts: { verses: 4, emptyText: 1, zeroVerse: 2 } },
    });
    expect(output).not.toContain("架空の本文");
    expect(output).not.toContain("Synthetic text");
    expect(output).not.toContain("Synthetic Book");
  });

  it("rolls back every catalog write after an injected batch failure", async () => {
    await approveSyntheticImport();
    const source = await validateGinmakuBibleDump(fixture);
    await expect(
      importGinmakuBible(prisma, source, { batchSize: 2, failAfterBatches: 1 }),
    ).rejects.toMatchObject({
      code: "IMPORT_INJECTED_FAILURE",
    });
    await expect(
      prisma.bibleVerse.count({ where: { book: { canonicalCode: "GEN" } } }),
    ).resolves.toBe(0);
    await expect(
      prisma.bibleBook.count({ where: { canonicalCode: "GEN" } }),
    ).resolves.toBe(0);
  });

  it("rejects rights, content mismatch, duplicate, gap, and invalid UTF-8", async () => {
    const source = await validateGinmakuBibleDump(fixture);
    await expect(importGinmakuBible(prisma, source)).rejects.toMatchObject({
      code: "IMPORT_TRANSLATION_RIGHTS_NOT_APPROVED",
    });
    await approveSyntheticImport();
    await importGinmakuBible(prisma, source);
    await prisma.bibleVerse.updateMany({
      where: { translation: { code: "JSS3" }, verseNumber: 1 },
      data: { text: "changed synthetic text" },
    });
    await expect(importGinmakuBible(prisma, source)).rejects.toMatchObject({
      code: "IMPORT_TARGET_CONTENT_MISMATCH",
    });
    await expect(
      validateGinmakuBibleDump(
        resolve("tests/fixtures/ginmaku-bible-synthetic.sql"),
      ),
    ).rejects.toMatchObject({
      code: "DUMP_DUPLICATE_LOCATION",
    });
    await expect(
      validateGinmakuBibleDump(resolve("tests/fixtures/ginmaku-bible-gap.sql")),
    ).rejects.toMatchObject({ code: "DUMP_VERSE_GAP" });

    const directory = await mkdtemp(join(tmpdir(), "levi-invalid-utf8-"));
    const invalid = join(directory, "invalid.sql");
    try {
      await writeFile(invalid, Uint8Array.from([0xff, 0xfe]));
      await expect(validateGinmakuBibleDump(invalid)).rejects.toThrow(
        "DUMP_INVALID_UTF8",
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  });
});
import { execFileSync } from "node:child_process";
