import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export type SqlValue = string | null;
export type BookNameRow = [SqlValue, SqlValue, SqlValue, SqlValue];
export type BookRow = [
  SqlValue,
  SqlValue,
  SqlValue,
  SqlValue,
  SqlValue,
  SqlValue,
];

export const BOOK_NAME_COLUMNS = [
  "id",
  "testament",
  "japanese",
  "english",
] as const;
export const BOOK_COLUMNS = [
  "id",
  "version",
  "book_name_id",
  "chapter",
  "verse",
  "word",
] as const;

export function sha256(value: string | Buffer) {
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
      } else if (character === "'") quoted = false;
      else field += character;
    } else if (character === "'") {
      quoted = true;
      wasQuoted = true;
    } else if (character === "(") row = [];
    else if (character === "," && row) finishField();
    else if (character === ")" && row) {
      finishField();
      rows.push(row);
      row = null;
    } else if (row) field += character;
  }
  if (quoted || row) throw new Error("DUMP_MALFORMED_VALUES");
  return rows;
}

function tableRows(
  sql: string,
  table: string,
  expectedColumns: readonly string[],
) {
  const pattern = new RegExp(
    "INSERT INTO `" +
      table +
      "`(?: \\(([^\\n]+)\\))?\\s+VALUES\\s+([\\s\\S]*?);(?:\\r?\\n|$)",
    "g",
  );
  return [...sql.matchAll(pattern)].flatMap((match) => {
    const columns = [...(match[1] ?? "").matchAll(/`([^`]+)`/g)].map(
      (column) => column[1],
    );
    if (
      columns.length !== expectedColumns.length ||
      columns.some((column, index) => column !== expectedColumns[index])
    )
      throw new Error(`DUMP_${table.toUpperCase()}_COLUMN_ORDER_MISMATCH`);
    return parseTuples(match[2]!);
  });
}

export type GinmakuDump = {
  path: string;
  basename: string;
  bytes: number;
  checksum: string;
  charset: string | null;
  collation: string | null;
  newline: "CRLF" | "LF" | "MIXED" | "NONE";
  bookNames: BookNameRow[];
  books: BookRow[];
};

export async function readGinmakuDump(argument: string): Promise<GinmakuDump> {
  const path = resolve(argument);
  const bytes = await readFile(path);
  let sql: string;
  try {
    sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("DUMP_INVALID_UTF8");
  }
  const bookNames = tableRows(sql, "book_names", BOOK_NAME_COLUMNS);
  const books = tableRows(sql, "books", BOOK_COLUMNS);
  if (bookNames.some((row) => row.length !== BOOK_NAME_COLUMNS.length))
    throw new Error("DUMP_BOOK_NAMES_SCHEMA_MISMATCH");
  if (books.some((row) => row.length !== BOOK_COLUMNS.length))
    throw new Error("DUMP_BOOKS_SCHEMA_MISMATCH");
  const crlf = (sql.match(/\r\n/g) ?? []).length;
  const lf = (sql.match(/(?<!\r)\n/g) ?? []).length;
  return {
    path,
    basename: basename(path),
    bytes: bytes.length,
    checksum: sha256(bytes),
    charset: /DEFAULT CHARSET=([^ ;]+)/.exec(sql)?.[1] ?? null,
    collation: /COLLATE=([^ ;]+)/.exec(sql)?.[1] ?? null,
    newline: crlf && lf ? "MIXED" : crlf ? "CRLF" : lf ? "LF" : "NONE",
    bookNames: bookNames as BookNameRow[],
    books: books as BookRow[],
  };
}

export function nullCounts(rows: SqlValue[][], columns: readonly string[]) {
  return Object.fromEntries(
    columns.map((column, index) => [
      column,
      rows.filter((row) => row[index] === null).length,
    ]),
  );
}
