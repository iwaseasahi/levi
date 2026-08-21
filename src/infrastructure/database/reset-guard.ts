const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const allowedDatabases = new Set(["levi", "levi_test"]);
const postgresProtocols = new Set(["postgres:", "postgresql:"]);

export function assertLocalResetTarget(
  databaseUrl: string | undefined,
  nodeEnvironment: string | undefined,
): void {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing to reset an invalid database URL");
  }

  const databaseName = decodeURIComponent(
    parsedUrl.pathname.replace(/^\//, ""),
  );
  if (
    nodeEnvironment === "production" ||
    !postgresProtocols.has(parsedUrl.protocol) ||
    !localHosts.has(parsedUrl.hostname) ||
    !allowedDatabases.has(databaseName)
  ) {
    throw new Error(
      `Refusing to reset non-local or unrecognized database: ${parsedUrl.hostname}/${databaseName}`,
    );
  }
}
