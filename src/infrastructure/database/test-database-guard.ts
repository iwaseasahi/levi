const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const postgresProtocols = new Set(["postgres:", "postgresql:"]);

export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://levi:levi@127.0.0.1:55433/levi_test?schema=public";
export const DEFAULT_TEST_SHADOW_DATABASE_URL =
  "postgresql://levi:levi@127.0.0.1:55433/levi_shadow?schema=public";

function parseLocalPostgresUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} is required`);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Refusing to use an invalid ${label}`);
  }

  if (
    !postgresProtocols.has(parsed.protocol) ||
    !localHosts.has(parsed.hostname)
  ) {
    throw new Error(`Refusing to use a non-local PostgreSQL ${label}`);
  }
  return parsed;
}

function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

export function assertDedicatedTestDatabaseTarget(
  databaseUrl: string | undefined,
): void {
  const parsed = parseLocalPostgresUrl(databaseUrl, "test database URL");
  if (databaseName(parsed) !== "levi_test") {
    throw new Error(
      `Refusing to run destructive tests against ${parsed.hostname}/${databaseName(parsed)}`,
    );
  }
}

export function assertDedicatedTestShadowTarget(
  shadowDatabaseUrl: string | undefined,
): void {
  const parsed = parseLocalPostgresUrl(
    shadowDatabaseUrl,
    "test shadow database URL",
  );
  if (databaseName(parsed) !== "levi_shadow") {
    throw new Error(
      `Refusing to run test migrations against ${parsed.hostname}/${databaseName(parsed)}`,
    );
  }
}

export function assertDedicatedTestEnvironment(
  environment: NodeJS.ProcessEnv,
): void {
  if (environment.NODE_ENV !== "test") {
    throw new Error("Destructive test setup requires NODE_ENV=test");
  }
  assertDedicatedTestDatabaseTarget(environment.DATABASE_URL);
  assertDedicatedTestShadowTarget(environment.SHADOW_DATABASE_URL);
}

export function integrationTestEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  return {
    ...environment,
    DATABASE_URL: environment.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL,
    NODE_ENV: "test",
    SHADOW_DATABASE_URL:
      environment.TEST_SHADOW_DATABASE_URL ?? DEFAULT_TEST_SHADOW_DATABASE_URL,
  };
}

export function e2eTestDatabaseEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Pick<
  NodeJS.ProcessEnv,
  "DATABASE_URL" | "NODE_ENV" | "SHADOW_DATABASE_URL"
> {
  return {
    DATABASE_URL:
      environment.E2E_DATABASE_URL ??
      environment.TEST_DATABASE_URL ??
      DEFAULT_TEST_DATABASE_URL,
    NODE_ENV: "test",
    SHADOW_DATABASE_URL:
      environment.E2E_SHADOW_DATABASE_URL ??
      environment.TEST_SHADOW_DATABASE_URL ??
      DEFAULT_TEST_SHADOW_DATABASE_URL,
  };
}
