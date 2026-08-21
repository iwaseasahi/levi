const baseUrl = process.env.LOCAL_APP_URL ?? "http://127.0.0.1:3000";

export {};

type JsonObject = Record<string, unknown>;

async function fetchJson(pathname: string) {
  const response = await fetch(new URL(pathname, baseUrl), {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  const payload = (await response.json()) as JsonObject;
  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }
  return payload;
}

async function waitForApplication() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await fetchJson("/api/health");
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

const health = await waitForApplication();
if (health.service !== "levi" || health.status !== "ok") {
  throw new Error("Liveness payload did not report service=levi and status=ok");
}

const readiness = await fetchJson("/api/ready");
const readinessChecks = readiness.checks as JsonObject | undefined;
if (
  readiness.service !== "levi" ||
  readiness.status !== "ready" ||
  readinessChecks?.database !== "ok"
) {
  throw new Error("Readiness payload did not report the database as ready");
}

const database = await fetchJson("/api/health/database");
if (
  database.service !== "levi" ||
  database.status !== "ok" ||
  database.database !== "ok"
) {
  throw new Error("Database health payload did not report status=ok");
}

process.stdout.write(
  `Local Levi smoke check passed: ${baseUrl}/api/health, /api/ready, /api/health/database\n`,
);
