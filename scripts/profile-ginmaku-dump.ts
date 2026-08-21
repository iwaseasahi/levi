import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type SqlValue = string | null;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function parseTuples(source: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  let row: SqlValue[] | null = null;
  let field = "";
  let quoted = false;
  let wasQuoted = false;
  const finishField = () => {
    const value = wasQuoted ? field : field.trim();
    row?.push(!wasQuoted && value.toUpperCase() === "NULL" ? null : value);
    field = "";
    wasQuoted = false;
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === "\\") {
        const escaped = source[(index += 1)] ?? "";
        field +=
          ({ n: "\n", r: "\r", t: "\t", 0: "\0" } as Record<string, string>)[
            escaped
          ] ?? escaped;
      } else if (character === "'") {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === "'") {
      quoted = true;
      wasQuoted = true;
    } else if (character === "(") {
      row = [];
    } else if (character === "," && row) {
      finishField();
    } else if (character === ")" && row) {
      finishField();
      rows.push(row);
      row = null;
    } else if (row) {
      field += character;
    }
  }
  if (quoted || row) throw new Error("Malformed or truncated SQL VALUES list");
  return rows;
}

function tableRows(sql: string, table: string) {
  const pattern = new RegExp(
    "INSERT INTO `" +
      table +
      "`(?: \\([^\\n]+\\))?\\s+VALUES\\s+([\\s\\S]*?);(?:\\r?\\n|$)",
    "g",
  );
  return [...sql.matchAll(pattern)].flatMap((match) => parseTuples(match[1]!));
}

function nullCounts(rows: SqlValue[][], columns: string[]) {
  return Object.fromEntries(
    columns.map((column, index) => [
      column,
      rows.filter((row) => row[index] === null).length,
    ]),
  );
}

const dumpArgument = process.argv[2];
if (!dumpArgument) throw new Error("Usage: profile-ginmaku-dump.ts <dump.sql>");
const dumpPath = resolve(dumpArgument);
const bytes = await readFile(dumpPath);
const sql = bytes.toString("utf8");
const bookNames = tableRows(sql, "book_names");
const books = tableRows(sql, "books");
if (bookNames.some((row) => row.length !== 4))
  throw new Error("Unexpected book_names column count");
if (books.some((row) => row.length !== 6))
  throw new Error("Unexpected books column count");

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
    basename: basename(dumpPath),
    bytes: bytes.length,
    sha256: sha256(bytes),
  },
  schema: {
    charset: /DEFAULT CHARSET=([^ ;]+)/.exec(sql)?.[1] ?? null,
    collation: /COLLATE=([^ ;]+)/.exec(sql)?.[1] ?? null,
    bookNamesColumns: ["id", "testament", "japanese", "english"],
    booksColumns: ["id", "version", "book_name_id", "chapter", "verse", "word"],
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
