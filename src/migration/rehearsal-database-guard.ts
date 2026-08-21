import { BibleImportError } from "./ginmaku-bible-import";

const localHosts = new Set(["127.0.0.1", "localhost"]);
const rehearsalPorts = new Set(["5432", "55432"]);

export function disposableRehearsalDatabaseUrl(
  baseUrl: string,
  database: string,
) {
  const url = new URL(baseUrl);
  if (
    !localHosts.has(url.hostname) ||
    !rehearsalPorts.has(url.port) ||
    url.username !== "levi" ||
    !/^[a-z0-9_]+_rehearsal$/.test(database)
  )
    throw new BibleImportError("REHEARSAL_DATABASE_GUARD_REJECTED");
  url.pathname = `/${database}`;
  url.search = "schema=public";
  return url.toString();
}
