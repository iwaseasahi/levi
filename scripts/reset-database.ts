import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const allowedDatabases = new Set(["levi", "levi_test"]);
const databaseName = parsedUrl.pathname.replace(/^\//, "");

if (
  process.env.NODE_ENV === "production" ||
  !localHosts.has(parsedUrl.hostname) ||
  !allowedDatabases.has(databaseName)
) {
  throw new Error(
    `Refusing to reset non-local or unrecognized database: ${parsedUrl.hostname}/${databaseName}`,
  );
}

const result = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "reset", "--force"],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
