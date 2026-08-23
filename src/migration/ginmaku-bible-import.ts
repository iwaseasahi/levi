import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  GINMAKU_BOOK_MAPPING,
  GINMAKU_TRANSLATION_MAPPING,
} from "./ginmaku-bible-mapping";
import {
  BOOK_COLUMNS,
  BOOK_NAME_COLUMNS,
  type GinmakuDump,
  nullCounts,
  readGinmakuDump,
  sha256,
} from "./ginmaku-dump";
import { evaluateBibleExactness } from "./ginmaku-bible-exactness";

type TranslationCode =
  (typeof GINMAKU_TRANSLATION_MAPPING)[keyof typeof GINMAKU_TRANSLATION_MAPPING];
type DbClient = PrismaClient | Prisma.TransactionClient;

type SourceName = {
  legacyBookId: number;
  testament: "OLD" | "NEW";
  japanese: string;
  english: string;
};

type SourceVerse = {
  translationCode: TranslationCode;
  canonicalCode: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
};

export type ValidatedBibleDump = {
  dump: GinmakuDump;
  names: SourceName[];
  verses: SourceVerse[];
  report: SourceReport;
};

export type SourceReport = {
  formatVersion: 2;
  input: { basename: string; bytes: number; sha256: string };
  schema: { charset: string | null; collation: string | null; newline: string };
  counts: {
    books: number;
    bookNames: number;
    chapters: number;
    verses: number;
    byTranslation: Record<string, number>;
    chaptersByTranslation: Record<string, number>;
    emptyText: number;
    emptyTextByTranslation: Record<string, number>;
    textWithNewline: number;
    zeroVerse: number;
    zeroVerseByTranslation: Record<string, number>;
    pairedLocations: number;
    unpairedLocationsByTranslation: Record<string, number>;
  };
  validation: {
    duplicateLocations: 0;
    invalidKeys: 0;
    nullValues: 0;
    verseGaps: 0;
  };
  integrity: {
    bookFingerprint: string;
    nameFingerprint: string;
    locationFingerprint: string;
    contentFingerprint: string;
    sampleFingerprint: string;
  };
};

export class BibleImportError extends Error {
  constructor(
    public readonly code: string,
    public readonly count?: number,
  ) {
    super(count === undefined ? code : `${code}:${count}`);
    this.name = "BibleImportError";
  }
}

function integer(value: string | null, code: string) {
  if (value === null || !/^-?\d+$/.test(value))
    throw new BibleImportError(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new BibleImportError(code);
  return parsed;
}

function fingerprint(records: string[]) {
  return sha256(records.sort().join("\n"));
}

function sampleFingerprint(records: string[]) {
  const sorted = [...records].sort();
  const indexes = new Set([
    0,
    Math.floor((sorted.length - 1) / 2),
    sorted.length - 1,
  ]);
  return fingerprint(
    [...indexes]
      .filter((index) => index >= 0 && index < sorted.length)
      .map((index) => sorted[index]!),
  );
}

export async function validateGinmakuBibleDump(path: string) {
  let dump: GinmakuDump;
  try {
    dump = await readGinmakuDump(path);
  } catch (error) {
    const code = error instanceof Error ? error.message : "DUMP_READ_FAILED";
    throw new BibleImportError(
      code.startsWith("DUMP_") ? code : "DUMP_READ_FAILED",
    );
  }
  if (dump.charset !== "utf8" || dump.collation !== "utf8_unicode_ci")
    throw new BibleImportError("DUMP_ENCODING_DECLARATION_MISMATCH");
  if (dump.bookNames.length === 0 || dump.books.length === 0)
    throw new BibleImportError("DUMP_REQUIRED_ROWS_MISSING");
  const bookNulls = Object.values(
    nullCounts(dump.bookNames, BOOK_NAME_COLUMNS),
  ).reduce((sum, value) => sum + value, 0);
  const verseNulls = Object.values(nullCounts(dump.books, BOOK_COLUMNS)).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (bookNulls + verseNulls > 0)
    throw new BibleImportError("DUMP_NULL_VALUE", bookNulls + verseNulls);

  const mappingById = new Map(
    GINMAKU_BOOK_MAPPING.map((mapping) => [mapping.legacyBookNameId, mapping]),
  );
  const names = dump.bookNames.map(([id, testament, japanese, english]) => {
    const legacyBookId = integer(id, "DUMP_INVALID_BOOK_ID");
    const mapping = mappingById.get(legacyBookId);
    if (!mapping) throw new BibleImportError("DUMP_UNKNOWN_BOOK_ID");
    const expectedTestament = mapping.testament === "OLD" ? 1 : 2;
    if (integer(testament, "DUMP_INVALID_TESTAMENT") !== expectedTestament)
      throw new BibleImportError("DUMP_TESTAMENT_MISMATCH");
    if (!japanese || !english || japanese.length > 100 || english.length > 100)
      throw new BibleImportError("DUMP_INVALID_BOOK_NAME");
    return { legacyBookId, testament: mapping.testament, japanese, english };
  });
  if (
    new Set(names.map(({ legacyBookId }) => legacyBookId)).size !== names.length
  )
    throw new BibleImportError("DUMP_DUPLICATE_BOOK_ID");
  if (
    new Set(names.map(({ japanese }) => japanese)).size !== names.length ||
    new Set(names.map(({ english }) => english)).size !== names.length
  )
    throw new BibleImportError("DUMP_DUPLICATE_BOOK_NAME");
  const knownBookIds = new Set(names.map(({ legacyBookId }) => legacyBookId));

  const locations = new Set<string>();
  const legacyRowIds = new Set<number>();
  const chapters = new Map<string, number[]>();
  const verses = dump.books.map(
    ([idValue, versionValue, bookValue, chapterValue, verseValue, text]) => {
      const legacyRowId = integer(idValue, "DUMP_INVALID_ROW_ID");
      if (legacyRowId <= 0) throw new BibleImportError("DUMP_INVALID_ROW_ID");
      if (legacyRowIds.has(legacyRowId))
        throw new BibleImportError("DUMP_DUPLICATE_ROW_ID");
      legacyRowIds.add(legacyRowId);
      const version = integer(versionValue, "DUMP_INVALID_VERSION");
      const translationCode =
        GINMAKU_TRANSLATION_MAPPING[
          version as keyof typeof GINMAKU_TRANSLATION_MAPPING
        ];
      if (!translationCode) throw new BibleImportError("DUMP_UNKNOWN_VERSION");
      const legacyBookId = integer(bookValue, "DUMP_INVALID_BOOK_REFERENCE");
      const mapping = mappingById.get(legacyBookId);
      if (!mapping || !knownBookIds.has(legacyBookId))
        throw new BibleImportError("DUMP_UNKNOWN_BOOK_REFERENCE");
      const chapterNumber = integer(chapterValue, "DUMP_INVALID_CHAPTER");
      const verseNumber = integer(verseValue, "DUMP_INVALID_VERSE");
      if (chapterNumber <= 0 || verseNumber < 0)
        throw new BibleImportError("DUMP_INVALID_LOCATION");
      const location = `${translationCode}:${mapping.canonicalCode}:${chapterNumber}:${verseNumber}`;
      if (locations.has(location))
        throw new BibleImportError("DUMP_DUPLICATE_LOCATION");
      locations.add(location);
      const chapter = `${translationCode}:${mapping.canonicalCode}:${chapterNumber}`;
      chapters.set(chapter, [...(chapters.get(chapter) ?? []), verseNumber]);
      return {
        translationCode,
        canonicalCode: mapping.canonicalCode,
        chapterNumber,
        verseNumber,
        text: text!,
      };
    },
  );
  let gaps = 0;
  for (const values of chapters.values()) {
    const sorted = [...values].sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index += 1)
      gaps += Math.max(0, sorted[index]! - sorted[index - 1]! - 1);
  }
  if (gaps) throw new BibleImportError("DUMP_VERSE_GAP", gaps);

  const byTranslation = Object.fromEntries(
    Object.values(GINMAKU_TRANSLATION_MAPPING).map((code) => [
      code,
      verses.filter(({ translationCode }) => translationCode === code).length,
    ]),
  );
  const chapterSets = Object.fromEntries(
    Object.values(GINMAKU_TRANSLATION_MAPPING).map((code) => [
      code,
      new Set(
        verses
          .filter(({ translationCode }) => translationCode === code)
          .map(({ canonicalCode, chapterNumber }) =>
            [canonicalCode, chapterNumber].join("\0"),
          ),
      ),
    ]),
  );
  const locationSets = Object.fromEntries(
    Object.values(GINMAKU_TRANSLATION_MAPPING).map((code) => [
      code,
      new Set(
        verses
          .filter(({ translationCode }) => translationCode === code)
          .map(({ canonicalCode, chapterNumber, verseNumber }) =>
            [canonicalCode, chapterNumber, verseNumber].join("\0"),
          ),
      ),
    ]),
  );
  const translationCodes = Object.values(GINMAKU_TRANSLATION_MAPPING);
  const firstLocations = locationSets[translationCodes[0]!]!;
  const secondLocations = locationSets[translationCodes[1]!]!;
  const pairedLocations = [...firstLocations].filter((location) =>
    secondLocations.has(location),
  ).length;
  const locationRecords = verses.map(
    ({ translationCode, canonicalCode, chapterNumber, verseNumber }) =>
      [translationCode, canonicalCode, chapterNumber, verseNumber].join("\0"),
  );
  const contentRecords = verses.map(
    ({ translationCode, canonicalCode, chapterNumber, verseNumber, text }) =>
      [translationCode, canonicalCode, chapterNumber, verseNumber, text].join(
        "\0",
      ),
  );
  return {
    dump,
    names,
    verses,
    report: {
      formatVersion: 2,
      input: {
        basename: dump.basename,
        bytes: dump.bytes,
        sha256: dump.checksum,
      },
      schema: {
        charset: dump.charset,
        collation: dump.collation,
        newline: dump.newline,
      },
      counts: {
        books: names.length,
        bookNames: names.length,
        chapters: Object.values(chapterSets).reduce(
          (sum, values) => sum + values.size,
          0,
        ),
        verses: verses.length,
        byTranslation,
        chaptersByTranslation: Object.fromEntries(
          Object.entries(chapterSets).map(([code, values]) => [
            code,
            values.size,
          ]),
        ),
        emptyText: verses.filter(({ text }) => text.trim() === "").length,
        emptyTextByTranslation: Object.fromEntries(
          translationCodes.map((code) => [
            code,
            verses.filter(
              ({ text, translationCode }) =>
                translationCode === code && text.trim() === "",
            ).length,
          ]),
        ),
        textWithNewline: verses.filter(({ text }) => /[\r\n]/.test(text))
          .length,
        zeroVerse: verses.filter(({ verseNumber }) => verseNumber === 0).length,
        zeroVerseByTranslation: Object.fromEntries(
          translationCodes.map((code) => [
            code,
            verses.filter(
              ({ translationCode, verseNumber }) =>
                translationCode === code && verseNumber === 0,
            ).length,
          ]),
        ),
        pairedLocations,
        unpairedLocationsByTranslation: {
          [translationCodes[0]!]: firstLocations.size - pairedLocations,
          [translationCodes[1]!]: secondLocations.size - pairedLocations,
        },
      },
      validation: {
        duplicateLocations: 0,
        invalidKeys: 0,
        nullValues: 0,
        verseGaps: 0,
      },
      integrity: {
        bookFingerprint: fingerprint(
          names.map(({ legacyBookId }) => {
            const mapping = mappingByLegacyId(legacyBookId);
            return [
              mapping.canonicalCode,
              mapping.canonicalOrder,
              mapping.testament,
            ].join("\0");
          }),
        ),
        nameFingerprint: fingerprint(
          names.flatMap(({ legacyBookId, japanese, english }) => {
            const { canonicalCode } = mappingByLegacyId(legacyBookId);
            return [
              ["JSS3", canonicalCode, japanese].join("\0"),
              ["NKJV", canonicalCode, english].join("\0"),
            ];
          }),
        ),
        locationFingerprint: fingerprint(locationRecords),
        contentFingerprint: fingerprint(contentRecords),
        sampleFingerprint: sampleFingerprint(contentRecords),
      },
    },
  } satisfies ValidatedBibleDump;
}

async function targetState(client: DbClient, source: ValidatedBibleDump) {
  const codes = Object.values(GINMAKU_TRANSLATION_MAPPING);
  const translations = await client.bibleTranslation.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const books = await client.bibleBook.findMany({
    where: {
      canonicalCode: {
        in: [...new Set(source.verses.map((row) => row.canonicalCode))],
      },
    },
    select: {
      id: true,
      canonicalCode: true,
      canonicalOrder: true,
      testament: true,
    },
  });
  const verses = await client.bibleVerse.findMany({
    where: { translation: { code: { in: codes } } },
    select: {
      chapterNumber: true,
      verseNumber: true,
      text: true,
      translation: { select: { code: true } },
      book: { select: { canonicalCode: true } },
    },
  });
  const names = await client.bibleBookName.findMany({
    where: { translation: { code: { in: codes } } },
    select: {
      name: true,
      translation: { select: { code: true } },
      book: { select: { canonicalCode: true } },
    },
  });
  const locationRecords = verses.map(
    ({ translation, book, chapterNumber, verseNumber }) =>
      [translation.code, book.canonicalCode, chapterNumber, verseNumber].join(
        "\0",
      ),
  );
  const contentRecords = verses.map(
    ({ translation, book, chapterNumber, verseNumber, text }) =>
      [
        translation.code,
        book.canonicalCode,
        chapterNumber,
        verseNumber,
        text,
      ].join("\0"),
  );
  return {
    translations,
    books,
    names: names.length,
    verses: verses.length,
    bookFingerprint: fingerprint(
      books.map(({ canonicalCode, canonicalOrder, testament }) =>
        [canonicalCode, canonicalOrder, testament].join("\0"),
      ),
    ),
    nameFingerprint: fingerprint(
      names.map(({ translation, book, name }) =>
        [translation.code, book.canonicalCode, name].join("\0"),
      ),
    ),
    locationFingerprint: fingerprint(locationRecords),
    contentFingerprint: fingerprint(contentRecords),
    sampleFingerprint: sampleFingerprint(contentRecords),
  };
}

function compareTargetWithSource(
  source: ValidatedBibleDump,
  target: Awaited<ReturnType<typeof targetState>>,
) {
  return evaluateBibleExactness(source.report, {
    books: target.books.length,
    names: target.names,
    verses: target.verses,
    bookFingerprint: target.bookFingerprint,
    nameFingerprint: target.nameFingerprint,
    locationFingerprint: target.locationFingerprint,
    contentFingerprint: target.contentFingerprint,
    sampleFingerprint: target.sampleFingerprint,
  });
}

export async function reconcileGinmakuBible(
  client: DbClient,
  source: ValidatedBibleDump,
) {
  const target = await targetState(client, source);
  const exactness = compareTargetWithSource(source, target);
  return {
    source: source.report,
    target: {
      translations: target.translations.length,
      books: target.books.length,
      names: target.names,
      verses: target.verses,
      bookFingerprint: target.bookFingerprint,
      nameFingerprint: target.nameFingerprint,
      locationFingerprint: target.locationFingerprint,
      contentFingerprint: target.contentFingerprint,
      sampleFingerprint: target.sampleFingerprint,
    },
    exact: exactness.exact,
    sampleExact: exactness.sampleExact,
  };
}

export async function dryRunGinmakuBible(
  client: DbClient,
  source: ValidatedBibleDump,
) {
  const target = await targetState(client, source);
  if (target.translations.length !== 2)
    throw new BibleImportError("IMPORT_TRANSLATION_METADATA_MISSING");
  if (target.verses > 0) {
    if (!compareTargetWithSource(source, target).exact)
      throw new BibleImportError("IMPORT_TARGET_CONTENT_MISMATCH");
    return { action: "unchanged" as const, source: source.report };
  }
  const expectedMappings = GINMAKU_BOOK_MAPPING.filter(({ legacyBookNameId }) =>
    source.names.some((name) => name.legacyBookId === legacyBookNameId),
  );
  for (const book of target.books) {
    const expected = expectedMappings.find(
      ({ canonicalCode }) => canonicalCode === book.canonicalCode,
    );
    if (
      !expected ||
      expected.canonicalOrder !== book.canonicalOrder ||
      expected.testament !== book.testament
    )
      throw new BibleImportError("IMPORT_BOOK_METADATA_MISMATCH");
  }
  if (
    target.names > 0 &&
    (target.names !== source.report.counts.bookNames * 2 ||
      target.nameFingerprint !== source.report.integrity.nameFingerprint)
  )
    throw new BibleImportError("IMPORT_BOOK_NAMES_MISMATCH");
  return { action: "import" as const, source: source.report };
}

export async function importGinmakuBible(
  client: PrismaClient,
  source: ValidatedBibleDump,
  options: { batchSize?: number; failAfterBatches?: number } = {},
) {
  const batchSize = options.batchSize ?? 500;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000)
    throw new BibleImportError("IMPORT_INVALID_BATCH_SIZE");
  return client.$transaction(
    async (transaction) => {
      const before = await targetState(transaction, source);
      const translationByCode = new Map(
        before.translations.map((row) => [row.code, row]),
      );
      if (translationByCode.size !== 2)
        throw new BibleImportError("IMPORT_TRANSLATION_METADATA_MISSING");
      if (before.verses > 0) {
        if (!compareTargetWithSource(source, before).exact)
          throw new BibleImportError("IMPORT_TARGET_CONTENT_MISMATCH");
        return {
          status: "unchanged" as const,
          report: await reconcileGinmakuBible(transaction, source),
        };
      }

      const existingBookByCode = new Map(
        before.books.map((row) => [row.canonicalCode, row]),
      );
      for (const mapping of GINMAKU_BOOK_MAPPING.filter(
        ({ legacyBookNameId }) =>
          source.names.some((name) => name.legacyBookId === legacyBookNameId),
      )) {
        const existing = existingBookByCode.get(mapping.canonicalCode);
        if (
          existing &&
          (existing.canonicalOrder !== mapping.canonicalOrder ||
            existing.testament !== mapping.testament)
        )
          throw new BibleImportError("IMPORT_BOOK_METADATA_MISMATCH");
        if (!existing)
          await transaction.bibleBook.create({
            data: {
              canonicalCode: mapping.canonicalCode,
              canonicalOrder: mapping.canonicalOrder,
              testament: mapping.testament,
            },
          });
      }
      const books = await transaction.bibleBook.findMany({
        where: {
          canonicalCode: {
            in: source.names.map(
              ({ legacyBookId }) =>
                mappingByLegacyId(legacyBookId).canonicalCode,
            ),
          },
        },
        select: { id: true, canonicalCode: true },
      });
      const bookByCode = new Map(
        books.map((row) => [row.canonicalCode, row.id]),
      );
      const expectedNames = source.names.flatMap((name) => {
        const mapping = mappingByLegacyId(name.legacyBookId);
        const bookId = bookByCode.get(mapping.canonicalCode)!;
        return [
          {
            translationId: translationByCode.get("JSS3")!.id,
            bookId,
            name: name.japanese,
          },
          {
            translationId: translationByCode.get("NKJV")!.id,
            bookId,
            name: name.english,
          },
        ];
      });
      const existingNames = await transaction.bibleBookName.findMany({
        where: {
          translationId: {
            in: [...translationByCode.values()].map(({ id }) => id),
          },
        },
        select: { translationId: true, bookId: true, name: true },
      });
      if (existingNames.length) {
        const expected = fingerprint(
          expectedNames.map((row) =>
            [row.translationId, row.bookId, row.name].join("\0"),
          ),
        );
        const actual = fingerprint(
          existingNames.map((row) =>
            [row.translationId, row.bookId, row.name].join("\0"),
          ),
        );
        if (expected !== actual)
          throw new BibleImportError("IMPORT_BOOK_NAMES_MISMATCH");
      } else
        await transaction.bibleBookName.createMany({ data: expectedNames });

      let batches = 0;
      for (let offset = 0; offset < source.verses.length; offset += batchSize) {
        const batch = source.verses
          .slice(offset, offset + batchSize)
          .map((row) => ({
            translationId: translationByCode.get(row.translationCode)!.id,
            bookId: bookByCode.get(row.canonicalCode)!,
            chapterNumber: row.chapterNumber,
            verseNumber: row.verseNumber,
            text: row.text,
          }));
        await transaction.bibleVerse.createMany({ data: batch });
        batches += 1;
        if (options.failAfterBatches === batches)
          throw new BibleImportError("IMPORT_INJECTED_FAILURE");
      }
      const report = await reconcileGinmakuBible(transaction, source);
      if (!report.exact)
        throw new BibleImportError("IMPORT_RECONCILIATION_FAILED");
      return { status: "imported" as const, batches, report };
    },
    { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 },
  );
}

function mappingByLegacyId(legacyBookId: number) {
  const mapping = GINMAKU_BOOK_MAPPING.find(
    (row) => row.legacyBookNameId === legacyBookId,
  );
  if (!mapping) throw new BibleImportError("DUMP_UNKNOWN_BOOK_ID");
  return mapping;
}
