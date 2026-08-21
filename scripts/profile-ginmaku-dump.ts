import {
  BOOK_COLUMNS,
  BOOK_NAME_COLUMNS,
  nullCounts,
  readGinmakuDump,
  sha256,
} from "../src/migration/ginmaku-dump";

const dumpArgument = process.argv[2];
if (!dumpArgument) throw new Error("Usage: profile-ginmaku-dump.ts <dump.sql>");
const dump = await readGinmakuDump(dumpArgument);
const { bookNames, books } = dump;

const locationCounts = new Map<string, number>();
const groupedVerses = new Map<string, number[]>();
const versionCounts = new Map<string, number>();
const bookNameIds = new Set(bookNames.map((row) => row[0]));
const expectedVersions = new Set(["1", "2"]);
for (const row of books) {
  const [id, version, bookNameId, chapter, verse] = row;
  const location = [version, bookNameId, chapter, verse].join(":");
  locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
  versionCounts.set(
    String(version),
    (versionCounts.get(String(version)) ?? 0) + 1,
  );
  const group = [version, bookNameId, chapter].join(":");
  groupedVerses.set(group, [
    ...(groupedVerses.get(group) ?? []),
    Number(verse),
  ]);
  if ([id, version, bookNameId, chapter, verse].some((value) => value === null))
    continue;
}
let verseGapCount = 0;
for (const verses of groupedVerses.values()) {
  const unique = [...new Set(verses)].sort((left, right) => left - right);
  for (let index = 1; index < unique.length; index += 1)
    verseGapCount += Math.max(0, unique[index]! - unique[index - 1]! - 1);
}

const fingerprints = books.length
  ? [books[0]!, books[Math.floor(books.length / 2)]!, books.at(-1)!].map(
      ([, version, bookNameId, chapter, verse, word]) => ({
        location: [version, bookNameId, chapter, verse].join(":"),
        sha256: sha256(
          [version, bookNameId, chapter, verse, word ?? "<NULL>"].join("\0"),
        ),
      }),
    )
  : [];

const report = {
  formatVersion: 1,
  input: {
    basename: dump.basename,
    bytes: dump.bytes,
    sha256: dump.checksum,
  },
  schema: {
    charset: dump.charset,
    collation: dump.collation,
    newline: dump.newline,
    bookNamesColumns: BOOK_NAME_COLUMNS,
    booksColumns: BOOK_COLUMNS,
  },
  bookNames: {
    rows: bookNames.length,
    idRange: {
      min: Math.min(...bookNames.map((row) => Number(row[0]))),
      max: Math.max(...bookNames.map((row) => Number(row[0]))),
    },
    testaments: Object.fromEntries(
      [...new Set(bookNames.map((row) => String(row[1])))].map((testament) => [
        testament,
        bookNames.filter((row) => String(row[1]) === testament).length,
      ]),
    ),
    nulls: nullCounts(bookNames, ["id", "testament", "japanese", "english"]),
    unexpectedTestaments: bookNames.filter(
      (row) => row[1] !== "1" && row[1] !== "2",
    ).length,
    nonPositiveIds: bookNames.filter((row) => Number(row[0]) <= 0).length,
    fingerprints: bookNames.map(([id, testament, japanese, english]) => ({
      id,
      testament,
      japaneseSha256: sha256(japanese ?? "<NULL>"),
      englishSha256: sha256(english ?? "<NULL>"),
    })),
  },
  books: {
    rows: books.length,
    versions: Object.fromEntries([...versionCounts].sort()),
    qualityByVersion: Object.fromEntries(
      [...versionCounts.keys()].sort().map((version) => {
        const versionRows = books.filter((row) => String(row[1]) === version);
        return [
          version,
          {
            rows: versionRows.length,
            nulls: nullCounts(versionRows, [
              "id",
              "version",
              "book_name_id",
              "chapter",
              "verse",
              "word",
            ]),
            trimmedEmptyText: versionRows.filter((row) => row[5]?.trim() === "")
              .length,
          },
        ];
      }),
    ),
    nulls: nullCounts(books, [
      "id",
      "version",
      "book_name_id",
      "chapter",
      "verse",
      "word",
    ]),
    unexpectedVersions: books.filter(
      (row) => !expectedVersions.has(String(row[1])),
    ).length,
    invalidCoordinates: books.filter(
      (row) => Number(row[2]) <= 0 || Number(row[3]) <= 0 || Number(row[4]) < 0,
    ).length,
    zeroVerseCount: books.filter((row) => row[4] === "0").length,
    trimmedEmptyText: books.filter((row) => row[5]?.trim() === "").length,
    emptyTextLocations: books
      .filter((row) => row[5]?.trim() === "")
      .map((row) => ({
        version: row[1],
        bookNameId: row[2],
        chapter: row[3],
        verse: row[4],
      })),
    orphanBookNameReferences: books.filter((row) => !bookNameIds.has(row[2]))
      .length,
    duplicateLocations: [...locationCounts.values()].filter(
      (count) => count > 1,
    ).length,
    verseGapCount,
    sampleFingerprints: fingerprints,
  },
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
