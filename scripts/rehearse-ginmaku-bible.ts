import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  BibleImportError,
  dryRunGinmakuBible,
  importGinmakuBible,
  reconcileGinmakuBible,
  validateGinmakuBibleDump,
  type ValidatedBibleDump,
} from "../src/migration/ginmaku-bible-import";
import { disposableRehearsalDatabaseUrl } from "../src/migration/rehearsal-database-guard";

const REHEARSAL_DATABASE = "levi_bible_migration_rehearsal";
const RESTORE_DATABASE = "levi_bible_restore_rehearsal";
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;

function guardedUrl(database: string) {
  return disposableRehearsalDatabaseUrl(
    process.env.REHEARSAL_ADMIN_DATABASE_URL ??
      "postgresql://levi:levi@127.0.0.1:55432/levi?schema=public",
    database,
  );
}

async function resetDatabase(database: string, create: boolean) {
  const adminUrl = new URL(guardedUrl(database));
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [database],
    );
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
    if (create) await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }
}

function run(
  command: string,
  args: string[],
  options: {
    captureBinary?: boolean;
    env?: NodeJS.ProcessEnv;
    input?: Buffer;
  } = {},
) {
  const capture = Boolean(options.captureBinary || options.input);
  const result = spawnSync(command, args, {
    encoding: capture ? null : "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: MAX_ARCHIVE_BYTES,
    stdio: capture
      ? [options.input ? "pipe" : "ignore", "pipe", "pipe"]
      : ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0)
    throw new BibleImportError("REHEARSAL_SUBPROCESS_FAILED");
  return result.stdout;
}

function migrateAndSeed(databaseUrl: string) {
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  run("pnpm", ["exec", "prisma", "migrate", "deploy"], { env });
  run("pnpm", ["exec", "prisma", "db", "seed"], { env });
}

function postgresContainerArgs(args: string[], input = false) {
  const container = process.env.REHEARSAL_POSTGRES_CONTAINER;
  return container
    ? ["exec", ...(input ? ["-i"] : []), container, ...args]
    : ["compose", "exec", "-T", "postgres", ...args];
}

function databaseClient(databaseUrl: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

async function catalogCounts(client: PrismaClient) {
  const [
    translations,
    books,
    names,
    verses,
    completedMigrations,
    translationCounts,
    pairCounts,
  ] = await client.$transaction([
    client.bibleTranslation.count({
      where: { code: { in: ["JSS3", "NKJV"] } },
    }),
    client.bibleBook.count(),
    client.bibleBookName.count(),
    client.bibleVerse.count(),
    client.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at, migration_name
      `,
    client.$queryRaw<
      Array<{
        chapters: number;
        code: string;
        empty_text: number;
        text_with_newline: number;
        verses: number;
        zero_verse: number;
      }>
    >`
        SELECT
          t.code,
          count(*)::int AS verses,
          count(DISTINCT (v.book_id, v.chapter_number))::int AS chapters,
          count(*) FILTER (WHERE btrim(v.text) = '')::int AS empty_text,
          count(*) FILTER (WHERE v.text ~ E'[\\r\\n]')::int AS text_with_newline,
          count(*) FILTER (WHERE v.verse_number = 0)::int AS zero_verse
        FROM bible_verses v
        JOIN bible_translations t ON t.id = v.translation_id
        WHERE t.code IN ('JSS3', 'NKJV')
        GROUP BY t.code
        ORDER BY t.code
      `,
    client.$queryRaw<Array<{ paired_locations: number }>>`
        SELECT count(*)::int AS paired_locations
        FROM (
          SELECT v.book_id, v.chapter_number, v.verse_number
          FROM bible_verses v
          JOIN bible_translations t ON t.id = v.translation_id
          WHERE t.code IN ('JSS3', 'NKJV')
          GROUP BY v.book_id, v.chapter_number, v.verse_number
          HAVING count(DISTINCT t.code) = 2
        ) pairs
      `,
  ]);
  const byCode = new Map(translationCounts.map((row) => [row.code, row]));
  return {
    translations,
    books,
    names,
    verses,
    byTranslation: Object.fromEntries(
      ["JSS3", "NKJV"].map((code) => {
        const row = byCode.get(code);
        return [
          code,
          {
            chapters: row?.chapters ?? 0,
            emptyText: row?.empty_text ?? 0,
            textWithNewline: row?.text_with_newline ?? 0,
            verses: row?.verses ?? 0,
            zeroVerse: row?.zero_verse ?? 0,
          },
        ];
      }),
    ),
    pairedLocations: pairCounts[0]?.paired_locations ?? 0,
    schemaMigrations: completedMigrations.length,
    latestMigration: completedMigrations.at(-1)?.migration_name ?? null,
  };
}

function elapsed(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

async function restoreArchive(sourceDatabase: string, archive: Buffer) {
  await resetDatabase(RESTORE_DATABASE, true);
  run(
    "docker",
    postgresContainerArgs(
      [
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "-U",
        "levi",
        "-d",
        RESTORE_DATABASE,
      ],
      true,
    ),
    { input: archive },
  );
  return {
    sourceDatabase,
    archiveBytes: archive.byteLength,
    archiveSha256: createHash("sha256").update(archive).digest("hex"),
  };
}

async function dumpDatabase(database: string) {
  const output = run(
    "docker",
    postgresContainerArgs([
      "pg_dump",
      "-U",
      "levi",
      "-d",
      database,
      "--format=custom",
    ]),
    { captureBinary: true },
  );
  if (!Buffer.isBuffer(output))
    throw new BibleImportError("REHEARSAL_BACKUP_FAILED");
  return output;
}

async function rehearse(source: ValidatedBibleDump) {
  const databaseUrl = guardedUrl(REHEARSAL_DATABASE);
  const restoreUrl = guardedUrl(RESTORE_DATABASE);
  await resetDatabase(REHEARSAL_DATABASE, true);
  migrateAndSeed(databaseUrl);
  const client = databaseClient(databaseUrl);
  let clientConnected = true;
  let restoreClient: PrismaClient | undefined;
  try {
    const before = await catalogCounts(client);
    const dryRun = await dryRunGinmakuBible(client, source);

    const failureStarted = performance.now();
    let injectedFailure = "not-observed";
    try {
      await importGinmakuBible(client, source, {
        batchSize: 500,
        failAfterBatches: 1,
      });
    } catch (error) {
      if (
        !(error instanceof BibleImportError) ||
        error.code !== "IMPORT_INJECTED_FAILURE"
      )
        throw error;
      injectedFailure = error.code;
    }
    const afterFailure = await catalogCounts(client);
    const failureMilliseconds = elapsed(failureStarted);
    if (JSON.stringify(afterFailure) !== JSON.stringify(before))
      throw new BibleImportError("REHEARSAL_FAILURE_LEFT_PARTIAL_DATA");

    const importStarted = performance.now();
    const imported = await importGinmakuBible(client, source, {
      batchSize: 500,
    });
    const importMilliseconds = elapsed(importStarted);
    const after = await catalogCounts(client);
    const reconciliation = await reconcileGinmakuBible(client, source);
    if (!reconciliation.exact)
      throw new BibleImportError("REHEARSAL_RECONCILIATION_FAILED");

    const rerunStarted = performance.now();
    const rerun = await importGinmakuBible(client, source, { batchSize: 500 });
    const rerunMilliseconds = elapsed(rerunStarted);
    if (rerun.status !== "unchanged")
      throw new BibleImportError("REHEARSAL_RERUN_CHANGED_TARGET");

    await client.$disconnect();
    clientConnected = false;
    const archive = await dumpDatabase(REHEARSAL_DATABASE);
    const backup = await restoreArchive(REHEARSAL_DATABASE, archive);
    restoreClient = databaseClient(restoreUrl);
    const restored = await catalogCounts(restoreClient);
    const restoredReconciliation = await reconcileGinmakuBible(
      restoreClient,
      source,
    );
    if (!restoredReconciliation.exact)
      throw new BibleImportError("REHEARSAL_RESTORE_RECONCILIATION_FAILED");

    return {
      formatVersion: 1,
      tool: { name: "levi-ginmaku-bible-rehearsal", version: 1 },
      target: {
        kind: "local-compose-disposable",
        database: REHEARSAL_DATABASE,
        restoreDatabase: RESTORE_DATABASE,
      },
      source: source.report,
      counts: { before, afterFailure, after, restored },
      checks: {
        dryRun: dryRun.action,
        injectedFailure,
        failedTransactionRolledBack: true,
        importStatus: imported.status,
        exactAfterImport: reconciliation.exact,
        sampleFingerprintsMatchAfterImport: reconciliation.sampleExact,
        rerunStatus: rerun.status,
        exactAfterRestore: restoredReconciliation.exact,
        sampleFingerprintsMatchAfterRestore: restoredReconciliation.sampleExact,
      },
      timingsMilliseconds: {
        injectedFailure: failureMilliseconds,
        import: importMilliseconds,
        rerun: rerunMilliseconds,
      },
      backup,
      productionExecuted: false,
    };
  } finally {
    await restoreClient?.$disconnect();
    if (clientConnected) await client.$disconnect().catch(() => undefined);
    await resetDatabase(RESTORE_DATABASE, false).catch(() => undefined);
    await resetDatabase(REHEARSAL_DATABASE, false).catch(() => undefined);
  }
}

const [path, ...options] = process.argv.slice(2);

try {
  if (!path || options.length) throw new BibleImportError("REHEARSAL_USAGE");
  const source = await validateGinmakuBibleDump(resolve(path));
  const report = await rehearse(source);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const code =
    error instanceof BibleImportError
      ? error.code
      : "REHEARSAL_UNEXPECTED_FAILURE";
  process.stderr.write(`${JSON.stringify({ error: code })}\n`);
  process.exitCode = 1;
}
