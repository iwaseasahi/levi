import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Client } = pg;
const baseUrl = process.env.LEVI_POC_BASE_URL ?? "http://app:3000";
const trustedOrigin =
  process.env.LEVI_POC_TRUSTED_ORIGIN ?? "https://levi-system.com";
const rounds = Number.parseInt(process.env.LEVI_POC_ROUNDS ?? "20", 10);

if (!Number.isInteger(rounds) || rounds < 1 || rounds > 200)
  throw new Error("LEVI_POC_ROUNDS must be an integer from 1 to 200");

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete("schema");
const client = new Client({ connectionString: databaseUrl.toString() });
const password = `poc-${randomUUID()}-A1!`;
const passwordHash = await hashPassword(password);
const timings = [];
let errors = 0;

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  ];
}

async function measuredFetch(path, init = {}, cookie) {
  const started = performance.now();
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      Origin: trustedOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  timings.push(performance.now() - started);
  if (!response.ok) {
    errors += 1;
    const body = await response.text();
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${response.status} ${body.slice(0, 120)}`,
    );
  }
  return response;
}

async function signIn(email) {
  const response = await measuredFetch("/api/auth/sign-in/email", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
  const session = response.headers
    .getSetCookie()
    .find((value) => value.includes("session_token="));
  if (!session)
    throw new Error("Sign-in response did not set a session cookie");
  return session.split(";", 1)[0];
}

async function jsonRequest(path, init, cookie) {
  return (await measuredFetch(path, init, cookie)).json();
}

async function seed() {
  const japaneseId = randomUUID();
  const englishId = randomUUID();
  const bookId = randomUUID();
  const accounts = [0, 1].map((index) => ({
    churchId: randomUUID(),
    email: `poc-church-${index + 1}-${randomUUID()}@example.invalid`,
    userId: randomUUID(),
  }));

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO bible_translations
        (id, code, name, language_tag, display_order, source_reference, rights_notice)
       VALUES ($1, 'JSS3', 'Synthetic Japanese', 'ja', 1, 'PoC', 'Synthetic only'),
              ($2, 'NKJV', 'Synthetic English', 'en', 2, 'PoC', 'Synthetic only')`,
      [japaneseId, englishId],
    );
    await client.query(
      `INSERT INTO bible_books (id, canonical_code, canonical_order, testament)
       VALUES ($1, 'GEN', 1, 'OLD')`,
      [bookId],
    );
    await client.query(
      `INSERT INTO bible_book_names (translation_id, book_id, name, short_name)
       VALUES ($1, $3, 'Synthetic Japanese Book', 'GEN'),
              ($2, $3, 'Synthetic English Book', 'GEN')`,
      [japaneseId, englishId, bookId],
    );
    for (let verse = 1; verse <= 3; verse += 1) {
      await client.query(
        `INSERT INTO bible_verses
          (translation_id, book_id, chapter_number, verse_number, text)
         VALUES ($1, $3, 1, $4, $5), ($2, $3, 1, $4, $6)`,
        [
          japaneseId,
          englishId,
          bookId,
          verse,
          `Synthetic Japanese verse ${verse}`,
          `Synthetic English verse ${verse}`,
        ],
      );
    }
    for (const [index, account] of accounts.entries()) {
      await client.query("INSERT INTO churches (id, name) VALUES ($1, $2)", [
        account.churchId,
        `Synthetic PoC Church ${index + 1}`,
      ]);
      await client.query(
        `INSERT INTO users
          (id, name, email, email_verified, actor_state, must_change_password)
         VALUES ($1, $2, $3, true, 'ACTIVE', false)`,
        [account.userId, `Synthetic PoC User ${index + 1}`, account.email],
      );
      await client.query(
        "INSERT INTO church_memberships (church_id, user_id) VALUES ($1, $2)",
        [account.churchId, account.userId],
      );
      await client.query(
        `INSERT INTO accounts
          (user_id, account_id, provider_id, issuer, password)
         VALUES ($1::uuid, $1::text, 'credential', 'local:credential', $2)`,
        [account.userId, passwordHash],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return accounts;
}

async function createSavedContent(cookie, index) {
  const { folder } = await jsonRequest(
    "/api/saved-content",
    {
      body: JSON.stringify({
        action: "create-folder",
        name: `Synthetic Folder ${index + 1}`,
      }),
      method: "POST",
    },
    cookie,
  );
  await jsonRequest(
    "/api/saved-content",
    {
      body: JSON.stringify({
        action: "create-bookmark",
        book: "GEN",
        chapter: 1,
        endVerse: null,
        folderId: folder.id,
        language: "both",
        startVerse: 1,
        title: "Synthetic GEN 1:1",
      }),
      method: "POST",
    },
    cookie,
  );
  return folder.id;
}

async function verifyTenantIsolation(cookies, folderIds) {
  const request = (folderId) =>
    fetch(new URL(`/api/saved-content?folderId=${folderId}`, baseUrl), {
      headers: { Cookie: cookies[1], Origin: trustedOrigin },
    });
  const [foreign, guessed] = await Promise.all([
    request(folderIds[0]),
    request(randomUUID()),
  ]);
  if (foreign.status !== 404 || guessed.status !== 404)
    throw new Error(
      "Tenant isolation did not return indistinguishable 404 responses",
    );
}

async function runLoad(cookie) {
  const paths = [
    "/api/scripture/catalog?language=both",
    "/api/scripture/search?book=GEN&chapter=1&startVerse=1&endVerse=3&language=both",
    "/scripture/audience?book=GEN&chapter=1&endVerse=3&language=both&startVerse=1",
    "/api/saved-content",
  ];
  for (let round = 0; round < rounds; round += 1)
    await Promise.all(paths.map((path) => measuredFetch(path, {}, cookie)));
}

try {
  await client.connect();
  const accounts = await seed();
  const cookies = await Promise.all(accounts.map(({ email }) => signIn(email)));
  const folderIds = await Promise.all(
    cookies.map((cookie, index) => createSavedContent(cookie, index)),
  );
  await verifyTenantIsolation(cookies, folderIds);
  await Promise.all(cookies.map(runLoad));
  const connections = await client.query(
    `SELECT count(*)::integer AS count FROM pg_stat_activity
      WHERE datname = current_database()`,
  );
  const churchCount = await client.query(
    "SELECT count(*)::integer AS count FROM churches",
  );
  const folderCount = await client.query(
    "SELECT count(*)::integer AS count FROM folders",
  );
  console.log(
    JSON.stringify({
      accounts: accounts.length,
      churches: churchCount.rows[0].count,
      databaseConnections: connections.rows[0].count,
      errors,
      folders: folderCount.rows[0].count,
      latencyMs: {
        max: Number(Math.max(...timings).toFixed(1)),
        p50: Number(percentile(timings, 0.5).toFixed(1)),
        p95: Number(percentile(timings, 0.95).toFixed(1)),
      },
      requests: timings.length,
      rounds,
      tenantIsolation: "passed",
      workload: "synthetic-two-church",
    }),
  );
} finally {
  await client.end();
}
